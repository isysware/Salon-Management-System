import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { Invoice, PaymentAccount, POSPaymentEntry } from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { ReceiptModal } from '@/features/pos/ReceiptModal';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/context/ToastContext';
import {
  downloadReportCsv,
  downloadReportExcel,
  printReportWindow,
} from '@/features/reports/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  CreditCard,
  Banknote,
  Receipt,
  Phone,
  RefreshCw,
  Coins,
  CheckCircle2,
} from 'lucide-react';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#9D2558] focus:border-[#9D2558] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#9D2558] focus:border-[#9D2558] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#23151D] mb-1.5';

const formatPKR = (amt: number) => {
  const num = Number(amt) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const UnpaidInvoicesPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/unpaid-invoices" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL'>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Collect Payment Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectCashTendered, setCollectCashTendered] = useState<number>(0);
  const [selectedOnlineAccountId, setSelectedOnlineAccountId] = useState<string>('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionIdempotencyKey, setCollectionIdempotencyKey] = useState<string>('');

  // Receipt Modal state
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchScope = selectedBranch && selectedBranch !== 'ALL' ? selectedBranch : 'ALL';
      const [allInvs, allAccs] = await Promise.all([
        salonService.getInvoices(branchScope),
        salonService.getPaymentAccounts(branchScope),
      ]);
      // Only invoices with pending receivable balances
      const unpaidList = allInvs.filter((inv) => inv.amountDue > 0 && inv.status !== 'PAID');
      setInvoices(unpaidList);
      const activeAccs = allAccs.filter((a) => a.isActive);
      setPaymentAccounts(activeAccs);
      if (activeAccs.length > 0) {
        setSelectedOnlineAccountId(activeAccs[0].id);
      }
    } catch (err) {
      console.error('Failed to load unpaid invoices:', err);
      toast.error('Failed to load unpaid receivables.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadData();
  }, [loadData, demoDate]);

  const getBranchName = useCallback((bId: string) => {
    return allBranches.find((b) => b.id === bId)?.name || bId;
  }, [allBranches]);

  // Filtered unpaid invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Branch check
      if (selectedBranch !== 'ALL' && inv.branchId !== selectedBranch) {
        return false;
      }

      // Search check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientName.toLowerCase().includes(q) ||
          (inv.clientPhone && inv.clientPhone.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Status check
      if (statusFilter === 'UNPAID') {
        if (inv.amountPaid > 0) return false;
      } else if (statusFilter === 'PARTIAL') {
        if (inv.amountPaid <= 0) return false;
      }

      // Date Range check
      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;

      return true;
    });
  }, [invoices, selectedBranch, searchQuery, statusFilter, fromDate, toDate]);

  // Totals calculations
  const totals = useMemo(() => {
    let billTotal = 0;
    let amountPaid = 0;
    let amountDue = 0;

    for (const inv of filteredInvoices) {
      billTotal += inv.netSales + (inv.tax || 0);
      amountPaid += inv.amountPaid || 0;
      amountDue += inv.amountDue || 0;
    }

    return { billTotal, amountPaid, amountDue };
  }, [filteredInvoices]);

  // Export CSV
  const handleExportCsv = () => {
    if (!filteredInvoices.length) {
      toast.info('No unpaid records to export.');
      return;
    }
    const meta: [string, string][] = [
      ['Report', 'Unpaid Invoices & Receivables Statement'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : getBranchName(selectedBranch)],
      ['From Date', fromDate || 'Beginning'],
      ['To Date', toDate || 'Present'],
      ['Total Outstanding Receivables', `PKR ${formatPKR(totals.amountDue)}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Invoice #',
      'Sale Date',
      'Client',
      'Phone',
      'Branch',
      'Bill Total (PKR)',
      'Paid So Far (PKR)',
      'Balance Due (PKR)',
      'Status',
    ];

    const rows = filteredInvoices.map((inv, idx) => [
      idx + 1,
      inv.invoiceNumber,
      inv.date,
      inv.clientName || 'Walk-in',
      inv.clientPhone || '—',
      getBranchName(inv.branchId),
      (inv.netSales + (inv.tax || 0)).toFixed(2),
      (inv.amountPaid || 0).toFixed(2),
      inv.amountDue.toFixed(2),
      inv.status,
    ]);

    downloadReportCsv('Unpaid_Invoices_Report', meta, [{ headers, rows }]);
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!filteredInvoices.length) {
      toast.info('No unpaid records to export.');
      return;
    }
    const meta: [string, string][] = [
      ['Report', 'Unpaid Invoices & Receivables Statement'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : getBranchName(selectedBranch)],
      ['From Date', fromDate || 'Beginning'],
      ['To Date', toDate || 'Present'],
      ['Total Outstanding Receivables', `PKR ${formatPKR(totals.amountDue)}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Invoice #',
      'Sale Date',
      'Client',
      'Phone',
      'Branch',
      'Bill Total (PKR)',
      'Paid So Far (PKR)',
      'Balance Due (PKR)',
      'Status',
    ];

    const rows = filteredInvoices.map((inv, idx) => [
      idx + 1,
      inv.invoiceNumber,
      inv.date,
      inv.clientName || 'Walk-in',
      inv.clientPhone || '—',
      getBranchName(inv.branchId),
      (inv.netSales + (inv.tax || 0)).toFixed(2),
      (inv.amountPaid || 0).toFixed(2),
      inv.amountDue.toFixed(2),
      inv.status,
    ]);

    downloadReportExcel('Unpaid_Invoices_Report', meta, [{ headers, rows }]);
  };

  // Print Window
  const handlePrint = () => {
    if (!filteredInvoices.length) {
      window.print();
      return;
    }
    const meta: [string, string][] = [
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : getBranchName(selectedBranch)],
      ['From Date', fromDate || 'Beginning'],
      ['To Date', toDate || 'Present'],
      ['Total Pending Invoices', String(filteredInvoices.length)],
      ['Total Receivable Balance', `PKR ${formatPKR(totals.amountDue)}`],
    ];

    const headers = [
      '#',
      'Invoice #',
      'Date',
      'Client',
      'Branch',
      'Bill Total',
      'Paid',
      'Balance Due',
      'Status',
    ];

    const rows = filteredInvoices.map((inv, idx) => [
      idx + 1,
      inv.invoiceNumber,
      inv.date,
      `${inv.clientName || 'Walk-in'} ${inv.clientPhone ? `(${inv.clientPhone})` : ''}`,
      getBranchName(inv.branchId),
      formatPKR(inv.netSales + (inv.tax || 0)),
      formatPKR(inv.amountPaid || 0),
      formatPKR(inv.amountDue),
      inv.status,
    ]);

    printReportWindow({
      title: 'Unpaid Invoices & Receivables Statement',
      meta,
      headers,
      rows,
    });
  };

  // Open Collect Modal
  const handleOpenCollect = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setCollectAmount(inv.amountDue);
    setCollectCashTendered(inv.amountDue);
    setCollectionNotes('');
    setCollectMethod('CASH');

    const key = `COLLECT-${inv.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setCollectionIdempotencyKey(key);

    // Find accounts for this invoice's branch
    const branchAccs = paymentAccounts.filter((a) => (a.branchIds ?? [a.branchId]).includes(inv.branchId));
    if (branchAccs.length > 0) {
      setSelectedOnlineAccountId(branchAccs[0].id);
    }

    setIsCollectModalOpen(true);
  };

  // Submit collection
  const handleSubmitCollection = async () => {
    if (!selectedInvoice) return;
    setIsCollecting(true);

    try {
      const paymentAmount = Math.max(0, collectAmount);
      if (paymentAmount <= 0) {
        throw new Error('Please enter a collection amount greater than 0.');
      }
      if (paymentAmount > selectedInvoice.amountDue) {
        throw new Error(`Collection amount cannot exceed outstanding balance (${selectedInvoice.amountDue} PKR).`);
      }

      const payments: POSPaymentEntry[] = [];

      if (collectMethod === 'CASH') {
        const tendered = Math.max(paymentAmount, collectCashTendered || paymentAmount);
        const change = Math.max(0, tendered - paymentAmount);
        payments.push({
          method: 'CASH',
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
          cashTendered: tendered,
          changeReturned: change,
        });
      } else {
        const acc = paymentAccounts.find((a) => a.id === selectedOnlineAccountId);
        if (!acc) {
          throw new Error('Please select an active payment account.');
        }
        payments.push({
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: acc.id,
          paymentAccountName: `${acc.name} (${acc.accountIdentifier})`,
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
        });
      }

      const updated = await salonService.collectInvoicePayment(
        {
          invoiceId: selectedInvoice.id,
          payments,
          idempotencyKey: collectionIdempotencyKey,
          notes: collectionNotes,
        },
        user
      );

      // Successfully collected
      setIsCollectModalOpen(false);
      setReceiptInvoice(updated);
      setIsReceiptOpen(true);
      toast.success('Payment collected and invoice settled successfully!');
      await loadData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-notifications'));
      }
    } catch (err: any) {
      console.error('Failed to collect payment:', err);
      const msg = err.message || 'Payment collection failed.';
      toast.error(msg);
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="w-full text-slate-800">
      {/* ── 1. TOP HEADER CARD WITH TITLE & FILTERS (MATCHING SALES INVOICES STYLE) ── */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#23151D] tracking-tight">Unpaid Invoices & Receivables</h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete receivables ledger: follow up customer balances, record payments into cashier drawers, and settle outstanding bills
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 self-start sm:self-center transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#9D2558]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={(e) => { e.preventDefault(); }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Branch Filter */}
          <div>
            <label className={labelClass}>Branch</label>
            <Select
              value={selectedBranch}
              disabled={!isSuperAdmin}
              onValueChange={(val) => setSelectedBranch(val)}
            >
              <SelectTrigger className="w-full text-xs h-9 border border-slate-300 rounded-md bg-white text-slate-700 font-medium">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {isSuperAdmin && <SelectItem value="ALL">All Branches</SelectItem>}
                {allBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Query */}
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Client, phone, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-8 h-9`}
              />
            </div>
          </div>

          {/* Pay Status Filter */}
          <div>
            <label className={labelClass}>Pay Status</label>
            <Select
              value={statusFilter}
              onValueChange={(val: any) => setStatusFilter(val)}
            >
              <SelectTrigger className="w-full text-xs h-9 border border-slate-300 rounded-md bg-white text-slate-700 font-medium">
                <SelectValue placeholder="Pay Status" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="ALL">All Pending (Unpaid & Partial)</SelectItem>
                <SelectItem value="UNPAID">Unpaid Only</SelectItem>
                <SelectItem value="PARTIAL">Partially Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div>
            <label className={labelClass}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* To Date */}
          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </form>
      </div>

      {/* ── 2. MAIN TABLE REGISTER CARD (ROYAL BERRY BANNER & CRISP REPORT ROWS) ── */}
      <div className="shadow-sm rounded-xl overflow-hidden border border-slate-200/90 mb-8 bg-white">
        {/* Royal Berry Banner Header */}
        <div className="bg-[#9D2558] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
          <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
            <Receipt className="w-4 h-4 stroke-[2.5]" />
            <span>Unpaid Receivables Register</span>
            <span className="text-[11px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full ml-1">
              {filteredInvoices.length} Pending
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-[#009688] hover:bg-[#00897B] active:bg-[#00796B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#4B5563] hover:bg-[#374151] active:bg-[#1F2937] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white overflow-x-auto rounded-b-xl border-t border-[#F1DEE3]/40">
          <table className="report-records w-full min-w-[1100px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
            <thead>
              <tr className="bg-[#FDF2F5] border-b border-[#F1DEE3] text-[#475569] font-medium text-[13px]">
                <th className="py-3.5 px-4 text-center w-12 font-medium text-[#475569]">#</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Invoice #</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Sale Date</th>
                <th className="py-3.5 px-4 font-medium text-[#475569]">Client</th>
                <th className="py-3.5 px-4 font-medium text-[#475569]">Branch</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Bill Total</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Paid So Far</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Balance Due</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] text-center w-24">Status</th>
                <th className="py-3.5 px-4 font-medium text-[#475569] text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-[#F1DEE3] border-t-[#9D2558] animate-spin mb-2" />
                      <span>Loading unpaid receivables...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                    No outstanding unpaid invoices found. All client balances are fully reconciled!
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => {
                  const billTotal = inv.netSales + (inv.tax || 0);
                  const isPartial = inv.status === 'PARTIAL' || (inv.amountPaid > 0 && inv.amountDue > 0);

                  return (
                    <tr key={inv.id} className="hover:bg-[#FDF2F5]/20 transition-colors border-b border-dashed border-slate-200">
                      {/* 1. # */}
                      <td className="py-3.5 px-4 text-center font-normal text-slate-500 text-[13px]">
                        {idx + 1}
                      </td>

                      {/* 2. Invoice # */}
                      <td className="py-3.5 px-4 font-semibold whitespace-nowrap text-[13px]">
                        <span className="text-[#9D2558]">{inv.invoiceNumber}</span>
                      </td>

                      {/* 3. Sale Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px]">
                        <div className="leading-tight">
                          <div className="font-medium text-slate-800">{inv.date}</div>
                          {inv.time && <div className="text-[11px] text-slate-400">{inv.time}</div>}
                        </div>
                      </td>

                      {/* 4. Client */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#334155] text-[13px]">
                        <div className="leading-tight">
                          <div className="font-semibold text-slate-900">{inv.clientName || 'Walk-in'}</div>
                          {inv.clientPhone && (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{inv.clientPhone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Branch */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px]">
                        {getBranchName(inv.branchId)}
                      </td>

                      {/* 6. Bill Total */}
                      <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-700 whitespace-nowrap text-[13px]">
                        {formatCurrency(billTotal)}
                      </td>

                      {/* 7. Paid So Far */}
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap text-[13px]">
                        {formatCurrency(inv.amountPaid || 0)}
                      </td>

                      {/* 8. Balance Due */}
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-rose-600 whitespace-nowrap text-[13px]">
                        {formatCurrency(inv.amountDue)}
                      </td>

                      {/* 9. Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs ${
                          isPartial
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {isPartial ? 'PARTIAL' : 'UNPAID'}
                        </span>
                      </td>

                      {/* 10. Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenCollect(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#9D2558] text-white hover:bg-[#851C47] transition-all shadow-2xs cursor-pointer active:scale-95"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Collect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Integrated Table Footer */}
            <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
              <tr className="border-b border-slate-200/70">
                <td colSpan={5} className="py-3.5 px-4 text-right font-bold text-slate-800 tracking-wide">
                  TOTALS (PKR)
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">
                  {formatCurrency(totals.billTotal)}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#10B981]">
                  +{formatCurrency(totals.amountPaid)}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#EF4444]">
                  {formatCurrency(totals.amountDue)}
                </td>
                <td colSpan={2} className="py-3.5 px-4"></td>
              </tr>
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right font-medium text-slate-700">
                  Total Outstanding Receivables
                </td>
                <td colSpan={3} className="py-3 px-4 text-right tabular-nums font-bold text-rose-600 text-sm">
                  {formatCurrency(totals.amountDue)}
                </td>
                <td colSpan={2} className="py-3.5 px-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center py-4 text-xs text-slate-400 font-medium tracking-wide">
        © iSysware Management System
      </div>

      {/* ── 3. COLLECT PAYMENT MODAL (KEPT 100% OPERATIONAL LOGIC) ── */}
      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent className="max-w-md font-sans p-4 sm:p-5 space-y-2.5">
          <DialogHeader className="pb-1 border-b border-slate-100">
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                Collect Outstanding Receivable
              </DialogTitle>
              <Badge variant="neutral" className="text-[10px] font-mono bg-[#FDF2F5] text-[#9D2558] border-[#F1DEE3]">
                {selectedInvoice?.invoiceNumber}
              </Badge>
            </div>
            <DialogDescription className="text-[11px] text-slate-500">
              Record customer payment against Invoice {selectedInvoice?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          {/* Form Content */}
          {selectedInvoice && (
            <div className="space-y-2.5 text-xs">
              {/* Compact Customer & Outstanding Balance Card */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{selectedInvoice.clientName}</span>
                    {selectedInvoice.clientPhone && (
                      <span className="text-[10px] font-normal font-mono text-slate-500">({selectedInvoice.clientPhone})</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">Sale Date: {selectedInvoice.date} (retained)</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wide block">Balance Due</span>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">
                    {formatCurrency(selectedInvoice.amountDue)}
                  </span>
                </div>
              </div>

              {/* Method Choice */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">Receipt Payment Method</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCollectMethod('CASH')}
                    className={`h-7.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      collectMethod === 'CASH'
                        ? 'bg-[#FDF2F5] border-[#9D2558] text-[#9D2558] font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Physical Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMethod('ONLINE')}
                    className={`h-7.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      collectMethod === 'ONLINE'
                        ? 'bg-[#FDF2F5] border-[#9D2558] text-[#9D2558] font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Online Account
                  </button>
                </div>
              </div>

              {/* Amount to Collect Input */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[10px] font-bold text-slate-700">Amount to Collect (PKR)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCollectAmount(selectedInvoice.amountDue);
                      setCollectCashTendered(selectedInvoice.amountDue);
                    }}
                    className="text-[10px] text-[#9D2558] hover:underline font-bold cursor-pointer"
                  >
                    Full Balance ({formatCurrency(selectedInvoice.amountDue)})
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={selectedInvoice.amountDue}
                  value={collectAmount || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCollectAmount(val);
                    setCollectCashTendered(val);
                  }}
                  className="font-mono font-bold text-xs h-7.5"
                />
              </div>

              {/* Cash Tendered / Change */}
              {collectMethod === 'CASH' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Cash Tendered (PKR)</label>
                    <Input
                      type="number"
                      min="0"
                      value={collectCashTendered || ''}
                      onChange={(e) => setCollectCashTendered(parseFloat(e.target.value) || 0)}
                      className="font-mono h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Change Returned</label>
                    <div className="h-7 flex items-center font-mono font-bold text-emerald-700 text-xs px-2 bg-slate-50 border border-slate-200 rounded-md">
                      {formatCurrency(Math.max(0, collectCashTendered - collectAmount))}
                    </div>
                  </div>
                </div>
              )}

              {/* Online Account Picker */}
              {collectMethod === 'ONLINE' && (
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Deposit To Payment Account</label>
                  <Select
                    value={selectedOnlineAccountId}
                    onValueChange={setSelectedOnlineAccountId}
                  >
                    <SelectTrigger className="h-7.5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts
                        .filter((a) => (a.branchIds ?? [a.branchId]).includes(selectedInvoice.branchId))
                        .map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs">
                            {acc.name} ({acc.accountIdentifier})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Collection Notes */}
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Collection Notes (Optional)</label>
                <Input
                  placeholder="e.g. Cleared remaining balance via cash till"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              {/* Compact Audit Badge */}
              <div className="py-1 px-2.5 rounded-lg bg-[#FDF2F5]/60 border border-[#F1DEE3] text-[10px] text-slate-500 flex items-center justify-between">
                <span>Receipt attributed to <strong className="text-slate-700">{user.name}</strong></span>
                <span>Date: <strong className="text-slate-700">{demoDate}</strong></span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1 border-t border-slate-100 sm:justify-end">
            <Button
              variant="outline"
              disabled={isCollecting}
              onClick={() => setIsCollectModalOpen(false)}
              className="text-xs h-7.5 px-3"
            >
              Cancel
            </Button>
            <Button
              disabled={isCollecting || collectAmount <= 0}
              onClick={handleSubmitCollection}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7.5 px-3.5 gap-1.5 cursor-pointer font-bold"
            >
              {isCollecting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Receipt ({formatCurrency(collectAmount)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 4. PRINTABLE RECEIPT MODAL ── */}
      {isReceiptOpen && receiptInvoice && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          invoice={receiptInvoice}
          branch={allBranches.find((b) => b.id === receiptInvoice?.branchId) || null}
        />
      )}
    </div>
  );
};
