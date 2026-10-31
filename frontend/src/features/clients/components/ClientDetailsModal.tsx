import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Client, Invoice } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Phone,
  Mail,
  Calendar,
  Receipt,
  CreditCard,
  Clock,
  Scissors,
  Building2,
  Tag,
  AlertCircle,
  Plus,
  Edit,
  ExternalLink,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle2,
  BookOpen,
  Wallet,
  Sparkles,
  UserCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { CollectDuesModal } from './CollectDuesModal';
import { buildClientLedger, buildConsolidatedClientLedger, ConsolidatedLedgerRow } from '../clientLedger';
import { BookingDetailsModal } from '../../bookings/BookingDetailsModal';
import type { Booking } from '@/types/booking';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  onEdit: (client: Client) => void;
  onBookAppointment: (client: Client) => void;
  onOpenPOS: (client: Client) => void;
  onRefreshList: () => void;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  isOpen,
  onClose,
  clientId,
  onEdit,
  onBookAppointment,
  onOpenPOS,
  onRefreshList,
}) => {
  const { user, allBranches } = useAuth();
  const { navigate } = useRouter();

  const [selectedBookingForView, setSelectedBookingForView] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'receipts' | 'dues' | 'appointments' | 'bookings'>('ledger');
  const [reversalError, setReversalError] = useState('');
  const [reversing, setReversing] = useState(false);
  const reversalBusy = React.useRef(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState('');
  const [details, setDetails] = useState<{
    client: Client;
    bookings?: import('@/types/booking').Booking[];
    appointments: Appointment[];
    invoices: Invoice[];
    receipts: any[];
    outstandingInvoices: Invoice[];
    visitCount: number;
    lastVisitDate?: string;
    totalSpend: number;
  } | null>(null);

  // Collect Dues submodal
  const [selectedInvoiceForDues, setSelectedInvoiceForDues] = useState<Invoice | null>(null);

  const loadClientDetails = async () => {
    if (!clientId) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await salonService.getClientDetails(clientId, user || undefined);
      setDetails(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the client ledger.');
      console.error('Failed to load client details', err);
    } finally {
      setLoading(false);
    }
  };

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRowExpand = (rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (isOpen && clientId) {
      loadClientDetails();
      setActiveTab('ledger');
      setExpandedRowIds(new Set());
    } else {
      setDetails(null);
      setExpandedRowIds(new Set());
    }
  }, [isOpen, clientId]);

  const ledgerEntries = useMemo(() => details ? buildClientLedger(details) : [], [details]);
  const consolidatedRows = useMemo(() => details ? buildConsolidatedClientLedger(details) : [], [details]);

  const summaryTotals = useMemo(() => {
    return consolidatedRows.reduce(
      (acc, row) => ({
        totalAmount: acc.totalAmount + row.totalAmount,
        advancePaid: acc.advancePaid + row.advancePaid,
        furtherPayments: acc.furtherPayments + row.furtherPayments,
        totalPaid: acc.totalPaid + row.totalPaid,
        remainingBalance: acc.remainingBalance + row.remainingBalance,
      }),
      {
        totalAmount: 0,
        advancePaid: 0,
        furtherPayments: 0,
        totalPaid: 0,
        remainingBalance: 0,
      }
    );
  }, [consolidatedRows]);

  const reverseReceipt = async (receipt: any) => {
    if (reversalBusy.current || !salonService.reverseCollection) return;
    const reason = window.prompt('Reason for reversing this collection:');
    if (!reason || reason.trim().length < 3) return;
    reversalBusy.current = true; setReversing(true); setReversalError('');
    try {
      await salonService.reverseCollection(receipt.invoiceId, receipt.id, { reason: reason.trim(), reversalDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }), idempotencyKey: 'reverse-collection-' + receipt.id });
      await loadClientDetails(); onRefreshList?.();
    } catch (error: any) { setReversalError(error.message || 'Reversal failed.'); }
    finally { reversalBusy.current = false; setReversing(false); }
  };
  if (!isOpen) return null;

  const client = details?.client;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-7">
        {loadError ? <div role="alert" className="space-y-3 p-6 text-sm text-rose-700"><p>{loadError}</p><Button variant="outline" onClick={() => void loadClientDetails()}>Retry loading client ledger</Button></div> : loading || !client ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-[#9D2558] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading customer profile & history...</p>
          </div>
        ) : (
          <div className="space-y-5 min-w-0 w-full max-w-full">
            {/* Header Profile Info */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-200 pr-8 sm:pr-10 min-w-0">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-[#FCE8EC] text-[#851C47] flex items-center justify-center text-lg font-bold shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{client.name}</h2>
                    {client.isArchived && (
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] shrink-0">
                        Archived
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-[#FDF2F5] text-[#851C47] border-[#F1DEE3] text-[10px] shrink-0">
                      {client.source || 'WALK_IN'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700 whitespace-nowrap">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {formatPhoneNumber(client.phone)}
                    </span>
                    {client.email && (
                      <span className="flex items-center gap-1 truncate max-w-xs">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {client.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {allBranches?.find((b) => b.id === client.branchId)?.name || 'Meerub Salon'}
                    </span>
                  </div>

                  {client.notes && (
                    <p className="text-xs text-slate-600 italic bg-amber-50/70 border border-amber-200/60 p-1.5 rounded-md mt-2 max-w-xl break-words">
                      Note: {client.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap md:justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(client)}
                  className="h-8 text-xs gap-1 shrink-0"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Profile
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onBookAppointment(client);
                  }}
                  className="h-8 bg-[#9D2558] hover:bg-[#851C47] text-white text-xs gap-1 font-semibold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Appointment
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenPOS(client);
                  }}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-semibold shrink-0"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Open in POS
                </Button>
              </div>
            </div>

            {!!details.bookings?.length && (
              <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 sm:p-4 space-y-2.5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-violet-950">
                    Bridal / Groom booking commitments
                  </h3>
                  <span className="text-[11px] text-violet-700 font-medium">
                    {details.bookings.length} reservation{details.bookings.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Pending reservations are separate from invoiced dues. Each booking has its own installment and adjustment ledger.
                </p>
                <div className="space-y-2 pt-1">
                  {details.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="text-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-t border-violet-200/70 pt-2.5 min-w-0"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-semibold text-slate-800 font-mono">{b.bookingNumber}</span>
                        <Badge variant="outline" className="bg-white/80 text-violet-800 border-violet-200 text-[10px] font-bold shrink-0">
                          {b.type}
                        </Badge>
                        <span className="text-slate-500 whitespace-nowrap">{b.eventDate}</span>
                        <Badge className="bg-violet-100 text-violet-800 border-violet-300 text-[10px] shrink-0">
                          {b.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                        <div className="text-left md:text-right text-[11px] sm:text-xs">
                          <span className="text-slate-600">Received <strong className="text-emerald-700 font-semibold">{formatCurrency(b.receivedAmount ?? b.advancePaid)}</strong></span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-600">Remaining <strong className="text-slate-900 font-semibold">{formatCurrency(b.remainingBalance)}</strong></span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onClose();
                            navigate(`/operations/bookings?clientId=${clientId}&bookingId=${b.id}`);
                          }}
                          className="h-7 text-xs bg-white hover:bg-violet-50 text-violet-900 border-violet-200 shrink-0"
                        >
                          View booking ledger
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* KPI Cards Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0 w-full">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg min-w-0 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                    Completed Visits
                  </span>
                  <span className="text-lg font-bold text-slate-900 mt-0.5 block truncate">
                    {details.visitCount}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate mt-1">
                  Last: {details.lastVisitDate || 'Never'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg min-w-0 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                    Total Spend (Net)
                  </span>
                  <span className="text-lg font-bold text-slate-900 mt-0.5 block truncate">
                    {formatCurrency(details.totalSpend)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate mt-1">Excl. taxes & gratuity</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg min-w-0 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                    Loyalty Points
                  </span>
                  <span className="text-lg font-bold text-purple-700 mt-0.5 block truncate">
                    {client.loyaltyPoints || 0} pts
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate mt-1">Current tier balance</span>
              </div>

              <div className={`p-3 rounded-lg border min-w-0 flex flex-col justify-between ${
                (client.outstandingBalance || 0) > 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider block truncate">
                      Outstanding Dues
                    </span>
                    {(client.outstandingBalance || 0) > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const firstUnpaid = details.outstandingInvoices[0];
                          if (firstUnpaid) setSelectedInvoiceForDues(firstUnpaid);
                        }}
                        className="h-6 px-2 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-2xs shrink-0"
                      >
                        Collect Dues
                      </Button>
                    )}
                  </div>
                  <span className="text-lg font-bold mt-0.5 block truncate">
                    {formatCurrency(client.outstandingBalance || 0)}
                  </span>
                </div>
                <span className="text-[10px] opacity-80 truncate mt-1">
                  {(client.outstandingBalance || 0) > 0 ? `${details.outstandingInvoices.length} unpaid bill(s)` : 'All cleared'}
                </span>
              </div>
            </div>

            {/* History Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold overflow-x-auto scrollbar-none w-full min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'ledger'
                    ? 'border-[#9D2558] text-[#9D2558]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Client Ledger / Khata ({consolidatedRows.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'invoices'
                    ? 'border-[#9D2558] text-[#9D2558]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Invoices ({details.invoices.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('receipts')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'receipts'
                    ? 'border-[#9D2558] text-[#9D2558]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Payments & Receipts ({details.receipts.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dues')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'dues'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Outstanding Dues ({details.outstandingInvoices.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appointments')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'appointments'
                    ? 'border-[#9D2558] text-[#9D2558]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Appointments ({details.appointments.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[240px]">
              {/* Tab 0: Client Ledger (Consolidated Khata Statement) */}
              {activeTab === 'ledger' && (
                <div className="space-y-3">
                  {/* Ledger Summary Cards Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                        Total Amount
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate font-mono">
                        {formatCurrency(summaryTotals.totalAmount)}
                      </span>
                    </div>

                    <div className="bg-violet-50/60 border border-violet-200/80 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider block truncate">
                        Advance Paid
                      </span>
                      <span className="text-sm font-bold text-violet-900 mt-0.5 block truncate font-mono">
                        {formatCurrency(summaryTotals.advancePaid)}
                      </span>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block truncate">
                        Further Payments
                      </span>
                      <span className="text-sm font-bold text-emerald-900 mt-0.5 block truncate font-mono">
                        {formatCurrency(summaryTotals.furtherPayments)}
                      </span>
                    </div>

                    <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider block truncate">
                        Total Paid
                      </span>
                      <span className="text-sm font-bold text-teal-900 mt-0.5 block truncate font-mono">
                        {formatCurrency(summaryTotals.totalPaid)}
                      </span>
                    </div>

                    <div className={`border rounded-lg p-2.5 ${
                      summaryTotals.remainingBalance > 0
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                        : 'bg-slate-50 border-slate-200/80 text-slate-900'
                    }`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wider block truncate">
                        Remaining Balance
                      </span>
                      <span className={`text-sm font-bold mt-0.5 block truncate font-mono ${
                        summaryTotals.remainingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(summaryTotals.remainingBalance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-1">
                    <span className="text-slate-500 font-medium">
                      One consolidated master row per booking/invoice with expandable installment history.
                    </span>
                    <span className="font-bold text-slate-800 font-mono" data-testid="client-ledger-closing-balance">
                      Ledger Balance: {formatCurrency(ledgerEntries[0]?.balance || 0)}
                    </span>
                  </div>

                  {(ledgerEntries[0]?.balance || 0) < 0 && (
                    <p className="text-xs text-emerald-700">
                      Negative balance represents customer advance credit. Invoiced dues are shown separately above.
                    </p>
                  )}

                  {consolidatedRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No ledger transactions found for this customer.
                    </div>
                  ) : (
                    <div className="w-full min-w-0 overflow-x-auto border border-slate-200/80 rounded-lg">
                      <table className="w-full min-w-[850px] text-left text-xs border-collapse divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                            <th className="py-2.5 px-2 w-8 text-center"></th>
                            <th className="py-2.5 px-2 sm:px-2.5">Date & Time</th>
                            <th className="py-2.5 px-2 sm:px-2.5">Client</th>
                            <th className="py-2.5 px-2 sm:px-2.5">Reference</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right">Total Amount</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right">Advance Paid</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right">Further Payments</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right">Total Paid</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right font-bold">Remaining Balance</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-center">Status</th>
                            <th className="py-2.5 px-2 sm:px-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {consolidatedRows.map((row) => {
                            const isExpanded = expandedRowIds.has(row.id);
                            return (
                              <React.Fragment key={row.id}>
                                <tr
                                  onClick={() => toggleRowExpand(row.id)}
                                  className={`cursor-pointer transition-colors ${
                                    isExpanded ? 'bg-pink-50/40 hover:bg-pink-50/60' : 'hover:bg-slate-50/70'
                                  }`}
                                >
                                  {/* Expand Chevron */}
                                  <td className="py-3 px-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRowExpand(row.id);
                                      }}
                                      className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 transition-colors"
                                      title={isExpanded ? 'Collapse installment history' : 'Expand installment history'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-[#9D2558]" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </td>

                                  {/* Date & Time */}
                                  <td className="py-2.5 px-2 sm:px-2.5 whitespace-nowrap text-slate-700">
                                    <span className="font-semibold block">{row.date}</span>
                                    <span className="text-[10px] text-slate-400">{row.time}</span>
                                  </td>

                                  {/* Client */}
                                  <td className="py-2.5 px-2 sm:px-2.5 whitespace-nowrap text-slate-800 font-medium">
                                    {row.clientName}
                                  </td>

                                  {/* Reference */}
                                  <td className="py-2.5 px-2 sm:px-2.5 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-bold text-slate-900">{row.reference}</span>
                                      {row.bookingType && (
                                        <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700 border-violet-200 font-bold">
                                          {row.bookingType}
                                        </Badge>
                                      )}
                                    </div>
                                    {row.description && (
                                      <span className="text-[10px] text-slate-500 block truncate max-w-[200px]" title={row.description}>
                                        {row.description}
                                      </span>
                                    )}
                                  </td>

                                  {/* Total Amount */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right font-mono font-bold whitespace-nowrap text-slate-900">
                                    {formatCurrency(row.totalAmount)}
                                  </td>

                                  {/* Advance Paid */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right font-mono whitespace-nowrap">
                                    {row.advancePaid > 0 ? (
                                      <span className="text-violet-700 font-semibold">{formatCurrency(row.advancePaid)}</span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>

                                  {/* Further Payments */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right font-mono whitespace-nowrap">
                                    {row.furtherPayments > 0 ? (
                                      <span className="text-emerald-700 font-semibold">{formatCurrency(row.furtherPayments)}</span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>

                                  {/* Total Paid */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right font-mono font-bold whitespace-nowrap">
                                    <span className="text-emerald-800">{formatCurrency(row.totalPaid)}</span>
                                  </td>

                                  {/* Remaining Balance */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right font-mono font-bold whitespace-nowrap">
                                    {row.remainingBalance > 0 ? (
                                      <span className="text-rose-600">{formatCurrency(row.remainingBalance)}</span>
                                    ) : (
                                      <span className="text-emerald-600">0.00</span>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="py-2.5 px-2 sm:px-2.5 whitespace-nowrap text-center">
                                    {row.status === 'PAID' ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                        PAID
                                      </Badge>
                                    ) : row.status === 'PARTIAL' ? (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                        PARTIAL
                                      </Badge>
                                    ) : row.status === 'UNPAID' ? (
                                      <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold">
                                        UNPAID
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] font-semibold text-slate-700 bg-slate-50 border-slate-200">
                                        {row.status}
                                      </Badge>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-2.5 px-2 sm:px-2.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => toggleRowExpand(row.id)}
                                        className="h-6 px-2 text-[10px] font-semibold text-slate-700 border-slate-300 hover:bg-slate-100"
                                      >
                                        {isExpanded ? 'Hide Ledger' : 'View Ledger'}
                                      </Button>

                                      {row.rawInvoice && row.remainingBalance > 0 && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => setSelectedInvoiceForDues(row.rawInvoice!)}
                                          className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                        >
                                          Collect
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Expandable Details: Installment History */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/90 border-y border-pink-100/80">
                                    <td colSpan={11} className="py-3.5 px-4 sm:px-6">
                                      <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                          <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4 text-[#9D2558]" />
                                            <h4 className="text-xs font-bold text-slate-900">
                                              Installment & Payment History · <span className="font-mono text-slate-600">{row.reference}</span>
                                            </h4>
                                            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                                              {row.installments.length} record{row.installments.length !== 1 ? 's' : ''}
                                            </Badge>
                                          </div>
                                          <div className="text-[11px] text-slate-500">
                                            Total Paid: <strong className="text-emerald-700 font-mono">{formatCurrency(row.totalPaid)}</strong>
                                            {row.remainingBalance > 0 ? (
                                              <> · Remaining: <strong className="text-rose-600 font-mono">{formatCurrency(row.remainingBalance)}</strong></>
                                            ) : (
                                              <> · <span className="text-emerald-600 font-semibold">Fully Settled</span></>
                                            )}
                                          </div>
                                        </div>

                                        {row.installments.length === 0 ? (
                                          <p className="text-xs text-slate-400 italic py-2">
                                            No individual payment or advance installments recorded for this item.
                                          </p>
                                        ) : (
                                          <div className="overflow-x-auto rounded border border-slate-100">
                                            <table className="w-full text-left text-xs divide-y divide-slate-100">
                                              <thead>
                                                <tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                                  <th className="py-2 px-2.5">Date & Time</th>
                                                  <th className="py-2 px-2.5">Receipt #</th>
                                                  <th className="py-2 px-2.5">Type</th>
                                                  <th className="py-2 px-2.5">Method</th>
                                                  <th className="py-2 px-2.5">Cashier / Staff</th>
                                                  <th className="py-2 px-2.5 text-right">Amount</th>
                                                  <th className="py-2 px-2.5">Status</th>
                                                  <th className="py-2 px-2.5">Details / Notes</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                                {row.installments.map((inst) => (
                                                  <tr
                                                    key={inst.id}
                                                    className={inst.isAuditOnly ? 'bg-amber-50/40 text-slate-600' : 'hover:bg-slate-50/60'}
                                                  >
                                                    <td className="py-2 px-2.5 whitespace-nowrap text-slate-700">
                                                      <span className="font-semibold block">{inst.date}</span>
                                                      <span className="text-[10px] text-slate-400">{inst.time}</span>
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap font-mono font-medium text-slate-900">
                                                      {inst.receiptNumber || '-'}
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap">
                                                      {inst.type === 'BOOKING_ADVANCE' ? (
                                                        <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[9px] font-bold">
                                                          Booking Advance
                                                        </Badge>
                                                      ) : inst.type === 'ADVANCE_ADJUSTED' ? (
                                                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[9px] font-semibold">
                                                          Advance Adjusted
                                                        </Badge>
                                                      ) : inst.type === 'DUES_COLLECTION' ? (
                                                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold">
                                                          Dues Collected
                                                        </Badge>
                                                      ) : inst.type === 'REFUND' ? (
                                                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold">
                                                          Refund
                                                        </Badge>
                                                      ) : (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                                                          POS Payment
                                                        </Badge>
                                                      )}
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap text-slate-700 font-mono">
                                                      {inst.method || 'CASH'}
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap text-slate-600">
                                                      {inst.processedByName || '-'}
                                                    </td>
                                                    <td className="py-2 px-2.5 text-right whitespace-nowrap font-mono font-bold">
                                                      {inst.isAuditOnly ? (
                                                        <span className="text-amber-700" title="Adjusted from booking deposit; recorded for audit so not double-counted">
                                                          ({formatCurrency(inst.amount)})
                                                        </span>
                                                      ) : inst.amount < 0 ? (
                                                        <span className="text-rose-600">-{formatCurrency(Math.abs(inst.amount))}</span>
                                                      ) : (
                                                        <span className="text-emerald-700">+{formatCurrency(inst.amount)}</span>
                                                      )}
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap">
                                                      <Badge variant="outline" className="text-[9px] text-slate-600">
                                                        {inst.status}
                                                      </Badge>
                                                    </td>
                                                    <td className="py-2 px-2.5 text-slate-600 max-w-xs break-words">
                                                      {inst.description}
                                                      {inst.isAuditOnly && (
                                                        <span className="block text-[9px] text-amber-700 italic">
                                                          * Advance credit applied to invoice; excluded from further payments to prevent double-counting.
                                                        </span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 1: Invoices */}
              {activeTab === 'invoices' && (
                <div className="space-y-2">
                  {details.invoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No sales invoices issued for this customer.
                    </div>
                  ) : (
                    <div className="w-full min-w-0 overflow-x-auto border border-slate-200/80 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Invoice #</th>
                            <th className="py-2.5 px-3 text-right">Net Sales</th>
                            <th className="py-2.5 px-3 text-right">Tax</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3 text-right">Amount Paid</th>
                            <th className="py-2.5 px-3 text-right">Amount Due</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {details.invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                                {inv.date}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {formatCurrency(inv.netSales)}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap text-slate-500">
                                {formatCurrency(inv.tax)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatCurrency(inv.total)}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-emerald-700">
                                {formatCurrency(inv.amountPaid || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold">
                                {inv.amountDue > 0 ? (
                                  <span className="text-rose-600">{formatCurrency(inv.amountDue)}</span>
                                ) : (
                                  <span className="text-emerald-600">PKR 0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge
                                  className={`text-[10px] font-bold ${
                                    inv.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : inv.status === 'PARTIAL'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  {inv.status === 'PAID' ? 'Fully Paid' : inv.status === 'PARTIAL' ? 'Partially Paid' : 'Unpaid'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {inv.amountDue > 0 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setSelectedInvoiceForDues(inv)}
                                    className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                  >
                                    Collect
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Receipts / Payments */}
              {activeTab === 'receipts' && (
                <div className="space-y-2">
                  {details.receipts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No payment receipts recorded for this customer.
                    </div>
                  ) : (
                    <div className="w-full min-w-0 overflow-x-auto border border-slate-200/80 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Invoice Ref</th>
                            <th className="py-2.5 px-3">Method</th>
                            <th className="py-2.5 px-3">Account / Drawer</th>
                            <th className="py-2.5 px-3 text-right">Amount Received</th>
                            <th className="py-2.5 px-3">Cashier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reversalError && <tr><td colSpan={6} role="alert" className="text-rose-700 p-3">{reversalError}</td></tr>}
                          {details.receipts.map((rcpt, idx) => (
                            <tr key={rcpt.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-bold text-slate-900">{rcpt.date}</span>
                                <span className="text-slate-500 block text-[10px]">{rcpt.time}</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                                {rcpt.invoiceNumber || 'POS Sale'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px] font-bold">
                                  {rcpt.method}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                {rcpt.paymentAccountName || 'Counter Cash Drawer'}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-bold ${rcpt.isRefund ? 'text-rose-700' : 'text-emerald-700'} whitespace-nowrap font-mono`}>
                                {rcpt.isRefund ? '-' : '+'}{formatCurrency(rcpt.amount)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                                {rcpt.processedByName || 'System'}
                                {rcpt.reversedAt ? <span className="block text-rose-700">Reversed: {rcpt.reversalReason}</span> : rcpt.kind === 'DUES_COLLECTION' && salonService.reverseCollection && <button type="button" disabled={reversing} onClick={() => reverseReceipt(rcpt)} className="block text-rose-700 underline">Reverse collection</button>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Outstanding Dues */}
              {activeTab === 'dues' && (
                <div className="space-y-3">
                  {details.outstandingInvoices.length === 0 ? (
                    <div className="p-8 text-center text-emerald-600 text-xs flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <span className="font-bold">No outstanding receivables!</span>
                      <span className="text-slate-400">This customer has cleared all issued invoices.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {details.outstandingInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3.5 bg-rose-50/40 border border-rose-200/80 rounded-lg flex items-center justify-between gap-4 flex-wrap"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">
                                Invoice #{inv.invoiceNumber}
                              </span>
                              <Badge className={`text-[10px] font-bold ${
                                inv.status === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                {inv.status}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Issued on {inv.date} • Total: {formatCurrency(inv.total)} • Paid: {formatCurrency(inv.amountPaid)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                                Remaining Due
                              </span>
                              <span className="text-sm font-bold text-rose-600 font-mono">
                                {formatCurrency(inv.amountDue)}
                              </span>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedInvoiceForDues(inv)}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1 shadow-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Collect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Bookings & Events */}
              {activeTab === 'bookings' && (
                <div className="space-y-3">
                  {(!details.bookings || details.bookings.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No bridal or groom bookings found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {details.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-[#FDF2F5]/30 transition-all flex items-center justify-between gap-4 flex-wrap"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {b.bookingNumber}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                                  b.type === 'BRIDAL'
                                    ? 'bg-[#FCE8EC] text-[#9D2558] border-[#F1DEE3]'
                                    : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                              >
                                {b.type === 'BRIDAL' ? (
                                  <>
                                    <Sparkles className="w-2.5 h-2.5 text-[#9D2558]" />
                                    Bridal Event
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-2.5 h-2.5 text-slate-600" />
                                    Groom Event
                                  </>
                                )}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200"
                              >
                                {b.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#9D2558]" />
                                {b.eventDate} ({b.serviceTime || '10:00 AM'})
                              </span>
                              <span>•</span>
                              <span>Stylist: {b.assignedStaffName || 'Unassigned'}</span>
                              <span>•</span>
                              <span>{b.items?.length || 1} Service(s)</span>
                            </div>
                            <div className="text-xs font-mono font-semibold pt-1 flex items-center gap-3">
                              <span>Total: {formatCurrency(b.totalAmount)}</span>
                              <span className="text-emerald-700 font-bold">
                                Advance: {formatCurrency(b.advancePaid)}
                              </span>
                              <span className="text-[#9D2558] font-bold">
                                Remaining: {formatCurrency(b.remainingBalance)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBookingForView(b)}
                              className="text-xs h-8 border-[#9D2558] text-[#9D2558] hover:bg-[#FDF2F5]"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Appointments */}
              {activeTab === 'appointments' && (
                <div className="space-y-2">
                  {details.appointments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No appointment records found for this customer.
                    </div>
                  ) : (
                    <div className="w-full min-w-0 overflow-x-auto border border-slate-200/80 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Services / Items</th>
                            <th className="py-2.5 px-3">Staff</th>
                            <th className="py-2.5 px-3 text-right">Price</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Billing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {details.appointments.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-bold text-slate-900">{a.date}</span>
                                <span className="text-slate-500 block text-[10px]">
                                  {a.startTime || a.time || '10:00 AM'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {a.items && a.items.length > 0 ? (
                                  <span>{a.items.map((i) => i.name).join(', ')}</span>
                                ) : (
                                  <span>{a.serviceName || 'Service'}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                {a.items?.[0]?.staffName || a.staffName || 'Staff'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatCurrency(a.price || 0)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px] font-bold">
                                  {a.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {a.billingStatus === 'BILLED' ? (
                                  <span className="text-[10px] font-bold text-emerald-600">Billed</span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">Unbilled</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
              <BookingDetailsModal
          isOpen={Boolean(selectedBookingForView)}
          onClose={() => setSelectedBookingForView(null)}
          booking={selectedBookingForView}
          onEdit={() => {}}
          onOpenConfirmationMessage={() => {}}
          onOpenInPOS={(b) => {
            onClose();
            navigate(`/pos?bookingId=${b.id}`);
          }}
        />
      </DialogContent>

      {/* Collect Dues Sub-Modal */}
      <CollectDuesModal
        isOpen={Boolean(selectedInvoiceForDues)}
        onClose={() => setSelectedInvoiceForDues(null)}
        invoice={selectedInvoiceForDues}
        onSuccess={() => {
          setSelectedInvoiceForDues(null);
          loadClientDetails();
          onRefreshList();
        }}
      />
    </Dialog>
  );
};
