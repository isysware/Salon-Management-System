import type { Booking } from '../../types/booking';
import type { Invoice } from '../../types/salon';

export interface ClientLedgerEntry {
  id: string; date: string; time: string; type: 'INVOICE' | 'PAYMENT';
  reference: string; description: string; debit: number; credit: number; balance: number;
  status: string; method?: string; processedBy?: string; rawInvoice?: Invoice;
}
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const localStamp = (stamp?: string) => {
  const date = stamp ? new Date(stamp) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).format(date),
  };
};
const minutes = (time: string) => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(match[2]);
};

/** Unapplied deposits are customer credits. Booking commitments stay separate from invoice dues. */
export function buildClientLedger(details: { invoices: Invoice[]; bookings?: Booking[] }): ClientLedgerEntry[] {
  const rows: ClientLedgerEntry[] = [];
  const recordedNet = new Map<string, number>();
  const invoiceBooking = new Map<string, string>();
  const push = (row: Omit<ClientLedgerEntry, 'balance'>) => rows.push({ ...row, balance: 0 });
  for (const b of details.bookings || []) {
    if (b.linkedInvoiceId) invoiceBooking.set(b.linkedInvoiceId, b.id);
    for (const p of b.payments || []) {
      recordedNet.set(b.id, round((recordedNet.get(b.id) || 0) + (p.isRefund ? -p.amount : p.amount)));
      push({ id: `booking-pay-${p.id}`, date: p.date, time: p.time || '00:00', type: p.isRefund ? 'INVOICE' : 'PAYMENT',
        reference: p.receiptNumber || b.bookingNumber,
        description: `${p.isRefund ? 'Booking advance refund' : 'Booking advance payment'} (${b.bookingNumber} · ${p.method})`,
        debit: p.isRefund ? p.amount : 0, credit: p.isRefund ? 0 : p.amount, status: p.isRefund ? 'REFUNDED' : 'CLEARED', method: p.method, processedBy: p.processedByName });
    }
    if (['CANCELLED', 'NO_SHOW'].includes(b.status) && b.cancellationCharge > 0) {
      const event = b.history?.find(h => h.type === 'BOOKING_CANCELLED');
      const stamp = localStamp(event?.createdAt || b.updatedAt || b.createdAt);
      push({ id: `booking-fee-${b.id}`, date: typeof event?.after?.date === 'string' ? event.after.date : stamp.date || b.eventDate, time: stamp.time || '00:00', type: 'INVOICE', reference: b.bookingNumber,
        description: `Approved booking cancellation charge (${event?.reason || b.cancellationReason || b.status})`,
        debit: b.cancellationCharge, credit: 0, status: 'PAID', processedBy: event?.userName });
    }
  }
  for (const inv of details.invoices) {
    push({ id: `inv-${inv.id}`, date: inv.date, time: inv.time || '00:00', type: 'INVOICE', reference: inv.invoiceNumber,
      description: `Sales bill (${inv.lineItems?.length || inv.lines?.length || 1} items; tips separate)`, debit: round(inv.total - (inv.tip || 0)), credit: 0,
      status: inv.lifecycle === 'VOIDED' ? 'VOIDED' : inv.status, processedBy: inv.processedByName, rawInvoice: inv });
    if (inv.advanceAdjusted) {
      const bookingId = inv.bookingId || invoiceBooking.get(inv.id);
      const alreadyRecorded = bookingId ? recordedNet.get(bookingId) || 0 : 0;
      push({ id: `advance-${inv.id}`, date: inv.date, time: inv.time || '00:00', type: 'PAYMENT', reference: inv.invoiceNumber,
        description: 'Prior booking advance applied to this invoice', debit: 0, credit: round(Math.max(0, inv.advanceAdjusted - alreadyRecorded)), status: 'APPLIED', rawInvoice: inv });
    }
    for (const p of inv.payments || []) {
      const billAmount = p.billAmountAllocated ?? round(p.amount - (p.tipAmountAllocated || 0));
      push({ id: `pay-${p.id}`, date: p.date, time: p.time || '00:00', type: 'PAYMENT', reference: p.receiptNumber || inv.invoiceNumber,
        description: `${p.kind === 'DUES_COLLECTION' ? 'Dues collection' : 'POS payment'} (${p.method})`, debit: 0, credit: billAmount,
        status: p.reversedAt ? 'REVERSED' : 'CLEARED', method: p.method, processedBy: p.processedByName, rawInvoice: inv });
      if (p.reversedAt) {
        const stamp = localStamp(p.reversedAt);
        push({ id: `rev-${p.id}`, date: p.reversalDate || stamp.date, time: stamp.time, type: 'INVOICE', reference: p.receiptNumber || inv.invoiceNumber,
          description: `Collection reversed: ${p.reversalReason || ''}`, debit: billAmount, credit: 0, status: 'REVERSED', processedBy: p.reversedByName, rawInvoice: inv });
      }
    }
    for (const refund of inv.refunds || []) {
      const stamp = localStamp(refund.createdAt);
      push({ id: `refund-charge-${refund.id}`, date: refund.refundDate, time: stamp.time, type: 'PAYMENT', reference: refund.refundNumber,
        description: `${refund.type === 'VOID' ? 'Invoice void' : 'Service refund'}: charges reversed (${refund.reason})`, debit: 0,
        credit: round(refund.netReversed + refund.taxReversed), status: refund.type === 'VOID' ? 'VOIDED' : 'REFUNDED', processedBy: refund.byName, rawInvoice: inv });
      const billCashOut = round(refund.cashOut - (refund.tipReversed || 0));
      if (billCashOut > 0) push({ id: `refund-cash-${refund.id}`, date: refund.refundDate, time: stamp.time, type: 'INVOICE', reference: refund.refundNumber,
        description: `Refund paid to client (${refund.method || 'CASH'})`, debit: billCashOut, credit: 0, status: 'REFUNDED', method: refund.method, processedBy: refund.byName, rawInvoice: inv });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time));
  let balance = 0;
  for (const row of rows) { balance = round(balance + row.debit - row.credit); row.balance = balance; }
  return rows.reverse();
}

