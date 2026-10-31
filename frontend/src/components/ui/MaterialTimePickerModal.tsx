import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Keyboard, Clock as ClockIcon } from 'lucide-react';

interface MaterialTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  onSelect: (formattedTime: string) => void;
}

export const MaterialTimePickerModal: React.FC<MaterialTimePickerModalProps> = ({
  isOpen,
  onClose,
  value,
  onSelect,
}) => {
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false);
  const [selectedHour, setSelectedHour] = useState<number>(10);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Parse incoming value when opened
  useEffect(() => {
    if (!isOpen) return;
    setMode('hours');
    setIsKeyboardMode(false);
    if (!value) {
      setSelectedHour(10);
      setSelectedMinute(0);
      setPeriod('AM');
      return;
    }
    const clean = value.trim().toUpperCase();
    const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2] || '0', 10);
      const isPM = match[3] === 'PM' || (h >= 12 && !match[3]);
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      setSelectedHour(h || 10);
      setSelectedMinute(isNaN(m) ? 0 : m);
      setPeriod(isPM ? 'PM' : 'AM');
    }
  }, [isOpen, value]);

  const dialRef = useRef<HTMLDivElement>(null);

  // Calculate tip position on 256x256 circle (center 128, 128, radius 92)
  const dialRadius = 92;
  const dialCenter = 128;

  const currentAngleDeg = useMemo(() => {
    if (mode === 'hours') {
      return (selectedHour % 12) * 30;
    } else {
      return selectedMinute * 6;
    }
  }, [mode, selectedHour, selectedMinute]);

  const tipPos = useMemo(() => {
    const angleRad = (currentAngleDeg - 90) * (Math.PI / 180);
    return {
      x: dialCenter + dialRadius * Math.cos(angleRad),
      y: dialCenter + dialRadius * Math.sin(angleRad),
    };
  }, [currentAngleDeg]);

  const handleDialPointer = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);

    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angleDeg < 0) angleDeg += 360;

    if (mode === 'hours') {
      let h = Math.round(angleDeg / 30);
      if (h === 0) h = 12;
      setSelectedHour(h);
      // Auto switch to minutes after short delay
      setTimeout(() => setMode('minutes'), 250);
    } else {
      const m = Math.round(angleDeg / 6) % 60;
      setSelectedMinute(m);
    }
  };

  const handleConfirm = () => {
    const hh = String(selectedHour).padStart(2, '0');
    const mm = String(selectedMinute).padStart(2, '0');
    const formatted = `${hh}:${mm} ${period}`;
    onSelect(formatted);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[320px] p-5 bg-white rounded-2xl shadow-2xl border border-slate-100 font-sans sm:rounded-2xl">
        {/* Top Header Label */}
        <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase select-none mb-3">
          Select Time
        </div>

        {/* Digital Time & AM/PM Display Boxes */}
        <div className="flex items-center justify-center gap-1 select-none">
          {/* Hour Box */}
          <button
            type="button"
            onClick={() => setMode('hours')}
            className={`w-20 h-16 rounded-xl flex items-center justify-center text-3xl font-bold font-mono transition-all cursor-pointer ${
              mode === 'hours'
                ? 'bg-[#FCE8EC] text-[#9D2558] ring-2 ring-[#9D2558]/30'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
            }`}
          >
            {isKeyboardMode ? (
              <input
                type="number"
                min={1}
                max={12}
                value={selectedHour}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 12) setSelectedHour(val);
                }}
                className="w-full text-center bg-transparent focus:outline-none"
              />
            ) : (
              String(selectedHour).padStart(2, '0')
            )}
          </button>

          {/* Colon */}
          <span className="text-3xl font-bold text-slate-800 px-0.5">:</span>

          {/* Minute Box */}
          <button
            type="button"
            onClick={() => setMode('minutes')}
            className={`w-20 h-16 rounded-xl flex items-center justify-center text-3xl font-bold font-mono transition-all cursor-pointer ${
              mode === 'minutes'
                ? 'bg-[#FCE8EC] text-[#9D2558] ring-2 ring-[#9D2558]/30'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
            }`}
          >
            {isKeyboardMode ? (
              <input
                type="number"
                min={0}
                max={59}
                value={selectedMinute}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0 && val <= 59) setSelectedMinute(val);
                }}
                className="w-full text-center bg-transparent focus:outline-none"
              />
            ) : (
              String(selectedMinute).padStart(2, '0')
            )}
          </button>

          {/* AM / PM Toggle Box */}
          <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200 ml-2">
            <button
              type="button"
              onClick={() => setPeriod('AM')}
              className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                period === 'AM'
                  ? 'bg-[#9D2558] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setPeriod('PM')}
              className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                period === 'PM'
                  ? 'bg-[#9D2558] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Circular Clock Dial */}
        {!isKeyboardMode ? (
          <div className="my-5 flex items-center justify-center">
            <div
              ref={dialRef}
              onClick={handleDialPointer}
              className="w-64 h-64 rounded-full bg-slate-100 relative select-none cursor-pointer flex items-center justify-center shadow-inner"
            >
              {/* Center Dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-[#9D2558] absolute z-20" />

              {/* Hand Line (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <line
                  x1={dialCenter}
                  y1={dialCenter}
                  x2={tipPos.x}
                  y2={tipPos.y}
                  stroke="#9D2558"
                  strokeWidth="2.5"
                />
              </svg>

              {/* Hand Tip Circle */}
              <div
                style={{
                  left: `${tipPos.x}px`,
                  top: `${tipPos.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="w-9 h-9 rounded-full bg-[#9D2558] text-white flex items-center justify-center font-bold text-xs absolute z-20 shadow-md"
              >
                {mode === 'hours' ? selectedHour : String(selectedMinute).padStart(2, '0')}
              </div>

              {/* Numbers on Dial */}
              {mode === 'hours'
                ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
                    const angleRad = (h * 30 - 90) * (Math.PI / 180);
                    const nx = dialCenter + dialRadius * Math.cos(angleRad);
                    const ny = dialCenter + dialRadius * Math.sin(angleRad);
                    const isSelected = selectedHour === h;

                    return (
                      <span
                        key={h}
                        style={{
                          left: `${nx}px`,
                          top: `${ny}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute text-xs font-semibold select-none ${
                          isSelected ? 'text-white font-bold z-30' : 'text-slate-700'
                        }`}
                      >
                        {h}
                      </span>
                    );
                  })
                : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                    const angleRad = (m * 6 - 90) * (Math.PI / 180);
                    const nx = dialCenter + dialRadius * Math.cos(angleRad);
                    const ny = dialCenter + dialRadius * Math.sin(angleRad);
                    const isSelected = selectedMinute === m;

                    return (
                      <span
                        key={m}
                        style={{
                          left: `${nx}px`,
                          top: `${ny}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute text-xs font-semibold select-none ${
                          isSelected ? 'text-white font-bold z-30' : 'text-slate-700'
                        }`}
                      >
                        {String(m).padStart(2, '0')}
                      </span>
                    );
                  })}
            </div>
          </div>
        ) : (
          <div className="my-10 text-center text-xs text-slate-500 py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Click top numbers to edit time manually
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsKeyboardMode((v) => !v)}
            className="p-1.5 text-slate-500 hover:text-[#9D2558] hover:bg-[#FDF2F5] rounded-lg transition-colors cursor-pointer"
            title={isKeyboardMode ? 'Clock Dial Mode' : 'Keyboard Input Mode'}
          >
            {isKeyboardMode ? <ClockIcon className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-[#9D2558] hover:bg-[#FDF2F5] rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs font-bold bg-[#9D2558] hover:bg-[#851C47] text-white rounded-xl shadow-xs transition-colors cursor-pointer uppercase tracking-wider"
            >
              OK
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
