// Read-only audit of the configured working database and its running HTTP API.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { bookingInclude, toBookingDTO } from '../src/modules/bookings/bookings.mapper.js';
import { priceBooking, netPayments } from '../src/modules/bookings/bookings.pricing.js';
import { getLedger } from '../src/modules/bookings/bookings.service.js';
import { clientStats } from '../src/modules/clients/clients.service.js';
import { incomeExpenseReport } from '../src/modules/reports/reports.service.js';
import { round2, toDec } from '../src/lib/money.js';
import { ymd } from '../src/lib/dates.js';
import { invoiceInclude } from '../src/modules/pos/pos.service.js';
import { toInvoiceDTO } from '../src/modules/pos/pos.mapper.js';
import { buildClientLedger } from '../../frontend/src/features/clients/clientLedger.ts';

const result = { checkedAt: new Date().toISOString(), readOnly: true, mockMode: null, counts: {}, totals: {}, api: {}, issues: [] };
const check = (ok, code, reference) => { if (!ok) result.issues.push({ code, reference }); };
const equal = (a, b) => round2(a).equals(round2(b));
try {
  const frontEnv = path.resolve('../frontend/.env');
  result.mockMode = fs.existsSync(frontEnv) ? /^VITE_USE_MOCK\s*=\s*['"]?true/m.test(fs.readFileSync(frontEnv, 'utf8')) : false;
  const [bookings, cash, bank, superUser] = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return Promise.all([
      tx.booking.findMany({ include: bookingInclude }),
      tx.drawerMovement.findMany({ where: { sourceModule: 'BOOKING' } }),
      tx.accountMovement.findMany({ where: { sourceModule: 'BOOKING' } }),
      tx.user.findFirst({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { id: true, name: true, role: true, branchId: true } }),
    ]);
  });
  const actor = superUser || { id: 'read-only-audit', name: 'Read only audit', role: 'SUPER_ADMIN' };
  const clientIds = [...new Set(bookings.map(b => b.clientId))];
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, branchId: true, name: true, phone: true } });
  const invoices = (await prisma.invoice.findMany({ where: { clientId: { in: clientIds } }, include: invoiceInclude })).map(toInvoiceDTO);
  const movements = [...cash, ...bank];
  const payments = bookings.flatMap(b => b.payments);
  result.counts = { bookings: bookings.length, clients: clientIds.length, items: bookings.reduce((n, b) => n + b.items.length, 0),
    receipts: payments.filter(p => !p.isRefund).length, refunds: payments.filter(p => p.isRefund).length,
    linkedInvoices: bookings.filter(b => b.invoice).length, cashMovements: cash.length, accountMovements: bank.length };
  const net = rows => round2(rows.reduce((sum, m) => m.direction === 'IN' ? sum.plus(m.amount) : sum.minus(m.amount), toDec(0)));
  result.totals = { bookingNetReceipts: Number(netPayments(payments)), cashAdvanceNet: Number(net(cash)), onlineAdvanceNet: Number(net(bank)) };
  for (const b of bookings) {
    check(clients.some(c => c.id === b.clientId && c.branchId === b.branchId), 'CLIENT_BRANCH_LINK', b.bookingNumber);
    const price = priceBooking(b.items, b.discountType, b.discountValue);
    check(equal(price.totalAmount, b.totalAmount), 'BOOKING_PRICE_TOTAL', b.bookingNumber);
    check((b.status === 'COMPLETED') === !!b.invoice, 'COMPLETED_INVOICE_LINK', b.bookingNumber);
    if (b.invoice) check(equal(b.invoice.advanceAdjusted, netPayments(b.payments)), 'INVOICE_ADVANCE', b.bookingNumber);
    const ledger = await getLedger(actor, b.id);
    check(equal(ledger.rows.at(-1)?.balance || 0, ledger.booking.remainingBalance), 'BOOKING_LEDGER_BALANCE', b.bookingNumber);
    for (const p of b.payments) {
      const matches = movements.filter(m => m.sourceId === p.id);
      check(matches.length === 1, 'PAYMENT_MOVEMENT_COUNT', p.receiptNumber);
      const m = matches[0];
      if (!m) continue;
      check(m.id === p.movementId && equal(m.amount, p.amount) && m.branchId === b.branchId && m.direction === (p.isRefund ? 'OUT' : 'IN')
        && m.type === (p.isRefund ? 'BOOKING_REFUND' : 'BOOKING_ADVANCE'), 'PAYMENT_CUSTODY_MATCH', p.receiptNumber);
      check(p.method === 'CASH' ? m.drawerId === p.drawerId : m.accountId === p.paymentAccountId, 'PAYMENT_CHANNEL_MATCH', p.receiptNumber);
    }
  }
  for (const m of movements) check(payments.some(p => p.id === m.sourceId), 'ORPHAN_BOOKING_MOVEMENT', m.reference);
  const stats = await clientStats(clientIds);
  for (const id of clientIds) {
    const pending = bookings.filter(b => b.clientId === id && !b.invoice && ['CONFIRMED', 'IN_PROGRESS'].includes(b.status));
    const expected = pending.reduce((sum, b) => sum.plus(netPayments(b.payments)), toDec(0));
    check(equal(stats.get(id)?.bookingAdvanceBalance || 0, expected), 'CLIENT_ADVANCE_BALANCE', id);
    const entries = buildClientLedger({ bookings: bookings.filter(b => b.clientId === id).map(toBookingDTO), invoices: invoices.filter(i => i.clientId === id) });
    const expectedLedger = toDec(stats.get(id)?.outstandingBalance || 0).minus(expected);
    check(equal(entries[0]?.balance || 0, expectedLedger), 'CLIENT_LEDGER_BALANCE', id);
  }
  result.counts.clientLedgersChecked = clientIds.length;
  const dates = [...payments.map(p => ymd(p.date)), ...movements.map(m => m.createdAt.toISOString().slice(0, 10))].sort();
  if (dates.length) {
    const query = { startDate: dates[0], endDate: dates.at(-1) };
    const report = await incomeExpenseReport(actor, query);
    const rows = report.rows.filter(r => r.source === 'BOOKING' && r.type === 'SETTLEMENT');
    const sum = rows.reduce((total, r) => total.plus(r.cashFlow || 0), toDec(0));
    result.totals.reportBookingCashFlow = Number(sum);
    check(equal(sum, net(movements)), 'REPORT_BOOKING_CASH_FLOW', 'income-expense');
    check(rows.every(r => r.income === 0 && r.expense === 0), 'ADVANCE_RECOGNIZED_AS_REVENUE', 'income-expense');
    check(rows.length === movements.length, 'REPORT_BOOKING_RECEIPT_COUNT', 'income-expense');
  }
  if (superUser) {
    const token = jwt.sign({ sub: superUser.id }, env.jwtAccessSecret, { expiresIn: '5m' });
    const get = async endpoint => {
      const response = await fetch(`http://localhost:${env.port}/api/v1${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status} ${body.error?.code || ''}`);
      return body.data;
    };
    try {
      const live = await get('/bookings'); const receipts = await get('/bookings/collections');
      result.api.bookings = live.length; result.api.receipts = receipts.length;
      check(live.length === bookings.length, 'LIVE_API_BOOKING_COUNT', '/bookings');
      check(receipts.length === payments.length, 'LIVE_API_RECEIPT_COUNT', '/bookings/collections');
      for (const b of bookings) {
        const liveBooking = live.find(row => row.id === b.id);
        check(liveBooking && equal(liveBooking.remainingBalance, toBookingDTO(b).remainingBalance), 'LIVE_API_BALANCE', b.bookingNumber);
      }
      const linked = bookings.filter(b => b.invoice).map(b => b.invoice);
      if (linked.length) {
        const invoiceDates = linked.map(i => ymd(i.date)).sort();
        const sales = await get(`/reports/sales-invoices?startDate=${invoiceDates[0]}&endDate=${invoiceDates.at(-1)}`);
        const rows = sales.rows.filter(r => linked.some(i => i.id === r.id));
        result.api.bookingSalesReportRows = rows.length;
        check(rows.length === linked.length, 'SALES_REPORT_LINKED_INVOICES', 'sales-invoices');
      }
      result.api.status = 'passed';
    } catch (e) { result.api.status = 'failed'; result.api.error = e.message; }
  }
  if (process.argv.includes('--browser') && superUser) {
    const { pathToFileURL } = await import('node:url');
    const modulePath = process.argv[process.argv.indexOf('--browser') + 1];
    const { chromium } = await import(pathToFileURL(path.join(modulePath, 'index.mjs')).href);
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const token = jwt.sign({ sub: superUser.id }, env.jwtAccessSecret, { expiresIn: '5m' });
    result.browser = { realApi: true, mockedData: false, writesBlocked: true, clientLedgers: 0, errors: [] };
    try {
      const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      page.on('pageerror', e => result.browser.errors.push(e.message));
      await page.addInitScript(value => sessionStorage.setItem('salonos_access_token', value), token);
      await page.route('**/api/v1/**', async route => {
        if (route.request().method() !== 'GET') return route.abort();
        return route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${token}` } });
      });
      for (const client of clients) {
        await page.goto('http://localhost:3001/operations/clients');
        await page.getByPlaceholder('Search name, phone, email...').fill(client.name);
        const row = page.locator('tr').filter({ has: page.getByText(client.name, { exact: true }) });
        await row.getByTitle('View History & Invoices').first().click();
        const balance = page.getByTestId('client-ledger-closing-balance');
        await balance.waitFor();
        const value = Number((await balance.textContent()).replace(/[^\d.\-]/g, ''));
        const pending = bookings.filter(b => b.clientId === client.id && !b.invoice && ['CONFIRMED', 'IN_PROGRESS'].includes(b.status));
        const held = pending.reduce((n, b) => n.plus(netPayments(b.payments)), toDec(0));
        check(equal(value, toDec(stats.get(client.id)?.outstandingBalance || 0).minus(held)), 'BROWSER_CLIENT_LEDGER', client.id);
        result.browser.clientLedgers += 1;
      }
      if (dates.length) {
        await page.goto('http://localhost:3001/reports/income-expense');
        const inputs = page.locator('form input[type="date"]');
        await inputs.nth(0).fill(dates[0]); await inputs.nth(1).fill(dates.at(-1));
        const response = page.waitForResponse(r => r.url().includes('/reports/income-expense?') && r.request().method() === 'GET' && r.url().includes(`startDate=${dates[0]}`));
        await page.getByRole('button', { name: 'Filter', exact: true }).click();
        const reportResponse = await response;
        check(reportResponse.ok(), 'BROWSER_REPORT_API', 'income-expense');
        const reportBody = await reportResponse.json();
        const rows = reportBody.data.rows.filter(r => r.source === 'BOOKING' && r.type === 'SETTLEMENT');
        const rendered = page.locator('tbody tr').filter({ hasText: /BOOKING (ADVANCE|REFUND)/ });
        await rendered.first().waitFor();
        let displayed = 0;
        for (let i = 0; i < await rendered.count(); i++) {
          const row = rendered.nth(i);
          const amount = Number((await row.locator('td').nth(8).textContent()).replace(/[^\d.\-]/g, ''));
          displayed += amount;
          check(equal(Number((await row.locator('td').nth(7).textContent()).replace(/[^\d.\-]/g, '')), 0), 'BROWSER_DEPOSIT_IS_NOT_REVENUE', 'income-expense');
        }
        check(equal(displayed, rows.reduce((sum, r) => sum + r.cashFlow, 0)), 'BROWSER_REPORT_CASH_FLOW', 'income-expense');
        result.browser.reportBookingReceipts = rows.length;
        result.browser.reportDisplayedBookingCashFlow = displayed;
      }
      check(result.browser.errors.length === 0, 'BROWSER_RUNTIME_ERROR', 'client-ledgers');
      result.browser.status = 'passed';
    } catch (e) {
      result.browser.status = 'failed'; result.browser.error = e.message.split('\n')[0];
      check(false, 'BROWSER_WALKTHROUGH_FAILED', 'client-ledgers');
    } finally { await browser.close(); }
  }
  result.status = result.issues.length || result.api.status === 'failed' ? 'issues-found' : 'passed';
  fs.mkdirSync('../artifacts', { recursive: true });
  fs.writeFileSync('../artifacts/booking-data-audit.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'passed') process.exitCode = 1;
} finally { await prisma.$disconnect(); }
