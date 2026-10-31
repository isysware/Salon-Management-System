import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import { CashDrawer, OnlineAccount, SalaryAdvance, StaffMember } from '../../types/salon';
import { Building2, Info, Wallet } from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import { PayrollExtrasPanel } from './PayrollExtrasPanel';
import { toast } from '../../context/ToastContext';

const rs = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;

/**
 * Staff loans (salary advances). Money leaves now from the issuer's open cash drawer or a
 * branch online account; it is a staff receivable, not an expense, and is recovered from
 * payroll in monthly installments.
 */
export const StaffLoansPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/accounts/staff-loans" />;
  }

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user.role === 'SUPER_ADMIN' ? (activeBranchId || user.branchId || allBranches[0]?.id || '') : (user.branchId || activeBranchId || '')
  );

  useEffect(() => {
    if (!selectedBranchId) {
      const fallback = activeBranchId || user.branchId || allBranches[0]?.id || '';
      if (fallback) setSelectedBranchId(fallback);
    }
  }, [activeBranchId, user.branchId, allBranches, selectedBranchId]);

  const branchId = user.role === 'SUPER_ADMIN' ? selectedBranchId : (user.branchId || activeBranchId);
  const month = (demoDate || new Date().toISOString().slice(0, 10)).slice(0, 7);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [onlineAccounts, setOnlineAccounts] = useState<OnlineAccount[]>([]);
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      salonService.getStaff(branchId),
      salonService.getOnlineAccounts(branchId),
      salonService.getCashDrawers(branchId),
      salonService.getSalaryAdvances(branchId),
    ])
      .then(([staff, accounts, drawers, loans]) => {
        setStaffList(staff);
        setOnlineAccounts(accounts);
        setCashDrawers(drawers);
        setAdvances(loans);
      })
      .catch((e) => console.warn('Initial staff loans load error:', e));
  }, [branchId, refreshKey]);

  const myDrawer = cashDrawers.find((d) => d.branchId === branchId && d.custodianUserId === user.id && d.status === 'OPEN');

  const totals = useMemo(() => {
    const live = advances.filter((a) => a.status !== 'REVERSED');
    return {
      active: advances.filter((a) => a.status === 'ACTIVE').length,
      given: live.reduce((s, a) => s + a.amount, 0),
      recovered: live.reduce((s, a) => s + a.recoveredAmount, 0),
      outstanding: live.reduce((s, a) => s + a.balance, 0),
    };
  }, [advances]);

  return (
    <div className="w-full max-w-full space-y-6 text-slate-800 font-sans">
      {/* ── 1. TOP HEADER BANNER (FROSTED GLASS CONTAINER) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FDF2F5] to-white border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69] shrink-0">
              <Wallet className="w-5 h-5 text-[#B82E69]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight truncate">
                Staff Loans & Advances
              </h1>
              <p className="text-xs text-[#78616C] font-medium mt-0.5 line-clamp-1 xl:line-clamp-none">
                Issue salary advances from cash drawer or online account, recovered via payroll installments
              </p>
            </div>
          </div>
        </div>

        {user.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch:</span>
            <select
              className="text-xs rounded-xl border border-white/80 bg-white/80 hover:bg-white px-3 py-1.5 text-slate-800 shadow-2xs font-medium transition-all cursor-pointer"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">Select branch</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 2. INFO ALERT BANNER ── */}
      <div className="p-4 rounded-2xl border border-[#F1DEE3] bg-[#FDF2F5]/80 text-[#78616C] flex gap-3 text-xs backdrop-blur-sm shadow-2xs">
        <Info className="w-4 h-4 text-[#B82E69] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div>
            <strong className="text-slate-800">Funding source:</strong> Cash disbursements come from your open cash drawer{myDrawer ? ` (expected ${rs(myDrawer.expectedInDrawer)})` : ' — open a drawer first'}; Online payouts disburse from an active branch bank account.
          </div>
          <div>
            <strong className="text-slate-800">Recovery cycle:</strong> Monthly installments are automatically deducted from the staff payslip upon payroll finalization.
          </div>
          <div>
            A loan is an asset receivable and does not distort operating expenses; salary expense is recognized when payroll is finalized.
          </div>
        </div>
      </div>

      {/* ── 3. KPI SUMMARY CARDS: PURE WHITE FROSTED GLASS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Loans */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Active
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {totals.active}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Currently active loan accounts
            </span>
          </div>
        </div>

        {/* Total Given */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="bg-blue-50 text-blue-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Disbursed
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {rs(totals.given)}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Total cumulative principal given
            </span>
          </div>
        </div>

        {/* Recovered */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="bg-emerald-50 text-emerald-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Recovered
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums tracking-tight block">
              {rs(totals.recovered)}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Total recovered via payroll deductions
            </span>
          </div>
        </div>

        {/* Outstanding */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-rose-600">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="bg-rose-50 text-rose-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Balance
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono tabular-nums tracking-tight block">
              {rs(totals.outstanding)}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Remaining staff receivables balance
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. LOAN DISBURSEMENT & REGISTER ACTIONS ── */}
      {branchId && (
        <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] p-5 sm:p-6 overflow-hidden">
          <PayrollExtrasPanel
            key={`${branchId}-${refreshKey}`}
            view="ADVANCES"
            branchId={branchId}
            month={month}
            staffList={staffList}
            onlineAccounts={onlineAccounts}
            hasOpenDrawer={!!myDrawer}
            onFeedback={(type, message) => {
              if (type === 'error') toast.error(message);
              else toast.success(message);
              if (type === 'success') setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      )}
    </div>
  );
};
