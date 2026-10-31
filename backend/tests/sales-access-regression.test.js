import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { db } = vi.hoisted(() => ({ db: Object.fromEntries([
  'branch', 'invoice', 'invoiceRefund', 'invoicePayment', 'expense', 'staff', 'user',
  'payrollRun', 'commissionEvent', 'stockMovement', 'invoiceLine', 'accountMovement',
  'cashMovement', 'bookingPayment', 'booking', 'appointment', 'cashDrawer', 'settlement',
  'paymentAccount', 'expenseCategory', 'drawerMovement', 'bookingHistory',
].map(name => [name, Object.fromEntries(['findMany', 'findUnique', 'findFirst', 'aggregate', 'groupBy'].map(method => [method, vi.fn()]))])) }));
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/middleware/authenticate.js', () => ({ authenticate: (req, _res, next) => {
  req.user = { id: 'sales-a', role: req.headers['x-role'] || 'ACCOUNTANT', branchId: 'b1' }; next();
} }));
vi.mock('../src/lib/paymentPosting.js', () => ({ paymentPosting: (_actor, _request, fn) => fn(db), postingRequest: () => ({}) }));
vi.mock('../src/modules/branches/branches.service.js', () => ({ toDTOs: async rows => rows }));
vi.mock('../src/lib/dates.js', async original => ({ ...await original(), getBusinessDate: async () => '2026-10-10' }));

import * as reports from '../src/modules/reports/reports.service.js';
import { reportRoutes } from '../src/modules/reports/reports.routes.js';
import { getInvoice, listInvoices, clientOutstanding, collectPayment, reverseCollection } from '../src/modules/pos/pos.service.js';
import { listRefunds } from '../src/modules/pos/pos.refund.js';
import { accountantDashboard } from '../src/modules/dashboard/dashboard.service.js';
import { clientStats } from '../src/modules/clients/clients.service.js';
import { listPaymentAccounts, listOnlineAccounts } from '../src/modules/settings/settings.service.js';
import { resolveReadBranch } from '../src/lib/scope.js';

const actor = { id: 'sales-a', name: 'Sales A', role: 'ACCOUNTANT', branchId: 'b1' };
const query = { from: '2026-10-01', to: '2026-10-31' };
const sale = (id, owner, branchId = 'b1', amount = 100) => ({
  id, processedByUserId: owner, processedByName: owner, branchId, invoiceNumber: id,
  date: new Date('2026-10-10'), createdAt: new Date('2026-10-10'), clientId: 'client',
  clientName: 'Client', clientPhone: '03001234567', status: 'UNPAID', lifecycle: 'ACTIVE',
  subtotal: amount, netSales: amount, total: amount, amountDue: amount, amountPaid: 0,
  tax: 0, tip: 0, discount: 0, lines: [], payments: [], refunds: [],
});
const fixtures = [sale('own', 'sales-a'), sale('peer', 'sales-b', 'b1', 200), sale('admin', 'admin', 'b1', 300), sale('super', 'super', 'b1', 400), sale('other-branch', 'sales-a', 'b2', 500)];
const matches = (row, where) => (!where.branchId || row.branchId === where.branchId)
  && (!where.processedByUserId || row.processedByUserId === where.processedByUserId);

beforeEach(() => {
  vi.resetAllMocks();
  for (const model of Object.values(db)) {
    if (!model.findMany) continue;
    model.findMany.mockResolvedValue([]);
    model.groupBy.mockResolvedValue([]);
    model.aggregate.mockResolvedValue({ _sum: {}, _count: 0 });
  }
  db.branch.findUnique.mockResolvedValue({ id: 'b1', name: 'Branch' });
  db.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Branch' }]);
  db.invoice.findMany.mockImplementation(async ({ where }) => fixtures.filter(row => matches(row, where)));
  db.invoice.findUnique.mockImplementation(async ({ where }) => fixtures.find(row => row.id === where.id));
  db.$executeRaw = vi.fn();
});