export interface InstallmentRecord {
  id: string;
  date: string;
  time: string;
  receiptNumber?: string;
  reference: string;
  type: 'BOOKING_ADVANCE' | 'POS_PAYMENT' | 'DUES_COLLECTION' | 'ADVANCE_ADJUSTED' | 'REFUND' | 'REVERSAL' | 'CANCELLATION_CHARGE';
  description: string;
  method?: string;
  amount: number;
  processedByName?: string;
  status: string;
  isAuditOnly?: boolean;
}

export interface ConsolidatedLedgerRow {
  id: string;
  date: string;
  time: string;
  clientName: string;
  reference: string;
  invoiceNumber?: string;
  bookingNumber?: string;
  bookingType?: string;
  type: 'BOOKING_INVOICE' | 'INVOICE' | 'BOOKING';
  description: string;
  totalAmount: number;
  advancePaid: number;
  furtherPayments: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
  rawInvoice?: Invoice;
  rawBooking?: Booking;
  installments: InstallmentRecord[];
}

/**
 * Builds a consolidated Khata ledger view: one row per booking / invoice.
 * Correctly distinguishes Advance Paid vs Further Payments and prevents double-counting advance adjustments.
 * Preserves all underlying installment records for expandable inspection.
 */
export function buildConsolidatedClientLedger(details: {
  client?: { name?: string };
  invoices: Invoice[];
  bookings?: Booking[];
}): ConsolidatedLedgerRow[] {
  const clientName = details.client?.name || 'Customer';
  const rows: ConsolidatedLedgerRow[] = [];
  const matchedBookingIds = new Set<string>();

  const allBookings = details.bookings || [];
  const allInvoices = details.invoices || [];

  // Index bookings by ID, bookingNumber, and linkedInvoiceId
  const bookingById = new Map<string, Booking>();
  for (const b of allBookings) {
    bookingById.set(b.id, b);
    if (b.bookingNumber) bookingById.set(b.bookingNumber, b);
    if (b.linkedInvoiceId) bookingById.set(`inv-${b.linkedInvoiceId}`, b);
  }

  // 1. Process all Invoices (including linked bookings)
  for (const inv of allInvoices) {
    // Check if linked to a booking
    let matchedBooking: Booking | undefined;
    if (inv.bookingId && bookingById.has(inv.bookingId)) {
      matchedBooking = bookingById.get(inv.bookingId);
    } else if (bookingById.has(`inv-${inv.id}`)) {
      matchedBooking = bookingById.get(`inv-${inv.id}`);
    } else {
      matchedBooking = allBookings.find(
        (b) => b.linkedInvoiceId === inv.id || b.linkedInvoiceNumber === inv.invoiceNumber
      );
    }

    if (matchedBooking) {
      matchedBookingIds.add(matchedBooking.id);
    }

    // Bill total excluding gratuity/tips
    const billTotal = round(inv.total - (inv.tip || 0));
    const totalAmount = billTotal > 0 ? billTotal : (matchedBooking ? round(matchedBooking.totalAmount) : round(inv.total));

    // Calculate Advance Paid
    let advancePaid = 0;
    const installments: InstallmentRecord[] = [];

    if (matchedBooking) {
      const bPayments = matchedBooking.payments || [];
      const netAdvance = bPayments.reduce((sum, p) => sum + (p.isRefund ? -p.amount : p.amount), 0);
      advancePaid = round(Math.max(0, netAdvance));
      if (advancePaid === 0 && (inv.advanceAdjusted || 0) > 0) {
        advancePaid = round(inv.advanceAdjusted);
      }

      // Add booking advance payments to installment history
      for (const p of bPayments) {
        installments.push({
          id: `bp-${p.id}`,
          date: p.date,
          time: p.time || '00:00',
          receiptNumber: p.receiptNumber || matchedBooking.bookingNumber,
          reference: matchedBooking.bookingNumber,
          type: p.isRefund ? 'REFUND' : 'BOOKING_ADVANCE',
          description: p.isRefund ? 'Booking advance refund' : `Booking advance deposit (${matchedBooking.bookingNumber} · ${p.method || 'CASH'})`,
          method: p.method || 'CASH',
          amount: p.amount,
          processedByName: p.processedByName,
          status: p.isRefund ? 'REFUNDED' : 'CLEARED',
        });
      }

      // Include advance adjustment record for audit visibility (marked isAuditOnly to prevent double-counting)
      if (inv.advanceAdjusted && inv.advanceAdjusted > 0) {
        installments.push({
          id: `adj-${inv.id}`,
          date: inv.date,
          time: inv.time || '00:00',
          receiptNumber: inv.invoiceNumber,
          reference: inv.invoiceNumber,
          type: 'ADVANCE_ADJUSTED',
          description: `Booking advance applied to bill ${inv.invoiceNumber}`,
          method: 'ADVANCE_CREDIT',
          amount: round(inv.advanceAdjusted),
          processedByName: inv.processedByName,
          status: 'APPLIED',
          isAuditOnly: true,
        });
      }
    } else if (inv.advanceAdjusted && inv.advanceAdjusted > 0) {
      advancePaid = round(inv.advanceAdjusted);
      installments.push({
        id: `adj-${inv.id}`,
        date: inv.date,
        time: inv.time || '00:00',
        receiptNumber: inv.invoiceNumber,
        reference: inv.invoiceNumber,
        type: 'ADVANCE_ADJUSTED',
        description: 'Prior advance credit applied to invoice',
        method: 'ADVANCE_CREDIT',
        amount: round(inv.advanceAdjusted),
        processedByName: inv.processedByName,
        status: 'APPLIED',
        isAuditOnly: true,
      });
    }

    // Calculate Further Payments (POS payments + Dues collections, excluding tips and advance adjustments)
    let furtherPayments = 0;
    for (const p of inv.payments || []) {
      if (p.kind === 'ADVANCE_ADJUSTMENT' || p.reversedAt) continue;
      const billAlloc = p.billAmountAllocated !== undefined ? Number(p.billAmountAllocated) : round(p.amount - (p.tipAmountAllocated || 0));
      furtherPayments = round(furtherPayments + billAlloc);

      installments.push({
        id: `ip-${p.id}`,
        date: p.date,
        time: p.time || '00:00',
        receiptNumber: p.receiptNumber || inv.invoiceNumber,
        reference: inv.invoiceNumber,
        type: p.kind === 'DUES_COLLECTION' ? 'DUES_COLLECTION' : 'POS_PAYMENT',
        description: p.kind === 'DUES_COLLECTION' ? `Dues collection payment (${p.method})` : `POS checkout payment (${p.method})`,
        method: p.method,
        amount: billAlloc,
        processedByName: p.processedByName,
        status: 'CLEARED',
      });
    }

    // Subtract refunds from further payments if any
    for (const r of inv.refunds || []) {
      const refundAmt = round((r.cashOut || 0) - (r.tipReversed || 0));
      if (refundAmt > 0) {
        furtherPayments = round(Math.max(0, furtherPayments - refundAmt));
      }
      installments.push({
        id: `ref-${r.id}`,
        date: r.refundDate,
        time: '00:00',
        receiptNumber: r.refundNumber,
        reference: inv.invoiceNumber,
        type: 'REFUND',
        description: `Refund: ${r.reason || 'Service refund'}`,
        method: r.method,
        amount: refundAmt,
        processedByName: r.byName,
        status: 'REFUNDED',
      });
    }

    const totalPaid = round(advancePaid + furtherPayments);
    const remainingBalance = round(Math.max(0, totalAmount - totalPaid));

    let status = inv.status;
    if (inv.lifecycle === 'VOIDED') status = 'VOIDED';
    else if (remainingBalance <= 0.01) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    else status = 'UNPAID';

    installments.sort((a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time));

    const ref = matchedBooking
      ? `${inv.invoiceNumber} (${matchedBooking.bookingNumber})`
      : inv.invoiceNumber;

    rows.push({
      id: `row-inv-${inv.id}`,
      date: inv.date,
      time: inv.time || '00:00',
      clientName: inv.clientName || clientName,
      reference: ref,
      invoiceNumber: inv.invoiceNumber,
      bookingNumber: matchedBooking?.bookingNumber,
      bookingType: matchedBooking?.type,
      type: matchedBooking ? 'BOOKING_INVOICE' : 'INVOICE',
      description: matchedBooking
        ? `${matchedBooking.type} Booking · Invoiced in POS (${inv.lineItems?.length || inv.lines?.length || 1} items)`
        : `POS Sales Invoice (${inv.lineItems?.length || inv.lines?.length || 1} items)`,
      totalAmount,
      advancePaid,
      furtherPayments,
      totalPaid,
      remainingBalance,
      status,
      rawInvoice: inv,
      rawBooking: matchedBooking,
      installments,
    });
  }

  // 2. Process Standalone Bookings (Not yet billed)
  for (const b of allBookings) {
    if (matchedBookingIds.has(b.id)) continue;
    matchedBookingIds.add(b.id);

    const bPayments = b.payments || [];
    const netAdvance = bPayments.reduce((sum, p) => sum + (p.isRefund ? -p.amount : p.amount), 0);
    const advancePaid = round(Math.max(0, netAdvance || b.receivedAmount || b.advancePaid || 0));
    const totalAmount = round(b.totalAmount);
    const furtherPayments = 0;
    const totalPaid = advancePaid;
    const remainingBalance = round(Math.max(0, totalAmount - totalPaid));

    const installments: InstallmentRecord[] = [];
    for (const p of bPayments) {
      installments.push({
        id: `bp-${p.id}`,
        date: p.date,
        time: p.time || '00:00',
        receiptNumber: p.receiptNumber || b.bookingNumber,
        reference: b.bookingNumber,
        type: p.isRefund ? 'REFUND' : 'BOOKING_ADVANCE',
        description: p.isRefund ? 'Booking advance refund' : `Booking advance deposit (${b.bookingNumber} · ${p.method || 'CASH'})`,
        method: p.method || 'CASH',
        amount: p.amount,
        processedByName: p.processedByName,
        status: p.isRefund ? 'REFUNDED' : 'CLEARED',
      });
    }

    if (['CANCELLED', 'NO_SHOW'].includes(b.status) && (b.cancellationCharge || 0) > 0) {
      installments.push({
        id: `fee-${b.id}`,
        date: b.eventDate,
        time: '00:00',
        receiptNumber: b.bookingNumber,
        reference: b.bookingNumber,
        type: 'CANCELLATION_CHARGE',
        description: `Cancellation fee: ${b.cancellationReason || b.status}`,
        amount: b.cancellationCharge,
        status: 'CHARGED',
      });
    }

    let status = b.status;
    if (remainingBalance <= 0.01 && totalPaid > 0) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';

    installments.sort((a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time));

    rows.push({
      id: `row-bkg-${b.id}`,
      date: b.eventDate,
      time: b.serviceTime || '10:00 AM',
      clientName: b.clientName || clientName,
      reference: b.bookingNumber,
      bookingNumber: b.bookingNumber,
      bookingType: b.type,
      type: 'BOOKING',
      description: `${b.type} Reservation (Event Date: ${b.eventDate})`,
      totalAmount,
      advancePaid,
      furtherPayments,
      totalPaid,
      remainingBalance,
      status,
      rawBooking: b,
      installments,
    });
  }

  // Sort rows descending by date & time (most recent first)
  rows.sort((a, b) => b.date.localeCompare(a.date) || minutes(b.time) - minutes(a.time));
  return rows;
}

