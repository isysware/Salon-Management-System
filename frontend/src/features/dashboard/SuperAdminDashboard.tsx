import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, SuperAdminDashboardData } from '../../services';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { BranchOperationalSections } from './components/BranchOperationalSections';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  RefreshCw,
  ArrowRight,
  ChevronDown,
  Building2,
  Check,
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { demoDate, allBranches } = useAuth();
  const [activeBranchId, setDashboardBranch] = useState('ALL');
  const { navigate } = useRouter();

  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent race conditions on rapid branch changes
  const activeBranchRef = useRef(activeBranchId);
  activeBranchRef.current = activeBranchId;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salonService.getSuperAdminDashboardData(activeBranchId);
      if (activeBranchRef.current === activeBranchId) {
        setData(res);
      }
    } catch (err: any) {
      if (activeBranchRef.current === activeBranchId) {
        setError(err.message || 'Failed to aggregate cross-branch metrics.');
      }
    } finally {
      if (activeBranchRef.current === activeBranchId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranchId, demoDate]);

  if (isLoading && !data) {
    return (
      <div className="py-32 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-3 max-w-lg mx-auto">
          <p className="font-semibold text-sm">Failed to Load Dashboard</p>
          <p>{error}</p>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeBranchName =
    activeBranchId === 'ALL'
      ? 'All Branches'
      : allBranches?.find((b) => b.id === activeBranchId)?.name || 'Branch';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* ── TOP HEADER / OVERVIEW BAR (CLEAN SINGLE ROW, NO OVERFLOW) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-0">
        {/* Title + Subtitle */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#18191B]">
            Executive Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.isConsolidated
              ? 'Consolidated multi-location analytics and real-time enterprise performance.'
              : `Operational performance and financials for ${data.activeBranchName}.`}
          </p>
        </div>

        {/* Clean Controls: Single-Row, Never Wraps */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
          {/* Branch Filter Switcher (Radix DropdownMenu - NO HTML SELECT) */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-xl bg-white/80 backdrop-blur-xl border-0 shadow-[0_4px_16px_rgba(35,21,29,0.03)] hover:bg-white transition-all text-xs font-semibold text-slate-700 cursor-pointer outline-none shrink-0 min-w-[130px] max-w-[200px]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-[#B82E69] shrink-0" />
                  <span className="truncate">{activeBranchName}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-56 p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(35,21,29,0.08)] border-0 bg-white/90 backdrop-blur-2xl"
            >
              <DropdownMenuItem
                onClick={() => setDashboardBranch('ALL')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer ${
                  activeBranchId === 'ALL' ? 'bg-[#FDF2F5] text-[#B82E69] font-bold' : 'text-slate-700 hover:bg-[#FAF8F9]'
                }`}
              >
                <span>All Branches</span>
                {activeBranchId === 'ALL' && <Check className="w-3.5 h-3.5 text-[#B82E69]" />}
              </DropdownMenuItem>
              {allBranches?.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onClick={() => setDashboardBranch(b.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer ${
                    activeBranchId === b.id ? 'bg-[#FDF2F5] text-[#B82E69] font-bold' : 'text-slate-700 hover:bg-[#FAF8F9]'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {activeBranchId === b.id && <Check className="w-3.5 h-3.5 text-[#B82E69]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={loadData}
            className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-xl border-0 shadow-[0_4px_16px_rgba(35,21,29,0.03)] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white transition-all cursor-pointer shrink-0"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Financials CTA */}
          <button
            type="button"
            onClick={() => navigate('/reports/income-expense')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#18191B] hover:bg-black text-white text-xs font-semibold border-0 shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition-all cursor-pointer shrink-0"
          >
            <span>Financials</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </div>

      {/* ── SHARED BRANCH OPERATIONAL & ANALYTICAL SECTIONS ── */}
      <BranchOperationalSections
        branchId={data.activeBranchId}
        metrics={data.metrics}
        onlineAccounts={data.onlineAccounts}
        todayAppointments={data.todayAppointments}
        recentInvoices={data.recentInvoices}
        cashDrawers={data.cashDrawers}
        totalClientsCount={data.totalClientsCount}
        totalServicesCount={data.totalServicesCount}
        totalAppointmentsCount={data.totalAppointmentsCount}
        staffList={data.staffList}
        revenueTrend={data.revenueTrend}
        categoryBreakdown={data.categoryBreakdown}
        onNavigateAppointments={() => navigate('/operations/appointments')}
        onNavigateBookings={() => navigate('/operations/bookings')}
        onNavigateInvoices={() => navigate('/reports/sales-invoices')}
        onNavigateAccounts={() => navigate('/reports/debit-credit')}
        onNavigateSettlement={() => navigate('/accounts/account-settlement')}
      />

      {/* ── BRANCH PERFORMANCE COMPARISON MATRIX (CONSOLIDATED VIEW) ── */}
      {data.isConsolidated && (
        <Card variant="glass" padding="none" className="overflow-hidden rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white relative">
          <div className="p-5 sm:p-6 border-0 flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-base font-semibold text-[#18191B] tracking-tight">
                Branch Performance Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidated comparison across verified branch locations
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FDF2F5] text-[#B82E69] border-0 shadow-2xs">
              {data.branchStats.length} Locations Monitored
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="report-records w-full text-xs text-left">
              <thead className="bg-[#FAF8F9]/80 text-slate-700 font-semibold border-0">
                <tr>
                  <th className="py-3.5 px-5">Branch Name & Code</th>
                  <th className="py-3.5 px-4 text-right">Gross Sales</th>
                  <th className="py-3.5 px-4 text-right">Actual Collections</th>
                  <th className="py-3.5 px-4 text-right">Cash in Till</th>
                  <th className="py-3.5 px-4 text-right">Bank Balance</th>
                  <th className="py-3.5 px-4 text-center">Active Staff</th>
                  <th className="py-3.5 px-4 text-center">Appointments</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-0">
                {data.branchStats.map((branch) => (
                  <tr key={branch.branchId} className="hover:bg-white/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{branch.branchName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{branch.branchCode}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 tabular-nums">
                      {formatCurrency(branch.grossSales)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                      {formatCurrency(branch.actualCollections)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-800">
                      {formatCurrency(branch.cashInCustody)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-800 font-medium">
                      {formatCurrency(branch.onlineBalancesTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {branch.activeStaffOnDuty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-800">
                      {branch.appointmentsTodayCount}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl h-8 text-xs border-0 bg-white/80 hover:bg-white shadow-2xs text-[#78616C]"
                        onClick={() => setDashboardBranch(branch.branchId)}
                      >
                        Inspect Branch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
