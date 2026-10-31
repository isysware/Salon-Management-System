import { describe, it, expect } from 'vitest';
import { buildClientLedger, buildConsolidatedClientLedger } from '../../frontend/src/features/clients/clientLedger.ts';
const payment = (id, amount, extra = {}) => ({ id, amount, date: '2026-10-25', time: '10:00 AM', method: 'CASH', ...extra });
const booking = (id, extra = {}) => ({ id, bookingNumber: id, type: 'BRIDAL', status: 'CONFIRMED', eventDate: '2026-11-01', cancellationCharge: 0, payments: [], history: [], ...extra });
const invoice = (id, extra = {}) => ({ id, invoiceNumber: id, date: '2026-10-25', time: '11:00 AM', total: 1000, tip: 0, status: 'PARTIAL', amountDue: 1000, payments: [], refunds: [], ...extra });
const closing = details => buildClientLedger(details)[0]?.balance || 0;
describe('Client ledger booking, refund and invoice reconciliation', () => {
  it('scopes already-recorded advance credits to the matching booking only', () => {
    const details = { bookings: [booking('b1', { linkedInvoiceId: 'i1', payments: [payment('advance1', 100)] })],
      invoices: [invoice('i1', { bookingId: 'b1', total: 100, amountDue: 0, advanceAdjusted: 100 }), invoice('i2', { bookingId: 'b2', advanceAdjusted: 200, amountDue: 800 })] };
    const entries = buildClientLedger(details);
    expect(entries.find(e => e.id === 'advance-i1').credit).toBe(0);
    expect(entries.find(e => e.id === 'advance-i2').credit).toBe(200);
    expect(closing(details)).toBe(800);
  });
  it('balances retained cancellation fees against receipts and refunds', () => {
    expect(closing({ invoices: [], bookings: [booking('cancel', { status: 'CANCELLED', cancellationCharge: 300,
      history: [{ type: 'BOOKING_CANCELLED', createdAt: '2026-10-25T08:00:00Z', reason: 'Cancelled' }], payments: [payment('advance', 5000), payment('refund', 4700, { isRefund: true })] })] })).toBe(0);
  });
  it('keeps an unapplied active booking advance as a separate customer credit', () => {
    expect(closing({ invoices: [], bookings: [booking('pending', { payments: [payment('deposit', 500)] })] })).toBe(-500);
  });
  it('voids unpaid receivables and records returned cash without treating tips as dues', () => {
    const inv = invoice('voided', { lifecycle: 'VOIDED', total: 1100, tip: 100, amountDue: 0,
      payments: [payment('p', 500, { billAmountAllocated: 400, tipAmountAllocated: 100 })],
      refunds: [{ id: 'r', refundNumber: 'RF', type: 'VOID', refundDate: '2026-10-25', createdAt: '2026-10-25T08:00:00Z', netReversed: 1000, taxReversed: 0, tipReversed: 100, cashOut: 500, reason: 'Void' }] });
    expect(closing({ invoices: [inv] })).toBe(0);
    const entries = buildClientLedger({ invoices: [inv] });
    expect(entries.find(e => e.id === 'refund-cash-r').debit).toBe(400);
    expect(entries.find(e => e.id === 'inv-voided').debit).toBe(1000);
  });
  it('restores dues once when a collection is reversed', () => {
    const inv = invoice('dues', { payments: [payment('sale', 200), payment('collection', 300, { kind: 'DUES_COLLECTION', reversedAt: '2026-10-25T09:00:00Z', reversalDate: '2026-10-25' })] });
    expect(closing({ invoices: [inv] })).toBe(800);
  });
  it('sorts AM/PM times chronologically rather than alphabetically', () => {
    const inv = invoice('timing', { time: '09:00 AM', payments: [payment('late', 100, { time: '02:00 PM' }), payment('early', 100, { time: '11:00 AM' })] });
    expect(buildClientLedger({ invoices: [inv] }).map(e => e.id)).toEqual(['pay-late', 'pay-early', 'inv-timing']);
  });
});

describe('Consolidated Client Ledger (Khata View)', () => {
  it('consolidates linked booking and invoice with exact user example: 10,000 total | 5,000 advance | 5,000 further payment | 10,000 paid | 0 remaining', () => {
    const details = {
      client: { name: 'Aaliyan' },
      bookings: [
        booking('bkg-1', {
          bookingNumber: 'BKG-0006',
          totalAmount: 10000,
          advancePaid: 5000,
          payments: [
            payment('adv-1', 5000, { receiptNumber: 'BPR-0006', time: '10:00 AM' }),
          ],
        }),
      ],
      invoices: [
        invoice('inv-1', {
          invoiceNumber: 'INV-0005',
          bookingId: 'bkg-1',
          total: 10000,
          subtotal: 10000,
          advanceAdjusted: 5000,
          amountDue: 0,
          status: 'PAID',
          payments: [
            payment('pay-1', 5000, { receiptNumber: 'RCP-0005', time: '12:00 PM', billAmountAllocated: 5000 }),
          ],
        }),
      ],
    };

    const rows = buildConsolidatedClientLedger(details);
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.clientName).toBe('Aaliyan');
    expect(row.reference).toBe('INV-0005 (BKG-0006)');
    expect(row.totalAmount).toBe(10000);
    expect(row.advancePaid).toBe(5000);
    expect(row.furtherPayments).toBe(5000);
    expect(row.totalPaid).toBe(10000);
    expect(row.remainingBalance).toBe(0);
    expect(row.status).toBe('PAID');

    // Preserves original installment records in expandable history
    expect(row.installments.length).toBeGreaterThanOrEqual(2);
    const advanceRec = row.installments.find(i => i.type === 'BOOKING_ADVANCE');
    expect(advanceRec).toBeDefined();
    expect(advanceRec?.amount).toBe(5000);
    expect(advanceRec?.receiptNumber).toBe('BPR-0006');

    const furtherRec = row.installments.find(i => i.type === 'POS_PAYMENT');
    expect(furtherRec).toBeDefined();
    expect(furtherRec?.amount).toBe(5000);
    expect(furtherRec?.receiptNumber).toBe('RCP-0005');

    // Advance adjustment is tracked as audit record without double-counting
    const auditRec = row.installments.find(i => i.isAuditOnly);
    expect(auditRec).toBeDefined();
    expect(auditRec?.amount).toBe(5000);
  });
});

