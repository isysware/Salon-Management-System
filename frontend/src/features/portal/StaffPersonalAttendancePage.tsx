import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import { AttendanceRecord, LeaveRecord, OvertimeRecord } from '../../types/salon';
import {
  Clock,
  Calendar,
  Timer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';
import { formatMinutesToTime, parseTimeToMinutes } from '../../lib/attendanceCalculations';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';

export const StaffPersonalAttendancePage: React.FC = () => {
  const { user } = useAuth();

  // Role guard: Staff only
  if (!user || user.role !== 'STAFF') {
    return <AccessDeniedView attemptedPath="/my-attendance" />;
  }

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'LEAVES' | 'OVERTIME'>('ATTENDANCE');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [overtimeStats, setOvertimeStats] = useState<{ approvedMinutes: number; approvedPay: number }>({
    approvedMinutes: 0,
    approvedPay: 0,
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        setLoading(true);
        const [attRes, otRes] = await Promise.all([
          salonService.getStaffPersonalAttendance(user || undefined),
          salonService.getStaffPersonalOvertime(user || undefined),
        ]);

        setAttendanceRecords(attRes.records);
        setLeaveRecords(attRes.leaves);
        setSummaryData(attRes.summary);

        setOvertimeRecords(otRes.records);
        setOvertimeStats({
          approvedMinutes: otRes.approvedMinutes,
          approvedPay: otRes.approvedPay,
        });
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load personal attendance and overtime records.');
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh] font-sans">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <div className="w-6 h-6 rounded-full border-2 border-[#F1DEE3] border-t-[#B82E69] animate-spin shrink-0" />
          <span>Loading personal shift attendance & overtime profile...</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 max-w-7xl mx-auto font-sans">
        <div className="p-4 rounded-[24px] bg-rose-50/80 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 backdrop-blur-xl shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load staff profile</p>
            <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  const allowance = summaryData?.allowance;

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* ── PERSONAL PROFILE HERO CARD (VELVET WINE & PLUM GRADIENT - ZERO BLUE) ── */}
      <div className="bg-gradient-to-br from-[#9D2558] via-[#851C47] to-[#450A24] rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden border border-white/20">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/5 -skew-x-12 pointer-events-none" />
        <div className="absolute -right-4 -bottom-4 w-40 h-40 opacity-10 pointer-events-none">
          <Clock className="w-full h-full stroke-[1.2]" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white border border-white/25 backdrop-blur-md shadow-2xs">
                Staff Personal Portal
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#FCE8EC] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F8BBD0]" />
                Personal Biometric Records
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
              {summaryData?.staffName || user?.name}
            </h1>
            <p className="text-xs text-[#FCE8EC]/90 mt-1 flex items-center gap-1.5">
              <span className="font-semibold">{summaryData?.roleTitle || 'Stylist'}</span>
              <span>•</span>
              <span>Shift: {summaryData?.startTime
                ? `${formatMinutesToTime(parseTimeToMinutes(summaryData.startTime))} - ${formatMinutesToTime(parseTimeToMinutes(summaryData.endTime))}`
                : '09:00 AM - 06:00 PM'}
                {summaryData?.isOvernightShift && ' (Overnight)'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-xs shadow-2xs">
            <div>
              <span className="text-[#FCE8EC] block text-[10px] uppercase font-bold tracking-wider">Approved Overtime</span>
              <span className="text-xl font-extrabold text-white font-mono tabular-nums">{overtimeStats.approvedMinutes} mins</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <span className="text-[#FCE8EC] block text-[10px] uppercase font-bold tracking-wider">Earned Overtime Pay</span>
              <span className="text-xl font-extrabold text-emerald-300 font-mono tabular-nums">
                Rs. {overtimeStats.approvedPay.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION (FROSTED PILL DOCK) ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#FDF2F5] border border-white/80 shadow-inner">
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'ATTENDANCE'
              ? 'bg-[#B82E69] text-white shadow-[0_4px_16px_rgba(184,46,105,0.22)]'
              : 'text-[#78616C] hover:text-[#18191B] hover:bg-white/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Shift Attendance ({attendanceRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('LEAVES')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'LEAVES'
              ? 'bg-[#B82E69] text-white shadow-[0_4px_16px_rgba(184,46,105,0.22)]'
              : 'text-[#78616C] hover:text-[#18191B] hover:bg-white/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Leave History ({leaveRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('OVERTIME')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'OVERTIME'
              ? 'bg-[#B82E69] text-white shadow-[0_4px_16px_rgba(184,46,105,0.22)]'
              : 'text-[#78616C] hover:text-[#18191B] hover:bg-white/60'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>My Approved Overtime ({overtimeRecords.length})</span>
        </button>
      </div>

      {/* ── TAB CONTENT 1: ATTENDANCE RECORDS ─────────────────────────────── */}
      {activeTab === 'ATTENDANCE' && (
        <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
          <div className="p-5 border-b border-black/5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#18191B] text-base tracking-tight">Daily Punch Record & Worked Hours</h3>
              <p className="text-xs text-[#78616C] mt-0.5">Chronological biometric logs and punctuality tracking</p>
            </div>
            <span className="text-xs text-[#78616C] font-semibold bg-[#FAF8F9] px-3 py-1 rounded-full border border-white/80">
              {attendanceRecords.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="report-records w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F9]/80 border-b border-black/5 text-[11px] font-semibold text-[#78616C] uppercase tracking-wider">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-3">Check-In</th>
                  <th className="py-3 px-3">Check-Out</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Punctuality Notes</th>
                  <th className="py-3 px-5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-[#18191B]">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#78616C]">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No shift punches recorded yet</p>
                      <p className="text-xs text-slate-400 mt-0.5">Biometric or manual check-in punches will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-white/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#18191B]">{r.date}</td>
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-[#18191B] font-mono">{r.checkIn}</span>
                        {r.isLate && (
                          <span className="inline-block ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            +{r.lateMinutes}m
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {r.checkOut ? (
                          <>
                            <span className="font-semibold text-[#18191B] font-mono">{r.checkOut}</span>
                            {r.isEarlyExit && (
                              <span className="inline-block ml-1.5 text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                                -{r.earlyExitMinutes}m
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-purple-600 text-[11px] font-semibold">Missing check-out</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#18191B] font-mono tabular-nums">
                        {r.workedHours > 0 ? `${r.workedHours.toFixed(2)} hrs` : '0.00 hrs'}
                      </td>
                      <td className="py-3.5 px-3">
                        {r.status === 'PRESENT' || r.status === 'COMPLETED' || r.status === 'ON_TIME' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        ) : r.status === 'PAID_LEAVE' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F5] text-[#851C47] border border-[#F1DEE3]">
                            Paid Leave
                          </span>
                        ) : r.status === 'UNPAID_LEAVE' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Unpaid Leave
                          </span>
                        ) : r.status === 'ABSENT' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Missing Punch
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-[#78616C] text-[11px]">{r.notes || '—'}</td>
                      <td className="py-3.5 px-5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {r.source || 'MANUAL'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: LEAVES ─────────────────────────────────────────── */}
      {activeTab === 'LEAVES' && (
        <div className="space-y-4">
          {/* Allowance Summary Card */}
          <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] p-6">
            <h3 className="font-bold text-[#18191B] text-base mb-3 tracking-tight">Leave Allowance & Usage Balance</h3>
            {allowance && allowance.isConfigured ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white/80 rounded-2xl border border-white/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-[#78616C] uppercase tracking-wider">Policy Cycle</span>
                  <p className="text-sm font-bold text-[#18191B] mt-1">{allowance.period}</p>
                </div>
                <div className="p-4 bg-[#FDF2F5]/80 rounded-2xl border border-[#F8D2DC]/60 shadow-2xs">
                  <span className="text-[10px] font-bold text-[#B82E69] uppercase tracking-wider">Total Allowed</span>
                  <p className="text-xl font-extrabold text-[#18191B] font-mono tabular-nums mt-1">{allowance.allowedDays} days</p>
                </div>
                <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/60 shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Consumed</span>
                  <p className="text-xl font-extrabold text-amber-900 font-mono tabular-nums mt-1">{allowance.usedDays} days</p>
                </div>
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/60 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Remaining</span>
                  <p className="text-xl font-extrabold text-emerald-900 font-mono tabular-nums mt-1">{allowance.remainingDays} days</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-amber-900 text-xs shadow-2xs">
                Paid leave allowance is <strong>Not configured</strong> on your employee profile.
                Any approved leaves will be treated as unpaid leave.
              </div>
            )}
          </div>

          {/* Leaves Table */}
          <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
            <div className="p-5 border-b border-black/5">
              <h3 className="font-bold text-[#18191B] text-base tracking-tight">Approved Leave History</h3>
              <p className="text-xs text-[#78616C] mt-0.5">Formal leave applications and manager approval status</p>
            </div>
            <div className="overflow-x-auto">
              <table className="report-records w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F9]/80 border-b border-black/5 text-[11px] font-semibold text-[#78616C] uppercase tracking-wider">
                    <th className="py-3 px-5">Leave Voucher #</th>
                    <th className="py-3 px-3">Date Range</th>
                    <th className="py-3 px-3">Working Days</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-[#18191B]">
                  {leaveRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#78616C]">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No leaves logged</p>
                        <p className="text-xs text-slate-400 mt-0.5">Approved employee leaves will be summarized here.</p>
                      </td>
                    </tr>
                  ) : (
                    leaveRecords.map((l) => (
                      <tr key={l.id} className="hover:bg-white/60 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-[#851C47]">{l.leaveNumber}</td>
                        <td className="py-3.5 px-3 font-medium font-mono text-[11px]">
                          {l.startDate} to {l.endDate}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-[#18191B] font-mono tabular-nums">{l.totalDays} days</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              l.type === 'PAID'
                                ? 'bg-[#FDF2F5] text-[#851C47] border border-[#F1DEE3]'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {l.type === 'PAID' ? 'Paid Leave' : 'Unpaid Leave'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              l.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-[#78616C]">{l.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: OVERTIME ───────────────────────────────────────── */}
      {activeTab === 'OVERTIME' && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-[#FDF2F5] via-[#FFF5F7] to-[#FCE8EC] rounded-2xl border border-[#F8D2DC]/60 flex items-start gap-3 shadow-2xs">
            <Info className="w-5 h-5 text-[#B82E69] shrink-0 mt-0.5" />
            <div className="text-xs text-[#18191B] space-y-0.5">
              <p className="font-bold">Overtime Payout Verification Policy</p>
              <p className="text-[#78616C] leading-relaxed">
                Only manually submitted overtime entries officially <strong>Approved</strong> by the Branch Admin or Super Admin are counted towards your monthly payout. Pending entries are shown for audit visibility.
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
            <div className="p-5 border-b border-black/5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#18191B] text-base tracking-tight">Personal Overtime Vouchers</h3>
                <p className="text-xs text-[#78616C] mt-0.5">Itemized overtime logs and verified rate payouts</p>
              </div>
              <div className="text-xs font-semibold text-[#18191B]">
                Total Verified Pay:{' '}
                <span className="text-emerald-700 font-bold font-mono">
                  Rs. {overtimeStats.approvedPay.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="report-records w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F9]/80 border-b border-black/5 text-[11px] font-semibold text-[#78616C] uppercase tracking-wider">
                    <th className="py-3 px-5">Voucher #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Minutes</th>
                    <th className="py-3 px-3">Rate</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Payable Amount</th>
                    <th className="py-3 px-5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-[#18191B]">
                  {overtimeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#78616C]">
                        <Timer className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No overtime entries recorded</p>
                        <p className="text-xs text-slate-400 mt-0.5">Submitted overtime entries will display here for audit.</p>
                      </td>
                    </tr>
                  ) : (
                    overtimeRecords.map((ot) => (
                      <tr key={ot.id} className="hover:bg-white/60 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-[#851C47]">
                          {ot.overtimeNumber || ot.id}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px]">{ot.date}</td>
                        <td className="py-3.5 px-3 font-semibold font-mono tabular-nums">
                          {ot.status === 'APPROVED' ? ot.approvedMinutes : ot.minutes} mins (
                          {(((ot.status === 'APPROVED' ? ot.approvedMinutes : ot.minutes) || 0) / 60).toFixed(1)}h)
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap text-[#78616C] font-mono">
                          Rs. {(ot.hourlyRate ?? 0).toLocaleString()}/hr
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {ot.status === 'APPROVED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          ) : ot.status === 'SUBMITTED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Submitted (Pending)
                            </span>
                          ) : ot.status === 'REJECTED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {ot.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {ot.status === 'APPROVED' ? (
                            <span className="font-bold text-emerald-700 font-mono tabular-nums">
                              Rs. {(ot.amount || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-mono">
                              Rs. {(ot.amount || 0).toLocaleString()} (Unapproved)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-[#78616C]">{ot.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
