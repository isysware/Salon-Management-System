import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Building2, Package } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui';

interface InventoryNavHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  activePath?: string;
  selectedBranchId: string;
  onBranchChange?: (branchId: string) => void;
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

export const InventoryNavHeader: React.FC<InventoryNavHeaderProps> = ({
  title,
  subtitle,
  icon,
  selectedBranchId,
  onBranchChange,
  primaryAction,
  secondaryAction,
}) => {
  const { user, allBranches } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] mb-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FDF2F5] to-white border border-white/80 shadow-2xs flex items-center justify-center text-[#B82E69] shrink-0">
            {icon || <Package className="w-5 h-5 text-[#B82E69]" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight truncate">
              {title}
            </h1>
            <p className="text-xs text-[#78616C] font-medium mt-0.5 line-clamp-1 xl:line-clamp-none">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
        {/* Branch Picker for Super Admin */}
        {isSuperAdmin && onBranchChange && allBranches.length > 0 && (
          <div className="shrink-0">
            <Select
              value={selectedBranchId || allBranches[0]?.id || ''}
              onValueChange={(val) => onBranchChange(val)}
            >
              <SelectTrigger className="h-9 px-3 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-[#B82E69] shrink-0" />
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {allBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="h-9 px-3.5 text-xs font-semibold rounded-xl border border-white/80 bg-white/70 hover:bg-white text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          >
            {secondaryAction.icon || <Plus className="w-3.5 h-3.5" />}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="h-9 px-4 font-semibold gap-1.5 shadow-xs text-xs sm:text-sm bg-[#B82E69] hover:bg-[#A02358] text-white rounded-xl transition-all flex items-center cursor-pointer shrink-0 whitespace-nowrap"
          >
            {primaryAction.icon || <Plus className="w-4 h-4" />}
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};
