import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Appointment,
  AppointmentStatus,
  Branch,
  StaffMember,
} from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  List,
  Grid,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Receipt,
  FileCheck,
  RefreshCw,
  Building2,
  Phone,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LuxurySelect } from '@/components/ui/LuxurySelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookingFormModal } from './components/BookingFormModal';
import { AppointmentDetailsModal } from './components/AppointmentDetailsModal';
import { RescheduleModal } from './components/RescheduleModal';
import { ConfirmationMessageModal } from './components/ConfirmationMessageModal';

// Status badge helper
const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-[#FDF2F5]',
    text: 'text-[#23151D]',
    border: 'border-[#F1DEE3]',
    dot: 'bg-[#9D2558]',
  },
  CHECKED_IN: {
    label: 'Checked In',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  IN_SERVICE: {
    label: 'In Service',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  NO_SHOW: {
    label: 'No-Show',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'bg-[#FDF2F5]',
    text: 'text-[#23151D]',
    border: 'border-[#F1DEE3]',
    dot: 'bg-[#9D2558]',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Current view mode: calendar or list
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Month navigation: year and month (0-indexed)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  // Filter state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBillingStatus, setSelectedBillingStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingInitialDate, setBookingInitialDate] = useState<string | undefined>(undefined);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);

  const [selectedAppointmentForDetails, setSelectedAppointmentForDetails] = useState<Appointment | null>(null);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [confirmationMessageApptId, setConfirmationMessageApptId] = useState<string | null>(null);

  // Day overflow dialog state
  const [selectedDayForDialog, setSelectedDayForDialog] = useState<string | null>(null);

  // Initialize branches and branch selection
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [loadedBranches, loadedStaff] = await Promise.all([
          salonService.getBranches(),
          salonService.getStaff('ALL'),
        ]);
        setBranches(loadedBranches);
        setStaffList(loadedStaff);

        if (user?.role === 'SUPER_ADMIN') {
          setSelectedBranchId('ALL');
        } else if (user?.branchId) {
          setSelectedBranchId(user.branchId);
        } else if (loadedBranches.length > 0) {
          setSelectedBranchId(loadedBranches[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial branches/staff', err);
      }
    }
    loadInitialData();
  }, [user]);

  // Load appointments
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date window for current month (with +/- 7 days margin for calendar display)
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      // Pad 7 days before and after
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + 7);

      const dateFrom = startDate.toISOString().split('T')[0];
      const dateTo = endDate.toISOString().split('T')[0];

      const loaded = await salonService.getAppointments(
        selectedBranchId,
        {
          startDate: dateFrom,
          endDate: dateTo,
          status: selectedStatus !== 'ALL' ? (selectedStatus as AppointmentStatus) : undefined,
          staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
          search: searchQuery.trim() || undefined,
        },
        user || undefined
      );

      // Secondary client-side billing filter if selected
      let filtered = loaded;
      if (selectedBillingStatus === 'BILLED') {
        filtered = filtered.filter((a) => a.billingStatus === 'BILLED');
      } else if (selectedBillingStatus === 'UNBILLED') {
        filtered = filtered.filter((a) => a.billingStatus !== 'BILLED');
      }

      setAppointments(filtered);
    } catch (err) {
      console.error('Failed to fetch appointments', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentYear,
    currentMonth,
    selectedBranchId,
    selectedStaffId,
    selectedStatus,
    selectedBillingStatus,
    searchQuery,
  ]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Open booking modal
  const handleOpenBooking = (initialDateStr?: string) => {
    setBookingInitialDate(initialDateStr);
    setAppointmentToEdit(null);
    setIsBookingModalOpen(true);
  };

  const handleEditAppointment = (appt: Appointment) => {
    setSelectedAppointmentForDetails(null);
    setAppointmentToEdit(appt);
    setIsBookingModalOpen(true);
  };

  const handleOpenReschedule = (appt: Appointment) => {
    setSelectedAppointmentForDetails(null);
    setAppointmentToReschedule(appt);
  };

  // Calendar Day Grid Computation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const dayOfWeekFirst = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Days from previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = dayOfWeekFirst - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const dateString = prevDate.toISOString().split('T')[0];
      days.push({
        dateString,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateString = `${currentYear}-${monthStr}-${dayStr}`;
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
      });
    }

    // Days from next month to fill grid (35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const dateString = nextDate.toISOString().split('T')[0];
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Group appointments by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const list = map.get(appt.date) || [];
      list.push(appt);
      map.set(appt.date, list);
    }
    // Sort each day's appointments by start time
    map.forEach((list) => {
      list.sort((a, b) => {
        const timeA = a.startTime || a.time || '00:00';
        const timeB = b.startTime || b.time || '00:00';
        return timeA.localeCompare(timeB);
      });
    });
    return map;
  }, [appointments]);

  // Appointments for Day Dialog
  const selectedDayAppointments = useMemo(() => {
    if (!selectedDayForDialog) return [];
    return appointmentsByDate.get(selectedDayForDialog) || [];
  }, [selectedDayForDialog, appointmentsByDate]);

  // Active branch for booking (fallback to first branch if 'ALL')
  const defaultBookingBranchId = useMemo(() => {
    if (selectedBranchId !== 'ALL') return selectedBranchId;
    if (user?.branchId) return user.branchId;
    return branches[0]?.id || '';
  }, [selectedBranchId, user, branches]);

  // Summary KPIs for Appointments
  const appointmentKPIs = useMemo(() => {
    const totalCount = appointments.length;
    const activeCount = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'IN_SERVICE' || a.status === 'CHECKED_IN').length;
    const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;
    const estValue = appointments.reduce((sum, a) => sum + ((a as any).estimatedPrice || a.price || 0), 0);
    return { totalCount, activeCount, completedCount, estValue };
  }, [appointments]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FDF2F5] to-white border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69] shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight truncate">
                Appointment Calendar & Booking
              </h1>
              <p className="text-xs text-[#78616C] font-medium line-clamp-1 xl:line-clamp-none mt-0.5">
                Salon chair scheduling, multi-staff service assignments, live conflict detection & billing handoff.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          {/* Calendar / List View Toggle */}
          <div className="flex items-center bg-[#FDF2F5] p-1 rounded-2xl border border-white/60 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#B82E69] shadow-xs'
                  : 'text-[#78616C] hover:text-[#B82E69]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-white text-[#B82E69] shadow-xs'
                  : 'text-[#78616C] hover:text-[#B82E69]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchAppointments}
            disabled={isLoading}
            className="text-xs gap-1.5 h-9 px-3.5 shrink-0 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-slate-700 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenBooking()}
            className="bg-[#B82E69] hover:bg-[#A02358] text-white text-xs font-semibold gap-1.5 h-9 px-4 rounded-xl shadow-xs shrink-0 whitespace-nowrap transition-all"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* KPI Cards Row - Pure White Frosted Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Appointments */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span className="bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Month
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {appointmentKPIs.totalCount}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Total appointments scheduled
            </span>
          </div>
        </div>

        {/* Confirmed / Active */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="bg-purple-50 text-purple-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              In Service
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {appointmentKPIs.activeCount}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Active, confirmed & chair duty
            </span>
          </div>
        </div>

        {/* Completed Treatments */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="bg-emerald-50 text-emerald-700 shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Completed
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {appointmentKPIs.completedCount}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Finished & billed sessions
            </span>
          </div>
        </div>

        {/* Estimated Volume Value */}
        <div className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80 flex items-center justify-center text-[#B82E69]">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="bg-[#FAF8F9] text-[#78616C] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Estimated
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight block">
              {formatCurrency(appointmentKPIs.estValue)}
            </span>
            <span className="text-xs text-[#78616C] font-medium mt-1 block">
              Estimated treatment value
            </span>
          </div>
        </div>
      </div>

      {/* Month Navigator & Calendar Filters Bar */}
      <div className="p-4 sm:p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-white/60">
          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center border border-white/80 rounded-xl overflow-hidden bg-white/80 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                className="h-8 px-2.5 hover:bg-[#FDF2F5] text-slate-700 rounded-none"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-8 px-3 text-xs font-bold hover:bg-[#FDF2F5] text-[#B82E69] rounded-none border-x border-white/80"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="h-8 px-2.5 hover:bg-[#FDF2F5] text-slate-700 rounded-none"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-[#18191B] ml-2 whitespace-nowrap tracking-tight">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search client, phone, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border border-white/80 bg-white/80 backdrop-blur-md shadow-2xs focus:bg-white"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Branch Filter */}
          <LuxurySelect
            label="Branch"
            value={selectedBranchId}
            onValueChange={setSelectedBranchId}
            disabled={user?.role !== 'SUPER_ADMIN'}
            options={[
              ...(user?.role === 'SUPER_ADMIN' ? [{ value: 'ALL', label: 'All Branches' }] : []),
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            placeholder="All Branches"
          />

          {/* Staff Filter */}
          <LuxurySelect
            label="Staff Member"
            value={selectedStaffId}
            onValueChange={setSelectedStaffId}
            options={[
              { value: 'ALL', label: 'All Stylists & Staff' },
              ...staffList
                .filter((s) => selectedBranchId === 'ALL' || s.branchId === selectedBranchId)
                .map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.roleTitle || s.designation || 'Staff'})`,
                })),
            ]}
            placeholder="All Stylists & Staff"
          />

          {/* Appointment Status Filter */}
          <LuxurySelect
            label="Appointment Status"
            value={selectedStatus}
            onValueChange={setSelectedStatus}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'CHECKED_IN', label: 'Checked In' },
              { value: 'IN_SERVICE', label: 'In Service' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'NO_SHOW', label: 'No-Show' },
            ]}
            placeholder="All Statuses"
          />

          {/* Billing Status Filter */}
          <LuxurySelect
            label="Billing Status"
            value={selectedBillingStatus}
            onValueChange={setSelectedBillingStatus}
            options={[
              { value: 'ALL', label: 'All Billing States' },
              { value: 'UNBILLED', label: 'Unbilled' },
              { value: 'BILLED', label: 'Billed (Invoice Created)' },
            ]}
            placeholder="All Billing States"
          />
        </div>
      </div>

      {/* Main View Area: Calendar or List */}
      {viewMode === 'calendar' ? (
        <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[700px] xl:min-w-0">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-white/60 bg-[#FAF8F9]/80 backdrop-blur-md">
                {WEEKDAY_NAMES.map((w, idx) => (
                  <div
                    key={w}
                    className={`py-3 text-center text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
                      idx === 0 || idx === 6 ? 'text-[#B82E69]' : 'text-[#18191B]'
                    }`}
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-white/50 min-h-[580px] sm:min-h-[660px]">
            {calendarDays.map((cell) => {
              const dayAppts = appointmentsByDate.get(cell.dateString) || [];
              const hasOverflow = dayAppts.length > 3;
              const displayAppts = hasOverflow ? dayAppts.slice(0, 3) : dayAppts;
              const overflowCount = dayAppts.length - 3;

              return (
                <div
                  key={cell.dateString}
                  className={`min-h-[128px] p-2 flex flex-col justify-between transition-colors group relative ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                  } ${cell.isToday ? 'bg-[#FDF2F5]/50 ring-1 ring-inset ring-[#9D2558]/20' : ''}`}
                >
                  {/* Top Bar of cell: Day Number + Add Button */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full transition-all ${
                        cell.isToday
                          ? 'bg-[#9D2558] text-white shadow-xs scale-105'
                          : cell.isCurrentMonth
                          ? 'text-[#23151D] hover:bg-slate-100'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add button on hover */}
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(cell.dateString)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-[#9D2558] hover:bg-[#FCE8EC] rounded-lg"
                      title={`Book for ${cell.dateString}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Appointments list */}
                  <div className="space-y-1.5 flex-1 overflow-hidden">
                    {displayAppts.map((appt) => {
                      const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                      const isBilled = appt.billingStatus === 'BILLED';

                      return (
                        <div
                          key={appt.id}
                          onClick={() => setSelectedAppointmentForDetails(appt)}
                          className={`p-2 rounded-xl border border-[#F1DEE3] text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xs ${cfg.bg} border-l-[3.5px]`}
                          style={{
                            borderLeftColor:
                              appt.status === 'CONFIRMED'
                                ? '#9D2558'
                                : appt.status === 'COMPLETED'
                                ? '#059669'
                                : appt.status === 'CHECKED_IN'
                                ? '#851C47'
                                : appt.status === 'IN_SERVICE'
                                ? '#9333ea'
                                : appt.status === 'CANCELLED'
                                ? '#e11d48'
                                : '#d97706',
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-semibold">
                            <span className="font-mono text-slate-500 truncate text-[9px]">
                              {appt.startTime || appt.appointmentNumber || appt.id.slice(-6)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.text} ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                          </div>

                          <div className="text-[11px] font-bold text-[#23151D] truncate mt-1">
                            {appt.clientName || 'Walk-in Client'}
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-slate-500">
                            <span className="truncate">
                              {appt.items?.length
                                ? appt.items.map((i) => i.name).join(', ')
                                : appt.serviceName || 'Service'}
                            </span>
                            {isBilled && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[9px] h-3.5 px-1 py-0 font-bold"
                              >
                                Billed
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Overflow "+N more" badge button */}
                    {hasOverflow && (
                      <button
                        type="button"
                        onClick={() => setSelectedDayForDialog(cell.dateString)}
                        className="w-full text-center py-1 text-[11px] font-semibold text-[#9D2558] hover:text-[#851C47] hover:bg-[#FCE8EC]/50 rounded-lg transition-colors"
                      >
                        +{overflowCount} more...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  ) : (
        /* List View */
        <div className="rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#18191B]">
              Appointments List ({appointments.length} Total)
            </h3>
            <span className="text-xs text-[#78616C] font-medium">
              Showing filtered results for {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-[#18191B]">No appointments found matching your criteria</p>
              <p className="text-xs text-[#78616C] mt-1">Try adjusting your filters or date range.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenBooking()}
                className="mt-4 text-xs font-semibold gap-1.5 rounded-xl border border-white/80 bg-white/80 hover:bg-white text-[#B82E69]"
              >
                <Plus className="w-3.5 h-3.5" />
                Book New Appointment
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="report-records w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/60 bg-[#FAF8F9]/80 backdrop-blur-md text-[#78616C] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4">Services & Staff</th>
                    <th className="py-3.5 px-4 text-right">Est. Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Billing</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/50">
                  {appointments.map((appt) => {
                    const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                    const isBilled = appt.billingStatus === 'BILLED';

                    return (
                      <tr
                        key={appt.id}
                        className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                        onClick={() => setSelectedAppointmentForDetails(appt)}
                      >
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{appt.date}</div>
                        </td>

                        {/* Client */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {appt.clientName || 'Walk-in Client'}
                          </div>
                          {appt.clientPhone && (
                            <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {formatPhoneNumber(appt.clientPhone)}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Ref: {appt.appointmentNumber || appt.id}
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-700">
                            {appt.branchName || appt.branchId}
                          </span>
                        </td>

                        {/* Services & Staff */}
                        <td className="py-3 px-4 max-w-xs">
                          {appt.items && appt.items.length > 0 ? (
                            <div className="space-y-1">
                              {appt.items.map((item, idx) => (
                                <div key={item.lineInstanceId || idx} className="text-slate-700">
                                  <span className="font-medium">{item.name}</span>
                                  {item.staffName && (
                                    <span className="text-slate-500 ml-1">
                                      ({item.staffName})
                                    </span>
                                  )}
                                  {item.type === 'PACKAGE' && (
                                    <div className="pl-2 text-[10px] text-slate-500">
                                      {item.assignedStaff && item.assignedStaff.length > 1 && (
                                        <div className="text-[#9D2558] font-medium">
                                          Shared ({item.assignedStaff.length} stylists): {item.assignedStaff.map((s) => s.staffName).join(', ')}
                                        </div>
                                      )}
                                      {item.packageComponents && item.packageComponents.map((c, cIdx) => (
                                        <div key={c.componentInstanceId || cIdx}>
                                          • {c.serviceName}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-700">
                              {appt.serviceName || 'Standard Service'}
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(appt.price || 0)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Billing */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isBilled ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                              Billed
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-600 border-slate-300 font-semibold text-xs"
                            >
                              Unbilled
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAppointmentForDetails(appt)}
                              className="h-7 px-2 text-slate-600 hover:text-[#9D2558] text-xs gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Button>

                            {!isBilled &&
                              ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED'].includes(
                                appt.status
                              ) && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => navigate(`/pos?appointmentId=${appt.id}`)}
                                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                >
                                  <Receipt className="w-3 h-3" />
                                  POS
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Day Overview Popover / Dialog (when clicking "+N more") */}
      <Dialog
        open={Boolean(selectedDayForDialog)}
        onOpenChange={(open) => !open && setSelectedDayForDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Appointments for {selectedDayForDialog}</span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const day = selectedDayForDialog;
                  setSelectedDayForDialog(null);
                  if (day) handleOpenBooking(day);
                }}
                className="bg-[#9D2558] hover:bg-[#851C47] text-white text-xs gap-1 h-7"
              >
                <Plus className="w-3.5 h-3.5" />
                Add for this date
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {selectedDayAppointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No appointments on this date.</p>
            ) : (
              selectedDayAppointments.map((appt) => {
                const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                return (
                  <div
                    key={appt.id}
                    onClick={() => {
                      setSelectedDayForDialog(null);
                      setSelectedAppointmentForDetails(appt);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-xs transition-all ${cfg.bg} ${cfg.border} border-l-4`}
                    style={{
                      borderLeftColor:
                        appt.status === 'CONFIRMED'
                          ? '#2563eb'
                          : appt.status === 'COMPLETED'
                          ? '#059669'
                          : appt.status === 'CHECKED_IN'
                          ? '#9333ea'
                          : appt.status === 'IN_SERVICE'
                          ? '#4f46e5'
                          : appt.status === 'CANCELLED'
                          ? '#e11d48'
                          : '#d97706',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-slate-500 text-[11px]">
                        Ref: {appt.appointmentNumber || appt.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="font-bold text-slate-800 text-sm mt-1">
                      {appt.clientName || 'Walk-in Client'}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      {appt.items?.map((i) => i.name).join(', ') || appt.serviceName}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/50">
                      <span>Ref: {appt.appointmentNumber || appt.id}</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(appt.price || 0)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDayForDialog(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Form Modal */}
      <BookingFormModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setAppointmentToEdit(null);
        }}
        onSuccess={(savedAppt, shouldPrepareMessage) => {
          setIsBookingModalOpen(false);
          setAppointmentToEdit(null);
          fetchAppointments();
          if (shouldPrepareMessage) {
            setConfirmationMessageApptId(savedAppt.id);
          }
        }}
        initialDate={bookingInitialDate}
        activeBranchId={defaultBookingBranchId}
        branches={branches}
        appointmentToEdit={appointmentToEdit}
      />

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        isOpen={Boolean(selectedAppointmentForDetails)}
        onClose={() => setSelectedAppointmentForDetails(null)}
        appointment={selectedAppointmentForDetails}
        onEdit={(appt) => handleEditAppointment(appt)}
        onReschedule={(appt) => handleOpenReschedule(appt)}
        onShowConfirmationMessage={(apptId) => setConfirmationMessageApptId(apptId)}
        onStatusChange={(updated) => {
          setSelectedAppointmentForDetails(updated);
          fetchAppointments();
        }}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={Boolean(appointmentToReschedule)}
        onClose={() => setAppointmentToReschedule(null)}
        appointment={appointmentToReschedule}
        onSuccess={(updated) => {
          setAppointmentToReschedule(null);
          fetchAppointments();
          // Prompt updated confirmation message
          setConfirmationMessageApptId(updated.id);
        }}
      />

      {/* Confirmation Message Modal */}
      <ConfirmationMessageModal
        isOpen={Boolean(confirmationMessageApptId)}
        onClose={() => setConfirmationMessageApptId(null)}
        appointmentId={confirmationMessageApptId}
      />
    </div>
  );
};