describe('sales ownership boundaries', () => {
  it.each([{}, { soldByUserId: 'admin' }, { accountantId: 'super' }, { userId: 'sales-b' }, { soldByUserId: 'ALL', branchId: 'ALL' }, { branchId: 'b2', search: 'Client', staffId: 'staff' }])('keeps invoice report rows and totals personal despite filters %j', async filters => {
    const result = await reports.salesInvoicesReport(actor, { ...query, ...filters });
    expect(result.rows.map(row => row.id)).toEqual(['own']);
    expect(result.totals.netSales).toBe(100);
    expect(result.totals.outstanding).toBe(100);
  });

  it.each(['ADMIN', 'SUPER_ADMIN'])('preserves %s visibility and seller filters', async role => {
    const admin = { ...actor, role };
    const result = await reports.salesInvoicesReport(admin, query);
    expect(result.rows).toHaveLength(role === 'SUPER_ADMIN' ? 5 : 4);
    const filtered = await reports.salesInvoicesReport(admin, { ...query, soldByUserId: 'sales-b' });
    expect(filtered.rows.map(row => row.id)).toEqual(['peer']);
  });

  it('scopes list and outstanding client invoices to the signed-in seller', async () => {
    expect((await listInvoices(actor, { soldByUserId: 'super', branchId: 'b2' })).map(row => row.id)).toEqual(['own']);
    expect((await clientOutstanding(actor, { clientIdOrPhone: 'client' })).map(row => row.id)).toEqual(['own']);
  });

  it.each(['peer', 'admin', 'super', 'other-branch'])('rejects direct detail, refunds and payment mutations for %s', async id => {
    await expect(getInvoice(actor, id)).rejects.toMatchObject({ status: 403 });
    await expect(listRefunds(actor, id)).rejects.toMatchObject({ status: 403 });
    expect(db.invoiceRefund.findMany).not.toHaveBeenCalled();
    await expect(collectPayment({ invoiceId: id }, actor)).rejects.toMatchObject({ status: 403 });
    await expect(reverseCollection({ invoiceId: id }, actor)).rejects.toMatchObject({ status: 403 });
  });

  it('allows own details and administrator access', async () => {
    expect((await getInvoice(actor, 'own')).id).toBe('own');
    expect(await listRefunds(actor, 'own')).toEqual([]);
    expect((await getInvoice({ ...actor, role: 'ADMIN' }, 'peer')).id).toBe('peer');
  });

  it('fails closed for a missing branch assignment', async () => {
    expect(() => resolveReadBranch({ ...actor, branchId: null })).toThrow();
    await expect(reports.salesInvoicesReport({ ...actor, branchId: null }, query)).rejects.toMatchObject({ status: 403 });
    expect(db.invoice.findMany).not.toHaveBeenCalled();
  });

  it('keeps dashboard outstanding totals personal', async () => {
    db.invoice.aggregate.mockImplementation(async ({ where }) => {
      const rows = fixtures.filter(row => matches(row, where));
      return { _count: rows.length, _sum: { amountDue: rows.reduce((sum, row) => sum + row.amountDue, 0) } };
    });
    const result = await accountantDashboard(actor);
    expect(result.unpaidInvoicesCount).toBe(1);
    expect(result.unpaidInvoicesTotal).toBe(100);
  });

  it('scopes customer financial summaries as well as the invoice lists', async () => {
    await clientStats(['client'], db, actor);
    expect(db.invoice.groupBy.mock.calls[0][0].where.processedByUserId).toBe(actor.id);
    expect(db.invoice.findMany.mock.calls[0][0].where.processedByUserId).toBe(actor.id);
    expect(db.booking.findMany.mock.calls[0][0].where.createdById).toBe(actor.id);
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });

  it.each(['detailedIncomeReport', 'incomeExpenseReport', 'taxReport'])('locks every sales query in %s to the seller', async method => {
    await reports[method](actor, { ...query, soldByUserId: 'admin', userId: 'super', branchId: 'b2' });
    expect(db.invoice.findMany).toHaveBeenCalled();
    for (const [args] of db.invoice.findMany.mock.calls) {
      expect(args.where).toMatchObject({ branchId: 'b1', processedByUserId: 'sales-a' });
    }
    for (const [args] of db.invoiceRefund.findMany.mock.calls) {
      expect(args.where.invoice).toMatchObject({ branchId: 'b1', processedByUserId: 'sales-a' });
    }
    expect(db.payrollRun.findMany).not.toHaveBeenCalled();
    expect(db.commissionEvent.findMany).not.toHaveBeenCalled();
    expect(db.stockMovement.findMany).not.toHaveBeenCalled();
  });

  it('locks cash and expense reports despite forged custodian and creator filters', async () => {
    await reports.cashDrawerReport(actor, { ...query, custodianUserId: 'admin' });
    expect(db.cashDrawer.findMany.mock.calls[0][0].where).toMatchObject({ branchId: 'b1', custodianUserId: actor.id });
    expect(db.invoicePayment.findMany.mock.calls[0][0].where.processedByUserId).toBe(actor.id);
    await reports.detailedExpensesReport(actor, { ...query, createdByUserId: 'admin', search: 'rent' });
    expect(db.expense.findMany.mock.calls[0][0].where).toMatchObject({
      branchId: 'b1', OR: [{ createdByUserId: actor.id }, { paidByUserId: actor.id }],
    });
  });
});

describe('branch-wide reports require administrator privileges', () => {
  it('keeps payment options available without disclosing shared account balances', async () => {
    db.paymentAccount.findMany.mockResolvedValue([{ id: 'account', branchId: 'b1', name: 'Bank', openingBalance: 99999 }]);
    for (const list of [listPaymentAccounts, listOnlineAccounts]) {
      const rows = await list(actor);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('account');
      expect(rows[0]).not.toHaveProperty('currentBalance');
    }
    expect(db.accountMovement.groupBy).not.toHaveBeenCalled();
  });
  it.each(['operatingProfitReport', 'paymentAccountsReport', 'inventoryReport'])('rejects sales staff at the service boundary: %s', async method => {
    await expect(reports[method](actor, query)).rejects.toMatchObject({ status: 403 });
    expect(db.branch.findUnique).not.toHaveBeenCalled();
  });

  it.each(['operating-profit', 'payment-accounts', 'inventory', 'appointments', 'staff-salary', 'staff-commission', 'attendance'])('rejects direct HTTP access to /reports/%s', async path => {
    const app = express(); app.use('/reports', reportRoutes);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ code: err.code }));
    const res = await request(app).get(`/reports/${path}`);
    expect(res.status).toBe(403);
  });
});
