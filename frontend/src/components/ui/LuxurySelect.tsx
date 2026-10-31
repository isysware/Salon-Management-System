import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { cn } from '@/lib/utils';

export interface LuxurySelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface LuxurySelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: LuxurySelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}

const EMPTY_SENTINEL = '__RADIX_EMPTY__';

export const LuxurySelect: React.FC<LuxurySelectProps> = ({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  className,
  triggerClassName,
  contentClassName,
  disabled = false,
}) => {
  // Map empty string to sentinel and vice versa so Radix doesn't throw on empty value
  const safeValue = value === '' ? EMPTY_SENTINEL : value;

  const handleValueChange = (val: string) => {
    onValueChange(val === EMPTY_SENTINEL ? '' : val);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs font-bold text-slate-700 tracking-tight">
          {label}
        </span>
      )}
      <Select
        value={safeValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            'h-10 rounded-2xl border border-white/90 bg-white/80 backdrop-blur-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#18191B] shadow-2xs hover:bg-white focus:ring-4 focus:ring-[#B82E69]/10 cursor-pointer',
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          className={cn(
            'rounded-2xl border border-rose-100/90 bg-white/95 backdrop-blur-2xl shadow-[0_12px_36px_rgba(35,21,29,0.08)] p-1.5',
            contentClassName
          )}
        >
          {options.map((opt) => {
            const itemValue = opt.value === '' ? EMPTY_SENTINEL : opt.value;
            return (
              <SelectItem
                key={itemValue}
                value={itemValue}
                className="rounded-xl py-2 pl-8 pr-3 text-xs sm:text-sm font-medium transition-colors hover:bg-[#FDF2F5] hover:text-[#9D2558] focus:bg-[#FDF2F5] focus:text-[#9D2558] data-[state=checked]:bg-[#FDF2F5] data-[state=checked]:text-[#9D2558] data-[state=checked]:font-bold cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span>{opt.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LuxurySelect;
