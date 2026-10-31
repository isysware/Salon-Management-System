import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, AdminDashboardData } from '../../services';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BranchOperationalSections } from './components/BranchOperationalSections';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  Building2,
  Lock,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  Link2,
  Calendar,
  ChevronDown,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, demoDate } = useAuth();
  const { navigate } = useRouter();

  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userBranchRef = useRef(user?.branchId);
  userBranchRef.current = user?.branchId;

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const branchId = user.branchId || '';
      const res = await salonService.getAdminDashboardData(branchId);
      if (userBranchRef.current === user.branchId) {
        setData(res);
      }
    } catch (err: any) {
      if (userBranchRef.current === user.branchId) {
        setError(err.message || 'Unauthorized branch context.');
      }
    } finally {
      if (userBranchRef.current === user.branchId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user, demoDate]);

  if (isLoading && !data) {
    return (
      <div className="py-32 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Card padding="lg" className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Branch Access Restriction</h2>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
          </div>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry Verification
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* ── TOP HEADER / OVERVIEW BAR (DIRECT MATCH TO REFERENCE IMAGE) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title + Subtitle */}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B]">
              {data.branch.name}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FDF2F5] text-[#B82E69] border-0 shadow-2xs">
              Overview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time branch sales, staff queues, appointments and daily cash settlement.
          </p>
        </div>

        {/* Clean Controls: Single-Row, Never Wraps */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
          {/* Assigned Branch Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-xl border-0 shadow-[0_4px_16px_rgba(35,21,29,0.03)] text-slate-700 font-semibold text-xs shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#B82E69]" />
            <span>{data.branch.name}</span>
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={loadData}
            className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-xl border-0 shadow-[0_4px_16px_rgba(35,21,29,0.03)] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white transition-all cursor-pointer shrink-0"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Primary CTA: Open POS Terminal */}
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#B82E69] hover:bg-[#A02358] text-white text-xs font-semibold border-0 shadow-[0_4px_14px_rgba(184,46,105,0.3)] transition-all cursor-pointer shrink-0"
          >
            <span>POS Billing</span>
            <ArrowRight className="w-3.5 h-3.5 text-white/80" />
          </button>
        </div>
      </div>

      {/* ── SHARED BRANCH OPERATIONAL METRICS & DRAWS ── */}
      <BranchOperationalSections
        branchId={user?.branchId}
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

      {/* ── STAFF ATTENDANCE SUMMARY FOR BRANCH ADMIN ── */}
      <Card variant="glass" padding="none" className="p-6 overflow-hidden relative group rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-gradient-to-br from-[#B82E69]/10 via-[#FCE8EC]/20 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
        <div className="relative z-10 flex items-center justify-between pb-4 border-0 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#18191B] tracking-tight">
              Staff Active On Duty Today
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.staffAttendanceSummary.presentCount} of {data.staffAttendanceSummary.totalCount} stylists verified on duty in {data.branch.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50/80 text-emerald-700 border-0 shadow-2xs">
              Punch Log Active
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl h-8 text-xs border-0 bg-white/80 hover:bg-white shadow-2xs text-[#78616C]"
              onClick={() => navigate('/operations/attendance')}
            >
              Manage Attendance
            </Button>
          </div>
        </div>

        {data.staffAttendanceSummary.onDutyStaffNames.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No staff members checked in or active on duty today yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
            {data.staffAttendanceSummary.onDutyStaffNames.map((name, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl border-0 bg-white/80 backdrop-blur-xl hover:bg-white flex items-center justify-between shadow-[0_4px_16px_rgba(35,21,29,0.025)] transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FDF2F5] text-[#B82E69] flex items-center justify-center text-xs font-bold border-0 shadow-2xs">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{name}</p>
                    <p className="text-[10px] text-slate-400">Shift verified on duty</p>
                  </div>
                </div>

                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-full border-0">
                  Checked In
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-0 flex items-center justify-between text-xs">
          <span className="text-slate-400">Need to record approved manual overtime?</span>
          <button
            onClick={() => navigate('/operations/manual-overtime')}
            className="font-semibold text-[#B82E69] hover:underline cursor-pointer"
          >
            Manual Overtime Entry →
          </button>
        </div>
      </Card>
    </div>
  );
};
