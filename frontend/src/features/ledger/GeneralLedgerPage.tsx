import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService, LedgerMovement, GeneralLedgerSummary } from '@/services';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { toast } from '@/context/ToastContext';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Search,
  Wallet,
  Landmark,
  Scale,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export const GeneralLedgerPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  const [selectedBranchId, setSelectedBranchId] = useState(
    activeBranchId && activeBranchId !== 'ALL' ? activeBranchId : user?.branchId || 'ALL'
  );

  // Filters state
  const [channel, setChannel] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Data state
  const [movements, setMovements] = useState<LedgerMovement[]>([]);
  const [summary, setSummary] = useState<GeneralLedgerSummary | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveBranchId = user?.role === 'SUPER_ADMIN' ? selectedBranchId : user?.branchId;

  const loadLedger = async (isManual = false) => {
    setIsLoading(true);
    try {
      const res = await salonService.getGeneralLedger({
        branchId: effectiveBranchId === 'ALL' ? undefined : effectiveBranchId,
        channel,
        direction: direction === 'ALL' ? undefined : direction,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      });

      setMovements(res.movements);
      setSummary(res.summary);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
      if (isManual) toast.success('General ledger refreshed.');
    } catch (err: any) {
      console.warn('General ledger load warning:', err);
      if (isManual) toast.error(err.message || 'Failed to fetch general ledger records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [effectiveBranchId, channel, direction, fromDate, toDate, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLedger();
  };

  const handleResetFilters = () => {
    setChannel('ALL');
    setDirection('ALL');
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const currentBranchName =
    effectiveBranchId === 'ALL'
      ? 'All Locations (Consolidated)'
      : allBranches.find((b) => b.id === effectiveBranchId)?.name || 'Branch Ledger';

  return (
    <div className="w-full max-w-full space-y-6 text-slate-800 font-sans">
      {/* 1. Top Header Banner */}
      <div className="relative overflow-hidden rounded-[24px] border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[#B82E69]/10 via-[#D94883]/5 to-transparent blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B82E69] to-[#9D2558] text-white shadow-lg shadow-[#B82E69]/25">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#23151D]">
                  General Ledger & Movements
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#B82E69]/10 text-[#B82E69] border border-[#B82E69]/20">
                  Double-Entry Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time double-entry audit movements across physical cash tills, bank accounts, and merchant wallets for {currentBranchName}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user?.role === 'SUPER_ADMIN' && (
              <div className="flex items-center gap-1.5 border border-slate-200 bg-white/90 rounded-xl px-3 py-1.5 shadow-2xs">
                <select
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden"
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Branches</option>
                  {allBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => loadLedger(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#B82E69]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Financial Metric Summary (5 Frosted Pure White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Opening Balance */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/90 bg-white/75 p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Balance</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-slate-800 font-mono tracking-tight">
              {formatCurrency(summary?.openingBalance ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Carried forward balance</p>
          </div>
        </div>

        {/* Total Inflows */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/90 bg-white/75 p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Inflows</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-emerald-600 font-mono tracking-tight">
              +{formatCurrency(summary?.totalIn ?? 0)}
            </div>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">Sales, floats & receipts</p>
          </div>
        </div>

        {/* Total Outflows */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/90 bg-white/75 p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Outflows</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-[#B82E69]">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-[#B82E69] font-mono tracking-tight">
              -{formatCurrency(summary?.totalOut ?? 0)}
            </div>
            <p className="text-[11px] text-rose-600/80 mt-0.5">Expenses & payouts</p>
          </div>
        </div>

        {/* Net Movement */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/90 bg-white/75 p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Movement</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-lg font-extrabold font-mono tracking-tight ${
                (summary?.netMovement ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatCurrency(summary?.netMovement ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Inflows less outflows</p>
          </div>
        </div>

        {/* Closing Balance */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/90 bg-gradient-to-br from-white/90 via-white/80 to-[#B82E69]/5 p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Closing Balance</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B82E69]/10 text-[#B82E69]">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-[#23151D] font-mono tracking-tight">
              {formatCurrency(summary?.closingBalance ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Effective running balance</p>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="rounded-[20px] border border-white/90 bg-white/75 p-4 backdrop-blur-xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Tabs */}
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-white/60 p-1 text-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setChannel('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  channel === 'ALL'
                    ? 'bg-gradient-to-r from-[#B82E69] to-[#9D2558] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Channels
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel('CASH');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  channel === 'CASH'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Cash Drawers
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel('BANK');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  channel === 'BANK'
                    ? 'bg-gradient-to-r from-[#B82E69] to-[#9D2558] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                Bank / Wallets
              </button>
            </div>

            {/* Direction Filter */}
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-white/60 p-1 text-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setDirection('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  direction === 'ALL'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Flows
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection('IN');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  direction === 'IN'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Inflow (In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection('OUT');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  direction === 'OUT'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                - Outflow (Out)
              </button>
            </div>
          </div>

          {/* Quick Date Range & Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-transparent text-slate-700 outline-hidden"
                placeholder="From date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-transparent text-slate-700 outline-hidden"
                placeholder="To date"
              />
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, reference, operator name, or till..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#B82E69]/30 bg-white shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-[#B82E69] to-[#9D2558] px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* 4. Ledger Movements Table */}
      <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
        {isLoading && movements.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-[2.5px] border-[#B82E69]/20 border-t-[#B82E69] animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Reconciling general ledger transactions...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Ledger Movements Recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              No financial inflows or disbursements match your selected date range and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Channel / Holder</th>
                  <th className="py-3 px-4">Module / Ref</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-right">Debit (Out)</th>
                  <th className="py-3 px-4 text-right">Credit (In)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-800">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-100 text-slate-700">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-[#B82E69]/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{m.date}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            m.channel === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          {m.channel === 'CASH' ? 'Cash Till' : 'Bank / Card'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5">{m.holderName}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 text-[11px]">{m.sourceModule}</span>
                      {m.reference && (
                        <div className="text-[11px] text-[#B82E69] font-mono font-bold">{m.reference}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate" title={m.description}>
                      <span className="text-slate-800">{m.description}</span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {m.userName || 'System'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-rose-600 font-mono tabular-nums">
                      {m.direction === 'OUT' ? `-${formatCurrency(m.amount)}` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-600 font-mono tabular-nums">
                      {m.direction === 'IN' ? `+${formatCurrency(m.amount)}` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-extrabold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(m.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white/40">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of{' '}
              <strong className="text-slate-800">{formatNumber(totalCount)}</strong> movements
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralLedgerPage;
