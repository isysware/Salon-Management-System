import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  OperatingProfitReport,
  OperatingProfitStatementRow,
  OperatingProfitDetailRow,
  OperatingProfitReportQuery,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  TrendingUp,
  Receipt,
  Landmark,
  Scale,
  Percent,
} from 'lucide-react';
import {
  DATE_PRESETS,
  DatePreset,
  downloadReportCsv,
  formatSignedPKR,
  printReportWindow,
  resolvePreset,
} from './reportUtils';

const selectClass =
  'w-full text-xs rounded-xl border border-white/80 bg-white/80 hover:bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#B82E69]/20 focus:border-[#B82E69] shadow-2xs font-medium cursor-pointer transition-all';
const inputClass =
  'w-full text-xs rounded-xl border border-white/80 bg-white/80 hover:bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#B82E69]/20 focus:border-[#B82E69] shadow-2xs font-medium transition-all';
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';

const formatPKR = formatSignedPKR;

export const COGSReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return <AccessDeniedView attemptedPath="/reports/operating-profit" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState<string>(defaultMonth.from);
  const [customTo, setCustomTo] = useState<string>(defaultMonth.to);
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'DETAILED'>('STATEMENT');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<OperatingProfitReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePresetChange = (p: DatePreset) => {
    setSelectedPreset(p);
    const r = resolvePreset(p, businessDate);
    if (r) {
      setCustomFrom(r.from);
      setCustomTo(r.to);
    }
  };

  const branchNameDisplay = useMemo(() => {
    if (selectedBranch === 'ALL') return 'All Branches';
    return (
      allBranches?.find((b) => b.id === selectedBranch)?.name ||
      reportData?.meta.branchName ||
      selectedBranch
    );
  }, [selectedBranch, allBranches, reportData]);

  // Fetch report data from live backend API (100% Real DB)
  const fetchReport = useCallback(
    async (q: OperatingProfitReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getOperatingProfitReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Operating Profit report:', err);
        setErrorMessage(
          err.message || 'Failed to fetch live operating profit report from server.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: OperatingProfitReportQuery = {
      branchId: selectedBranch,
      preset: selectedPreset,
      startDate: customFrom || undefined,
      endDate: customTo || undefined,
      from: customFrom || undefined,
      to: customTo || undefined,
    };

    fetchReport(query);
  };

  // Export handlers
  const exportHeaders = [
    'Account / Line Item',
    'Classification',
    'Department / Category',
    'Current Period (PKR)',
    '% of Net Revenue',
    'Prior Period (PKR)',
    'Variance (PKR)',
    'Growth (%)',
    'Notes / Details',
  ];

  const exportRows = useMemo(() => {
    if (!reportData?.rows) return [];
    return reportData.rows.map((r) => [
      r.accountName,
      r.classification,
      r.department,
      r.currentAmount.toFixed(2),
      `${r.percentOfRevenue}%`,
      r.priorAmount.toFixed(2),
      r.varianceAmount.toFixed(2),
      r.growthPercent !== null ? `${r.growthPercent}%` : 'N/A',
      r.notes,
    ]);
  }, [reportData]);

  const exportMeta: [string, string][] = useMemo(() => {
    const meta = reportData?.meta;
    return [
      ['Report', 'Operating Profit & P&L Statement'],
      ['Branch', branchNameDisplay],
      ['Current Period', `${customFrom || meta?.from || ''} to ${customTo || meta?.to || ''}`],
      ['Generated By', user?.name || 'Administrator'],
      ['Generated At', new Date().toLocaleString()],
    ];
  }, [reportData, user, branchNameDisplay, customFrom, customTo]);

  const handleExportCsv = () => {
    if (!reportData || !reportData.rows.length) return;
    downloadReportCsv('operating_profit_statement', exportMeta, [
      { headers: exportHeaders, rows: exportRows },
    ]);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.rows.length) return;
    const totals = reportData.totals;
    const footers = [
      'NET OPERATING PROFIT',
      'NET_PROFIT',
      'Total Business',
      formatPKR(totals.netProfit),
      `${reportData.kpis.operatingMarginPercent}%`,
      formatPKR(reportData.kpis.priorOperatingProfit),
      formatPKR(totals.netProfit - reportData.kpis.priorOperatingProfit),
      reportData.kpis.profitGrowthPercent !== null ? `${reportData.kpis.profitGrowthPercent}%` : 'N/A',
      `Operating Margin: ${reportData.kpis.operatingMarginPercent}%`,
    ];

    printReportWindow({
      title: 'Operating Profit & P&L Statement',
      subtitle: `Branch: ${branchNameDisplay} · Period: ${customFrom} to ${customTo}`,
      meta: exportMeta,
      headers: exportHeaders,
      rows: exportRows,
      totals: footers,
    });
  };

  return (
    <div className="w-full max-w-full space-y-6 text-slate-800 font-sans">
      {/* ── 1. TOP HEADER BANNER (Frosted Glassmorphism) ── */}
      <div className="relative overflow-hidden rounded-[24px] border border-white/90 bg-white/75 p-6 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[#B82E69]/10 via-[#D94883]/5 to-transparent blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B82E69] to-[#9D2558] text-white shadow-lg shadow-[#B82E69]/25">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#18191B]">
                  Operating Profit & P&L Statement
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF2F5] text-[#B82E69] border border-[#B82E69]/20 uppercase tracking-wider">
                  Managerial P&L
                </span>
              </div>
              <p className="text-xs text-[#78616C] font-medium mt-0.5">
                Managerial Profit & Loss statement with net revenue, cost of goods/services, overheads, and operating profit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. FILTER CARD (Frosted Glass) ── */}
      <div className="rounded-[24px] border border-white/90 bg-white/75 p-5 md:p-6 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Branch Filter */}
          <div>
            <label className={labelClass}>Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={selectClass}
            >
              {isSuperAdmin && <option value="ALL">All Branches</option>}
              {allBranches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Preset Filter */}
          <div>
            <label className={labelClass}>Date Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
              className={selectClass}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className={labelClass}>From Date</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setSelectedPreset('CUSTOM');
              }}
              className={inputClass}
            />
          </div>

          {/* To Date */}
          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setSelectedPreset('CUSTOM');
              }}
              className={inputClass}
            />
          </div>

          {/* Filter Action Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 bg-[#B82E69] hover:bg-[#A02358] active:bg-[#851C47] text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Filter className="w-3.5 h-3.5 fill-current" />
                  <span>Apply Filters</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── 3. ROW 3 PURE WHITE FROSTED BLUR KPI CARDS (when filtered) ── */}
      {hasFiltered && reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Net Revenue */}
          <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="bg-emerald-50 text-emerald-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Revenue
              </span>
            </div>
            <div className="mt-3 relative z-10">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
                PKR {formatPKR(reportData.totals.revenue)}
              </span>
              <span className="text-xs text-[#78616C] font-medium mt-1 block">
                Net recognized turnover
              </span>
            </div>
          </div>

          {/* Card 2: COGS & Consumables */}
          <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-amber-600">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="bg-amber-50 text-amber-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                COGS
              </span>
            </div>
            <div className="mt-3 relative z-10">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
                PKR {formatPKR(reportData.totals.costOfSales)}
              </span>
              <span className="text-xs text-[#78616C] font-medium mt-1 block">
                Retail goods & backbar usage
              </span>
            </div>
          </div>

          {/* Card 3: Operating Overheads */}
          <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-rose-600">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="bg-rose-50 text-rose-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Overheads
              </span>
            </div>
            <div className="mt-3 relative z-10">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
                PKR {formatPKR(reportData.totals.operatingExpenses)}
              </span>
              <span className="text-xs text-[#78616C] font-medium mt-1 block">
                Vouchers, salaries & commissions
              </span>
            </div>
          </div>

          {/* Card 4: Net Operating Profit */}
          <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
                <Landmark className="w-4 h-4" />
              </div>
              <span className={`shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${reportData.totals.netProfit >= 0 ? 'bg-[#FDF2F5] text-[#B82E69]' : 'bg-rose-50 text-rose-700'}`}>
                {reportData.totals.netProfit >= 0 ? 'Operating Profit' : 'Operating Loss'}
              </span>
            </div>
            <div className="mt-3 relative z-10">
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight block ${reportData.totals.netProfit >= 0 ? 'text-[#18191B]' : 'text-rose-600'}`}>
                PKR {formatPKR(reportData.totals.netProfit)}
              </span>
              <span className="text-xs text-[#78616C] font-medium mt-1 block">
                Revenue − COGS − Overheads
              </span>
            </div>
          </div>

          {/* Card 5: Operating Margin */}
          <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-indigo-600">
                <Percent className="w-4 h-4" />
              </div>
              <span className="bg-indigo-50 text-indigo-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Margin
              </span>
            </div>
            <div className="mt-3 relative z-10">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
                {reportData.kpis.operatingMarginPercent}%
              </span>
              <span className="text-xs text-[#78616C] font-medium mt-1 block">
                Return on sales ratio
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. MAIN CONTENT AREA ── */}
      {!hasFiltered ? (
        <div className="rounded-[24px] border border-white/90 bg-white/75 p-16 md:p-24 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] flex flex-col items-center justify-center min-h-[380px] text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FDF2F5] border border-white/80 flex items-center justify-center text-[#B82E69] mb-4 shadow-2xs">
            <Filter className="w-8 h-8 stroke-[1.75]" />
          </div>
          <h3 className="text-base font-semibold text-[#18191B]">Ready to Calculate P&L Statement</h3>
          <p className="text-xs text-[#78616C] font-medium mt-1 max-w-sm">
            Select branch and date preset above and click Apply Filters to generate operating profit report.
          </p>
        </div>
      ) : isLoading ? (
        <div className="rounded-[24px] border border-white/90 bg-white/75 p-16 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] flex flex-col items-center justify-center min-h-[380px] text-center">
          <div className="w-12 h-12 rounded-full border-3 border-[#F1DEE3] border-t-[#B82E69] animate-spin mb-4" />
          <p className="text-slate-800 text-sm font-semibold">Calculating Operating Profit Statement...</p>
          <p className="text-xs text-slate-500 mt-0.5">Aggregating sales, consumables, and expenses</p>
        </div>
      ) : errorMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-white/90 p-8 backdrop-blur-2xl shadow-xs text-center">
          <p className="text-rose-600 text-sm font-semibold mb-3">{errorMessage}</p>
          <button
            onClick={() => handleApplyFilters()}
            className="px-4 py-2 bg-[#B82E69] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#A02358] cursor-pointer"
          >
            Retry Fetch
          </button>
        </div>
      ) : (
        /* ── FILTERED DATA TABLE ── */
        <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-5 border-b border-white/80 flex flex-wrap items-center justify-between gap-3 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#18191B] tracking-tight">Operating Profit & P&L Statement</h3>
                  <p className="text-[11px] text-[#78616C] mt-0.5">
                    Branch: {branchNameDisplay} · Period: {customFrom} to {customTo}
                  </p>
                </div>
                {/* Tab Switcher */}
                <div className="inline-flex p-1 bg-white/80 rounded-xl border border-white/80 shadow-2xs gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('STATEMENT')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'STATEMENT'
                        ? 'bg-[#B82E69] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    P&L Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('DETAILED')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'DETAILED'
                        ? 'bg-[#B82E69] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Detailed Ledger ({reportData?.rows.length ?? 0})
                  </button>
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handleExportCsv}
                className="h-8 px-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Export raw data to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="h-8 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Download or Print PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Print report"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            {activeTab === 'STATEMENT' ? (
              <table className="report-records w-full text-xs text-left text-slate-700 whitespace-nowrap border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#FDF2F5] border-b border-[#F1DEE3] text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 text-left">P&L Financial Line Item</th>
                    <th className="py-3.5 px-4 text-center">Section</th>
                    <th className="py-3.5 px-4 text-right">Current Period (PKR)</th>
                    <th className="py-3.5 px-4 text-right">% of Net Revenue</th>
                    <th className="py-3.5 px-4 text-right">Prior Period (PKR)</th>
                    <th className="py-3.5 px-4 text-right">Variance / Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.statementRows?.length ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No financial records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    reportData.statementRows.map((line) => {
                      if (line.isHeader) {
                        return (
                          <tr key={line.id} className="bg-slate-100/60 font-bold text-[#23151D]">
                            <td colSpan={6} className="py-2.5 px-4 uppercase tracking-wider text-[11px] text-[#9D2558]">
                              {line.name}
                            </td>
                          </tr>
                        );
                      }

                      if (line.isTotal || line.isMajorTotal || line.isFinalNet) {
                        return (
                          <tr
                            key={line.id}
                            className={`font-bold border-t border-b ${
                              line.isFinalNet
                                ? 'bg-slate-100 font-extrabold text-[#23151D] border-slate-300'
                                : 'bg-slate-50 text-[#23151D] border-slate-200'
                            }`}
                          >
                            <td className="py-2.5 px-4">{line.name}</td>
                            <td className="py-2.5 px-4 text-center text-[10px] text-slate-500 font-mono">
                              {line.isFinalNet ? 'NET RESULT' : 'SUBTOTAL'}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono font-bold ${line.isFinalNet || line.section === 'GROSS_PROFIT' ? (line.currentAmount < 0 ? 'text-red-600' : 'text-green-600') : 'text-[#23151D]'}`}>
                              {formatPKR(line.currentAmount)}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono ${line.isFinalNet ? (line.currentAmount < 0 ? 'text-red-600' : 'text-green-600') : 'text-slate-600'}`}>
                              {line.percentOfRevenue}%
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                              {formatPKR(line.priorAmount)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              {line.growthPercent !== null ? (
                                <span className="text-[#9D2558] font-semibold">
                                  {line.growthPercent >= 0 ? `+${line.growthPercent}%` : `${line.growthPercent}%`}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-4 pl-8 text-slate-800 font-medium flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {line.name}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className="text-[10px] text-slate-400 font-mono">{line.section}</span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-900 font-medium">
                            {formatPKR(line.currentAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">
                            {line.percentOfRevenue}%
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-400">
                            {formatPKR(line.priorAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-600">
                            {line.growthPercent !== null ? `${line.growthPercent}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="report-records w-full text-[13px] text-left text-slate-700 whitespace-nowrap border-collapse min-w-[1000px] font-['Inter',sans-serif]">
                <thead>
                  <tr className="bg-[#FDF2F5] border-b border-[#F1DEE3] text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-3">Account / Line Item</th>
                    <th className="py-3.5 px-3">Classification</th>
                    <th className="py-3.5 px-3">Department / Layer</th>
                    <th className="py-3.5 px-3 text-right">Current Period (PKR)</th>
                    <th className="py-3.5 px-3 text-right">% of Revenue</th>
                    <th className="py-3.5 px-3 text-right">Prior Period (PKR)</th>
                    <th className="py-3.5 px-3 text-right">Variance (PKR)</th>
                    <th className="py-3.5 px-3 text-right">Growth (%)</th>
                    <th className="py-3.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.rows?.length ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No ledger items recorded for this criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((r, i) => (
                      <tr key={`${r.accountName}-${i}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#23151D]">{r.accountName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FDF2F5] text-[#9D2558] border border-[#F1DEE3]">
                            {r.classification}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{r.department}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#23151D]">
                          {formatPKR(r.currentAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{r.percentOfRevenue}%</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(r.priorAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatPKR(r.varianceAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {r.growthPercent !== null ? `${r.growthPercent}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={r.notes}>
                          {r.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reportData && reportData.rows.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold text-[#23151D] border-t-2 border-slate-200 text-xs">
                    <tr>
                      <td className="py-2.5 px-3 text-left">Totals</td>
                      <td className="py-2.5 px-3">—</td>
                      <td className="py-2.5 px-3">{reportData.rows.length} Items</td>
                      <td className={`py-2.5 px-3 text-right ${reportData.totals.netProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPKR(reportData.totals.netProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{reportData.kpis.operatingMarginPercent}%</td>
                      <td className="py-2.5 px-3 text-right">{formatPKR(reportData.kpis.priorOperatingProfit)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {formatPKR(reportData.totals.netProfit - reportData.kpis.priorOperatingProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {reportData.kpis.profitGrowthPercent !== null
                          ? `${reportData.kpis.profitGrowthPercent}%`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-slate-400 pb-6">
        © iSysware Management System
      </div>
    </div>
  );
};

export default COGSReportPage;
