import { describe, it, expect, beforeAll } from 'vitest';
import { as } from './helpers.js';
import prisma from '../src/config/prisma.js';
import { priceBooking } from '../src/modules/bookings/bookings.pricing.js';
import { createSchema } from '../src/modules/bookings/bookings.schema.js';
import { bookingToPOSCart, cartToBookingUpdate, bookingSettlement } from '../../frontend/src/features/pos/bookingPOS.ts';
const key = n => ({ 'Idempotency-Key': `booking-test-${n}` });
const custom = (price = 30000) => ({ clientName: 'Booking Client', clientPhone: '03019876543', type: 'BRIDAL', eventDate: '2026-11-10', serviceTime: '10:00', items: [{ type: 'CUSTOM_SERVICE', name: 'Bridal makeup', unitPrice: price, quantity: 1, durationMinutes: 60 }] });
const ok = (r, status = 200) => { expect(r.body.error).toBeUndefined(); expect(r.status).toBe(status); return r.body.data; };
const balance = async () => {
  const rows = await prisma.drawerMovement.findMany({ where: { branchId: 'branch-1' } });
  return rows.reduce((s, r) => s + (r.direction === 'IN' ? Number(r.amount) : -Number(r.amount)), 0);
};
describe('Booking validation and pricing', () => {
  it('allows optional staff, requires explicit type and validates custom input/calendar', () => {
    expect(createSchema.safeParse(custom()).success).toBe(true);
    expect(createSchema.safeParse({ ...custom(), type: undefined }).success).toBe(false);
    expect(createSchema.safeParse({ ...custom(), eventDate: '2026-02-30' }).success).toBe(false);
    expect(createSchema.safeParse({ ...custom(), items: [{ type: 'CUSTOM_SERVICE', quantity: 1 }] }).success).toBe(false);
  });
  it('allocates discount before line tax and rounds correctly', () => {
    const p = priceBooking([{ unitPrice: 100, quantity: 1, taxRate: .1 }, { unitPrice: 200, quantity: 1, taxRate: 0 }], 'PERCENTAGE', 10);
    expect(Number(p.totalAmount)).toBe(279);
    expect(() => priceBooking([{ unitPrice: 100, quantity: 1, taxRate: 0 }], 'PERCENTAGE', 101)).toThrow();
  });
});
describe('Booking lifecycle', () => {
  beforeAll(async () => {
    await prisma.branch.update({ where: { id: 'branch-1' }, data: { taxEnabled: false } });
    const { setBusinessDate, toDateString } = await import('../src/lib/dates.js');
    await setBusinessDate(toDateString());
  });
  it('saves without staff/payment; collects installments exactly once and adjusts POS', async () => {
    const b = ok(await as('admin').post('/bookings', custom(), key('create')), 201);
    expect(b).toMatchObject({ type: 'BRIDAL', assignedStaffId: null, remainingBalance: 30000, paymentStatus: 'UNPAID' });
    const before = await balance();
    const p = { amount: 5000, method: 'CASH' };
    ok(await as('accountant').post(`/bookings/${b.id}/payments`, p, key('p1')), 201);
    ok(await as('accountant').post(`/bookings/${b.id}/payments`, p, key('p1')), 201);
    expect(await balance()).toBe(before + 5000);
    const account = await prisma.paymentAccount.findFirst({ where: { branchId: 'branch-1', isActive: true } });
    const paid = ok(await as('accountant').post(`/bookings/${b.id}/payments`, { amount: 10000, method: 'ONLINE_ACCOUNT', paymentAccountId: account.id }, key('p2')), 201);
    expect(paid.remainingBalance).toBe(15000);
    const cashBeforeCheckout = await balance();
    const inv = ok(await as('accountant').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: paid.revision, payments: [{ method: 'CASH', amount: 15000, billAllocation: 15000, tipAllocation: 0 }] }, key('checkout')), 201);
    expect(inv).toMatchObject({ total: 30000, advanceAdjusted: 15000, amountPaid: 30000, amountDue: 0, status: 'PAID', bookingId: b.id });
    expect(await balance()).toBe(cashBeforeCheckout + 15000);
    expect(ok(await as('admin').get(`/bookings/${b.id}`)).status).toBe('COMPLETED');
    expect((await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: paid.revision }, key('duplicate'))).status).toBe(409);
    expect(await prisma.commissionEvent.count({ where: { invoiceId: inv.id } })).toBe(0);
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin.gulberg@isysware.com' } });
    const { getActiveDrawer, postCashMovement } = await import('../src/modules/cash/cash.service.js');
    await prisma.$transaction(async tx => {
      const drawer = await getActiveDrawer(tx, adminUser, 'branch-1');
      await postCashMovement(tx, { holderId: drawer.id, type: 'OPENING_FLOAT', direction: 'IN', amount: 30000, sourceModule: 'TEST', actor: adminUser });
    });
    const refund = ok(await as('admin').post(`/invoices/${inv.id}/refunds`, { type: 'VOID', reason: 'Test booking void' }, key('void')), 201);
    expect(refund.refund.cashOut).toBe(30000);
    expect((await as('admin').post(`/bookings/${b.id}/refunds`, { payment: { amount: 5000, method: 'CASH' }, reason: 'Cannot double refund' }, key('double-refund'))).status).toBe(409);
  });
  it('supports fully prepaid checkout without new money movement and partial invoice dues', async () => {
    const b = ok(await as('admin').post('/bookings', { ...custom(1000), type: 'GROOM', advancePayment: { amount: 1000, method: 'CASH' } }, key('prepaid')), 201);
    const before = await balance();
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('prepaid-checkout')), 201);
    expect(inv.amountDue).toBe(0); expect(await balance()).toBe(before);
    const unpaid = ok(await as('admin').post('/bookings', custom(2000), key('unpaid')), 201);
    const partial = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: unpaid.id, bookingRevision: unpaid.revision, payments: [{ method: 'CASH', amount: 500, billAllocation: 500 }] }, key('partial')), 201);
    expect(partial).toMatchObject({ amountDue: 1500, status: 'PARTIAL' });
  });
  it('serializes concurrent payments and cancellation reconciles fee/refund', async () => {
    const b = ok(await as('admin').post('/bookings', custom(1000), key('concurrent')), 201);
    const results = await Promise.all([as('accountant').post(`/bookings/${b.id}/payments`, { amount: 800, method: 'CASH' }, key('race1')), as('accountant').post(`/bookings/${b.id}/payments`, { amount: 800, method: 'CASH' }, key('race2'))]);
    expect(results.map(r => r.status).sort()).toEqual([201, 400]);
    const current = ok(await as('admin').get(`/bookings/${b.id}`));
    const cancelled = ok(await as('admin').post(`/bookings/${b.id}/cancel`, { revision: current.revision, reason: 'Client cancelled event', cancellationCharge: 300, refundPayment: { amount: 500, method: 'CASH' } }, key('cancel')));
    expect(cancelled).toMatchObject({ status: 'CANCELLED', advancePaid: 300, remainingBalance: 0 });
    const ledger = ok(await as('admin').get(`/bookings/${b.id}/ledger`));
    expect(ledger.rows.at(-1).balance).toBe(0);
  });
  it('rejects cross-branch access, staff and accountant management', async () => {
    expect((await as('staff').get('/bookings')).status).toBe(403);
    expect((await as('accountant').post('/bookings', custom(), key('denied'))).status).toBe(403);
    const b = ok(await as('admin').post('/bookings', custom(), key('scope')), 201);
    expect((await as('adminKhi').get(`/bookings/${b.id}`)).status).toBe(403);
  });
  it('preserves catalog quote through a price change and audits explicit repricing', async () => {
    const service = await prisma.service.findFirst({ where: { branchId: 'branch-1', isActive: true } });
    const payload = { ...custom(), items: [{ type: 'SERVICE', itemId: service.id, quantity: 1 }] };
    const b = ok(await as('admin').post('/bookings', payload, key('snapshot')), 201);
    await prisma.service.update({ where: { id: service.id }, data: { price: toNumber(service.price) + 999 } });
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('snapshot-checkout')), 201);
    expect(inv.subtotal).toBe(Number(service.price));
    const edit = ok(await as('admin').post('/bookings', custom(1000), key('edit')), 201);
    const input = { ...custom(1200), revision: edit.revision, reason: 'Extra makeup work', items: [{ ...custom(1200).items[0], lineInstanceId: edit.items[0].lineInstanceId }] };
    const revised = ok(await as('admin').put(`/bookings/${edit.id}`, input));
    expect(revised.totalAmount).toBe(1200);
    expect(revised.history.some(h => h.type === 'BOOKING_REVISED')).toBe(true);
    expect((await as('admin').put(`/bookings/${edit.id}`, input)).status).toBe(409);
    await prisma.service.update({ where: { id: service.id }, data: { price: service.price } });
  });
  it('rejects reductions below held funds, conflicting idempotency key and stale checkout', async () => {
    const b = ok(await as('admin').post('/bookings', { ...custom(2000), advancePayment: { amount: 1000, method: 'CASH' } }, key('guards')), 201);
    expect((await as('admin').put(`/bookings/${b.id}`, { ...custom(500), revision: b.revision, reason: 'Reduce quote' })).status).toBe(409);
    const payment = { amount: 500, method: 'CASH' };
    ok(await as('admin').post(`/bookings/${b.id}/payments`, payment, key('same-key')), 201);
    expect((await as('admin').post(`/bookings/${b.id}/payments`, { ...payment, amount: 600 }, key('same-key'))).status).toBe(409);
    expect((await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('stale'))).status).toBe(409);
    expect(ok(await as('admin').get(`/bookings/${b.id}`)).advancePaid).toBe(1500);
  });
  it('checks assigned booking and appointment conflicts in both directions', async () => {
    const service = await prisma.service.findFirst({ where: { branchId: 'branch-1', isActive: true } });
    const staff = await prisma.staff.findUnique({ where: { id: 'staff-1' } });
    const booking = { ...custom(1000), eventDate: '2026-11-12', serviceTime: staff.startTime, assignedStaffId: staff.id };
    ok(await as('admin').post('/bookings', booking, key('slot')), 201);
    expect((await as('admin').post('/appointments', { clientName: 'Slot customer', clientPhone: '03017778899', date: booking.eventDate, startTime: staff.startTime, items: [{ type: 'SERVICE', itemId: service.id, staffId: staff.id }] })).status).toBe(409);
    const nextDate = '2026-11-13';
    ok(await as('admin').post('/appointments', { clientName: 'Slot customer', clientPhone: '03017778899', date: nextDate, startTime: staff.startTime, items: [{ type: 'SERVICE', itemId: service.id, staffId: staff.id }] }), 201);
    expect((await as('admin').post('/bookings', { ...booking, eventDate: nextDate }, key('slot-conflict'))).status).toBe(409);
    ok(await as('admin').post('/bookings', { ...booking, assignedStaffId: null }, key('unassigned-slot')), 201);
  });
  it('earns custom service commission only at invoice completion and reverses on void', async () => {
    const staff = await prisma.staff.findUnique({ where: { id: 'staff-1' } });
    const b = ok(await as('admin').post('/bookings', { ...custom(1000), eventDate: '2026-11-14', serviceTime: staff.startTime, assignedStaffId: staff.id }, key('commission')), 201);
    expect(await prisma.invoice.findUnique({ where: { bookingId: b.id } })).toBeNull();
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('commission-checkout')), 201);
    const earns = await prisma.commissionEvent.findMany({ where: { invoiceId: inv.id, type: 'EARN' } });
    expect(earns.length).toBe(1); expect(Number(earns[0].amount)).toBe(1000 * Number(staff.commissionRate) / 100);
    ok(await as('admin').post(`/invoices/${inv.id}/refunds`, { type: 'VOID', reason: 'Service cancelled for test' }, key('commission-void')), 201);
    const reversals = await prisma.commissionEvent.findMany({ where: { invoiceId: inv.id, type: 'REVERSAL' } });
    expect(Number(reversals[0].amount)).toBe(Number(earns[0].amount));
  });
  it('keeps deposit cash flow separate from recognized revenue and reports cancellation fees', async () => {
    const { toDateString } = await import('../src/lib/dates.js');
    const date = toDateString();
    const report = ok(await as('admin').get(`/reports/income-expense?startDate=${date}&endDate=${date}`));
    const depositRows = report.rows.filter(r => r.source === 'BOOKING' && r.type === 'SETTLEMENT');
    expect(depositRows.length).toBeGreaterThan(0);
    expect(depositRows.every(r => r.income === 0 && r.expense === 0)).toBe(true);
    expect(report.rows.some(r => r.category === 'Booking Cancellation Fees' && r.income === 300)).toBe(true);
  });
  it('snapshots package components and allocates eligible net commission per component', async () => {
    const pkg = await prisma.package.findFirst({ where: { branchId: 'branch-1', isActive: true }, include: { components: true } });
    const staff = await prisma.staff.findUnique({ where: { id: 'staff-1' } });
    const b = ok(await as('admin').post('/bookings', { ...custom(), eventDate: '2026-11-15', serviceTime: staff.startTime,
      discountType: 'PERCENTAGE', discountValue: 10, items: [{ type: 'PACKAGE', itemId: pkg.id, quantity: 1, packageComponents: pkg.components.map((c, i) => ({ serviceId: c.serviceId, staffId: i === 0 ? staff.id : null })) }] }, key('package')), 201);
    expect(b.items[0].components.length).toBe(pkg.components.length);
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('package-checkout')), 201);
    const components = inv.lineItems[0].packageComponents;
    expect(components.length).toBe(pkg.components.length);
    expect(components.reduce((s, c) => s + c.allocatedAmount, 0)).toBeCloseTo(inv.netSales, 2);
    const earn = await prisma.commissionEvent.findMany({ where: { invoiceId: inv.id, type: 'EARN' } });
    expect(earn.length).toBe(1);
    expect(Number(earn[0].amount)).toBeCloseTo(components.find(c => c.staffId === staff.id).allocatedAmount * Number(staff.commissionRate) / 100, 2);
  });
  it('exposes client booking balances without adding commitments to invoice dues', async () => {
    const b = ok(await as('admin').post('/bookings', { ...custom(1500), advancePayment: { amount: 500, method: 'CASH' } }, key('client-booking')), 201);
    const client = ok(await as('admin').get(`/clients/${b.clientId}`));
    expect(client.activeBookingsCount).toBeGreaterThan(0);
    expect(client.bookingAdvanceBalance).toBeGreaterThanOrEqual(500);
    expect(client.bookingOutstandingBalance).toBeGreaterThanOrEqual(1000);
    const collections = ok(await as('admin').get(`/bookings/collections?clientId=${b.clientId}`));
    expect(collections.some(p => p.bookingId === b.id && p.amount === 500)).toBe(true);
    expect((await as('staff').get('/bookings/collections')).status).toBe(403);
  });
  it('posts the regular POS payload after booking cart edits and applies advance only once', async () => {
    const b = ok(await as('admin').post('/bookings', { ...custom(2000), advancePayment: { amount: 500, method: 'CASH' } }, key('normal-pos')), 201);
    const handoff = ok(await as('admin').get(`/bookings/${b.id}/pos-handoff`));
    const cart = bookingToPOSCart(handoff); cart[0].item.price = 2500;
    const amounts = bookingSettlement(2500, 100, handoff.advancePaid);
    const before = await balance();
    const inv = ok(await as('admin').post('/pos/invoices/checkout', {
      branchId: handoff.branchId, bookingId: handoff.id, bookingRevision: handoff.revision,
      bookingUpdate: cartToBookingUpdate(handoff, cart, 'FIXED', 0, 'Extra makeup requested at checkout'),
      cartItems: cart, tip: 100,
      payments: [{ method: 'CASH', amount: amounts.amountToCollect, billAllocation: amounts.remainingBillTotal, tipAllocation: 100 }],
    }, key('normal-pos-checkout')), 201);
    expect(inv).toMatchObject({ advanceAdjusted: 500, total: 2600, amountPaid: 2600, amountDue: 0, status: 'PAID' });
    expect(inv.lineItems[0]).toMatchObject({ type: 'CUSTOM_SERVICE', name: 'Bridal makeup', unitPrice: 2500 });
    expect(await balance()).toBe(before + 2100);
    const finished = ok(await as('admin').get(`/bookings/${b.id}`));
    expect(finished.totalAmount).toBe(2500);
    expect(finished.history.some(h => h.reason === 'Extra makeup requested at checkout')).toBe(true);
  });
  it('includes retail additions from POS rather than silently dropping them from a booking invoice', async () => {
    const b = ok(await as('admin').post('/bookings', custom(1000), key('retail-addition')), 201);
    const product = await prisma.inventoryItem.findUnique({ where: { id: 'item-1' } });
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision,
      cartItems: [{ type: 'PRODUCT', item: { id: product.id, sellingPrice: Number(product.sellingPrice) }, quantity: 1 }],
    }, key('retail-checkout')), 201);
    expect(inv.lineItems.some(i => i.type === 'PRODUCT' && i.itemId === product.id)).toBe(true);
    const finished = ok(await as('admin').get(`/bookings/${b.id}`));
    expect(finished.totalAmount).toBe(inv.total);
    const ledger = ok(await as('admin').get(`/bookings/${b.id}/ledger`));
    expect(ledger.rows.at(-1).balance).toBe(inv.amountDue);
  });
  it('reconciles client ledger and dated revenue after a partially paid booking invoice is voided', async () => {
    const { toDateString } = await import('../src/lib/dates.js');
    const day = toDateString();
    const endpoint = `/reports/income-expense?startDate=${day}&endDate=${day}`;
    const before = ok(await as('admin').get(endpoint));
    const b = ok(await as('admin').post('/bookings', { ...custom(1000), advancePayment: { amount: 200, method: 'CASH' } }, key('ledger-void')), 201);
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision,
      payments: [{ method: 'CASH', amount: 300, billAllocation: 300 }] }, key('ledger-void-post')), 201);
    const during = ok(await as('admin').get(endpoint));
    expect(during.kpis.totalRecognizedIncome - before.kpis.totalRecognizedIncome).toBeCloseTo(1000, 2);
    ok(await as('admin').post(`/invoices/${inv.id}/refunds`, { type: 'VOID', reason: 'Customer cancelled final service' }, key('ledger-void-refund')), 201);
    const after = ok(await as('admin').get(endpoint));
    expect(after.kpis.totalRecognizedIncome).toBeCloseTo(before.kpis.totalRecognizedIncome, 2);
    const refreshed = ok(await as('admin').get(`/invoices/${inv.id}`));
    expect(refreshed.refunds[0]).toMatchObject({ cashOut: 500, netReversed: 1000, receivableCancelled: 500 });
    const { buildClientLedger } = await import('../../frontend/src/features/clients/clientLedger.ts');
    const entries = buildClientLedger({ bookings: [ok(await as('admin').get(`/bookings/${b.id}`))], invoices: [refreshed] });
    expect(entries[0].balance).toBe(0);
    expect(entries.some(e => e.description.includes('Invoice void'))).toBe(true);
  });
  it('keeps invoice income on the sale date and void reversal on the selected business date', async () => {
    const { setBusinessDate, toDateString } = await import('../src/lib/dates.js');
    const day = toDateString();
    const nextDay = new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
    const report = async date => ok(await as('admin').get(`/reports/income-expense?startDate=${date}&endDate=${date}`));
    const before = await report(day); const nextBefore = await report(nextDay);
    const b = ok(await as('admin').post('/bookings', custom(2000), key('dated-void')), 201);
    const inv = ok(await as('admin').post('/pos/invoices/checkout', { bookingId: b.id, bookingRevision: b.revision }, key('dated-void-post')), 201);
    try {
      await setBusinessDate(nextDay);
      ok(await as('admin').post(`/invoices/${inv.id}/refunds`, { type: 'VOID', reason: 'Reversal on following business date' }, key('dated-void-refund')), 201);
      expect((await report(day)).kpis.totalRecognizedIncome).toBeCloseTo(before.kpis.totalRecognizedIncome + 2000, 2);
      expect((await report(nextDay)).kpis.totalRecognizedIncome).toBeCloseTo(nextBefore.kpis.totalRecognizedIncome - 2000, 2);
      const ledger = ok(await as('admin').get(`/bookings/${b.id}/ledger`));
      const reversal = ledger.rows.find(r => r.description === 'Invoice refund / void adjustment');
      expect(toDateString(new Date(reversal.date))).toBe(nextDay);
      expect(ledger.rows.at(-1).balance).toBe(0);
    } finally { await setBusinessDate(day); }
  });
});
const toNumber = v => Number(v);
