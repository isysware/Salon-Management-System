import React from 'react';
import { Appointment } from '@/types/salon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface CartOverwritePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingAppointment: Appointment | null;
  currentCartCount: number;
  onConfirmReplace: () => void;
}

export const CartOverwritePromptModal: React.FC<CartOverwritePromptModalProps> = ({
  isOpen,
  onClose,
  pendingAppointment,
  currentCartCount,
  onConfirmReplace,
}) => {
  if (!pendingAppointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[26px] border border-white/90 bg-white/95 backdrop-blur-2xl shadow-[0_16px_50px_rgba(35,21,29,0.12)] p-5 sm:p-6">
        <DialogHeader>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center mb-1.5 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <DialogTitle className="text-base font-extrabold text-[#18191B]">
            Existing Cart Detected
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            You currently have <span className="font-bold text-[#18191B]">{currentCartCount} item(s)</span> in your active POS checkout cart.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-white/80 border border-rose-100/80 rounded-2xl text-xs space-y-1.5 my-2 shadow-[0_4px_16px_rgba(35,21,29,0.03)]">
          <div className="font-bold text-[#18191B] text-[11px] uppercase tracking-wider text-rose-900/70">
            Incoming Appointment to Load:
          </div>
          <div className="text-slate-600 flex items-center justify-between">
            <span className="font-bold text-[#18191B] text-sm">{pendingAppointment.clientName}</span>
            <span className="font-mono text-[10px] text-slate-400 bg-rose-50/60 border border-rose-100/60 px-2 py-0.5 rounded-full">
              Ref: {pendingAppointment.appointmentNumber || pendingAppointment.id}
            </span>
          </div>
          <div className="text-slate-500 text-[11px]">
            Scheduled for <span className="font-semibold text-slate-700">{pendingAppointment.date}</span> at <span className="font-semibold text-slate-700">{pendingAppointment.startTime || pendingAppointment.time || '10:00 AM'}</span>
          </div>
          <div className="font-bold text-[#18191B] pt-2 border-t border-rose-100/60 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Estimated Booking Quote:</span>
            <span className="font-mono tabular-nums text-sm font-extrabold text-[#B82E69]">
              {formatCurrency(pendingAppointment.price || 0)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Would you like to replace your existing cart with the booked services for this client, or keep your current cart intact?
        </p>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 px-3 text-[#18191B] rounded-xl border border-rose-100/80 bg-white/80 hover:bg-rose-50/50"
          >
            Keep Existing Cart
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirmReplace();
              onClose();
            }}
            className="bg-gradient-to-r from-[#B82E69] to-[#9D2558] hover:from-[#9D2558] hover:to-[#831F49] text-white text-xs font-bold gap-1.5 h-8 px-3.5 rounded-xl shadow-[0_4px_14px_rgba(184,46,105,0.22)] active:scale-[0.98] cursor-pointer"
          >
            Replace Cart Items
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
