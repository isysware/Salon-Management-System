import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Search,
  User,
  Phone,
  Scissors,
  CheckCircle2,
  RefreshCw,
  Receipt,
  PlayCircle,
  FileCheck,
  AlertCircle,
} from 'lucide-react';

interface AppointmentQueueSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  loadedAppointmentId?: string;
  onSelectAppointment: (appointment: Appointment) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-[#FDF2F5]',
    text: 'text-[#23151D]',
    border: 'border-[#F1DEE3]',
  },
  CHECKED_IN: {
    label: 'Checked In',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  IN_SERVICE: {
    label: 'In Service',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
  },
  COMPLETED: {
    label: 'Completed (Unbilled)',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'bg-[#FDF2F5]',
    text: 'text-[#23151D]',
    border: 'border-[#F1DEE3]',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
  },
};

export const AppointmentQueueSheet: React.FC<AppointmentQueueSheetProps> = ({
  isOpen,
  onOpenChange,
  branchId,
  loadedAppointmentId,
  onSelectAppointment,
}) => {
  const { user, demoDate } = useAuth();

  const todayStr = demoDate || new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (demoDate) {
      setSelectedDate(demoDate);
    }
  }, [demoDate]);

  const loadQueue = async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const items = await salonService.getAppointmentQueue(branchId, selectedDate, user || undefined);
      setQueue(items);
    } catch (err) {
      console.error('Failed to load POS appointment queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && branchId) {
      loadQueue();
    }
  }, [isOpen, branchId, selectedDate]);

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((a) => {
      const nameMatch = a.clientName?.toLowerCase().includes(q);
      const phoneMatch = a.clientPhone?.toLowerCase().includes(q);
      const refMatch = a.appointmentNumber?.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
      const serviceMatch = a.items?.some((i) => i.name.toLowerCase().includes(q)) || a.serviceName?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || refMatch || serviceMatch;
    });
  }, [queue, searchQuery]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 sm:p-5 space-y-4 rounded-l-[28px] border-l border-white/90 bg-white/95 backdrop-blur-2xl shadow-[0_16px_50px_rgba(35,21,29,0.12)]">
        <SheetHeader className="pb-3 border-b border-rose-100/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-extrabold text-[#18191B] flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#B82E69] to-[#9D2558] flex items-center justify-center text-white shadow-[0_2px_8px_rgba(184,46,105,0.25)] shrink-0">
                <Calendar className="w-4 h-4 text-white" />
              </span>
              <span>Appointments Queue</span>
            </SheetTitle>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadQueue}
              disabled={isLoading}
              className="h-8 px-2.5 text-slate-600 hover:text-[#9D2558] hover:bg-rose-50/50 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Confirmed, checked-in and completed unbilled bookings ready for counter checkout.
          </p>
        </SheetHeader>

        {/* Date Selector & Search Filters */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Queue Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8.5 text-xs bg-white/80 border-rose-100/90 rounded-xl font-medium focus:border-[#B82E69]"
              />
            </div>
            {selectedDate !== todayStr && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
                className="h-8.5 text-[11px] self-end rounded-xl border-rose-100/80 bg-white/80 hover:bg-rose-50/50 text-[#18191B]"
              >
                Today
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Filter by customer, phone, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 h-8.5 text-xs bg-white/80 border-rose-100/90 rounded-xl placeholder:text-slate-400 focus:border-[#B82E69]"
            />
          </div>
        </div>

        {/* Queue Items List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-0.5">
            <span>Ready for Billing ({filteredQueue.length})</span>
            <span>Date: {selectedDate}</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 rounded-full border-2 border-[#F1DEE3] border-t-[#9D2558] animate-spin mx-auto mb-2" />
              Loading branch appointments queue...
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 stroke-1" />
              <p className="font-semibold text-slate-700">No unbilled appointments in queue</p>
              <p className="text-[11px] text-slate-400">
                All confirmed bookings for {selectedDate} have been billed or no reservations match this filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueue.map((appt) => {
                const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.CONFIRMED;
                const isCurrentlyLoaded = loadedAppointmentId === appt.id;

                return (
                  <div
                    key={appt.id}
                    className={`p-3.5 rounded-[20px] border transition-all text-xs space-y-2.5 ${
                      isCurrentlyLoaded
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300/60 shadow-[0_4px_18px_rgba(184,46,105,0.12)]'
                        : 'bg-white/80 border-white/90 backdrop-blur-md hover:border-rose-200/80 hover:shadow-[0_8px_24px_rgba(184,46,105,0.06)] shadow-[0_4px_16px_rgba(35,21,29,0.03)]'
                    }`}
                  >
                    {/* Top Row: Ref + Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-rose-50/60 border border-rose-100/60 px-2 py-0.5 rounded-full">
                        {appt.appointmentNumber || appt.id.slice(-6)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-[#18191B] text-sm tracking-tight">
                          {appt.clientName || 'Walk-in Client'}
                        </div>
                        {appt.clientPhone && (
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-[#B82E69]" />
                            {formatPhoneNumber(appt.clientPhone)}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Ref: {appt.appointmentNumber || appt.id.slice(-6)}
                      </span>
                    </div>

                    {/* Services & Staff */}
                    <div className="bg-rose-50/40 p-2.5 rounded-xl border border-rose-100/60 space-y-1">
                      {appt.items && appt.items.length > 0 ? (
                        appt.items.map((item, idx) => (
                          <div key={item.lineInstanceId || idx} className="text-[11px]">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            {item.staffName && (
                              <span className="text-slate-500 ml-1">
                                → {item.staffName}
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
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-700">
                          {appt.serviceName || 'Standard Service'}
                        </div>
                      )}
                    </div>

                    {/* Price & Action */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-rose-100/60">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Quoted Price
                        </span>
                        <span className="text-xs font-extrabold font-mono tabular-nums text-[#B82E69]">
                          {formatCurrency(appt.price || 0)}
                        </span>
                      </div>

                      {isCurrentlyLoaded ? (
                        <Badge className="bg-gradient-to-r from-[#B82E69] to-[#9D2558] text-white text-[11px] py-1 px-3 font-bold rounded-full shadow-2xs">
                          Loaded in Cart
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSelectAppointment(appt)}
                          className="h-8 bg-gradient-to-r from-[#B82E69] to-[#9D2558] hover:from-[#9D2558] hover:to-[#831F49] text-white text-xs font-bold gap-1.5 px-3 rounded-xl shadow-[0_4px_14px_rgba(184,46,105,0.22)] active:scale-[0.98] cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Open in POS
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
