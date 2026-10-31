// Run with a local playwright-core module path. All API calls are intercepted; no salon data is written.
const { chromium } = require(process.argv[2] || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const branch = { id: 'branch-2', name: 'Booking Branch', code: 'BR-2', city: 'Karachi', phone: '03000000000', address: 'Test', isActive: true, taxEnabled: false, taxRate: 0, currency: 'PKR' };
const booking = { id: 'test-booking', bookingNumber: 'BKG-TEST', branchId: branch.id, clientId: 'client', clientName: 'Bridal Client', clientPhone: '03001234567',
  type: 'BRIDAL', eventDate: '2026-11-10', serviceTime: '10:00 AM', revision: 3, discountType: 'FIXED', discountValue: 0, subtotal: 30000, discount: 0, taxAmount: 0, totalAmount: 30000,
  advancePaid: 15000, remainingBalance: 15000, status: 'CONFIRMED', notes: 'Event makeup', specialRequirements: 'Dupatta setting',
  items: [{ id: 'line', lineInstanceId: 'booking-line', type: 'CUSTOM_SERVICE', itemId: null, name: 'Custom bridal makeup', description: 'Event makeup', unitPrice: 30000, quantity: 1, durationMinutes: 60, taxRate: 0, taxTreatment: 'EXEMPT', staffId: null, components: [] }], payments: [], history: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const failures = []; page.on('pageerror', e => failures.push(e.message));
    let posted;
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      let data = [];
      if (path === '/auth/refresh') data = { token: 'browser-test', user: { id: 'super', name: 'POS Test', email: 'test@example.test', role: 'SUPER_ADMIN', isActive: true }, activeBranchId: 'ALL' };
      else if (path === '/branches') data = [{ ...branch, id: 'branch-1', name: 'Other Branch' }, branch];
      else if (path === '/system/date') data = { date: '2026-10-25' };
      else if (path === '/bookings/test-booking/pos-handoff') data = booking;
      else if (path === '/pos/invoices/checkout') {
        posted = route.request().postDataJSON();
        data = { id: 'invoice', invoiceNumber: 'INV-TEST', branchId: branch.id, bookingId: booking.id, advanceAdjusted: 15000,
          clientName: booking.clientName, clientPhone: booking.clientPhone, date: '2026-10-25', time: '10:00 AM',
          subtotal: 30000, discount: 0, netSales: 30000, tax: 0, tip: 0, total: 30000, amountPaid: 30000, amountDue: 0, status: 'PAID', lifecycle: 'ACTIVE',
          lineItems: [{ ...booking.items[0], tax: 0, total: 30000, staffName: 'House / Salon' }], payments: [{ id: 'payment', amount: 15000, billAmountAllocated: 15000, tipAmountAllocated: 0, method: 'CASH', receiptNumber: 'RCP-TEST' }] };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    await page.goto('http://localhost:3001/pos?bookingId=test-booking');
    await page.getByText('Custom bridal makeup', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Booking checkout', { exact: true }).count(), 0);
    await page.getByText('BKG-TEST', { exact: false }).first().waitFor();
    fs.mkdirSync('../artifacts', { recursive: true });
    await page.screenshot({ path: '../artifacts/booking-in-existing-pos.png', fullPage: true });
    await page.getByRole('button', { name: /Collect Payment & Complete Sale/ }).click();
    await page.getByRole('heading', { name: 'Payment & Checkout' }).waitFor();
    await page.getByRole('button', { name: 'Confirm & Print Receipt' }).click();
    await page.getByText('INV-TEST', { exact: false }).first().waitFor();
    assert.equal(posted.bookingId, booking.id);
    assert.equal(posted.branchId, 'branch-2');
    assert.equal(posted.bookingRevision, 3);
    assert.equal(posted.payments.reduce((sum, p) => sum + p.amount, 0), 15000);
    assert.equal(posted.cartItems[0].item.name, 'Custom bridal makeup');
    assert.deepEqual(failures, []);
    console.log('Browser passed: booking loaded into existing POS, correct branch/client/custom service, prior advance deducted, normal checkout posts only 15000.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
