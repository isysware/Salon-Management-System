import React from 'react';
import { Card, CardMoreAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface StatCardBreakdown {
  label: string;
  value: string | number;
  percentage?: number;
  color?: 'emerald' | 'sky' | 'rose' | 'primary' | 'amber';
}

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'purple';
  action?: React.ReactNode;
  showMore?: boolean;
  onMore?: () => void;
  breakdowns?: StatCardBreakdown[];
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trendText,
  trendDirection = 'neutral',
  tone = 'default',
  action,
  showMore = true,
  onMore,
  breakdowns,
  className,
}) => {
  const iconBgStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/60',
    primary: 'bg-[#FCE8EC] text-[#9D2558] border-[#F8D2DC]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/70',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
  };

  const trendIcon =
    trendDirection === 'up' ? (
      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
    ) : trendDirection === 'down' ? (
      <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
    ) : (
      <Minus className="w-3 h-3 text-slate-400" />
    );

  const trendColorClass =
    trendDirection === 'up'
      ? 'text-emerald-600 bg-emerald-50/80 border-emerald-200/60'
      : trendDirection === 'down'
      ? 'text-rose-600 bg-rose-50/80 border-rose-200/60'
      : 'text-slate-600 bg-slate-50 border-slate-200/60';

  const progressColorMap: Record<string, string> = {
    emerald: 'progress-striped-emerald',
    sky: 'progress-striped-sky',
    rose: 'progress-striped-rose',
    primary: 'progress-striped-primary',
    amber: 'bg-amber-500',
  };

  return (
    <Card
      padding="none"
      className={cn(
        'p-5 sm:p-6 flex flex-col justify-between h-full font-sans overflow-hidden group',
        className
      )}
    >
      {/* Header: Title on Left, Icon/More Action on Right */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-slate-600 tracking-tight">
            {title}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {icon && (
            <div
              className={cn(
                'w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-2xs',
                iconBgStyles[tone]
              )}
            >
              {icon}
            </div>
          )}
          {action}
          {showMore && <CardMoreAction onClick={onMore} />}
        </div>
      </div>

      {/* Main Metric Value + Trend Pill */}
      <div className="mt-3 sm:mt-4 flex flex-wrap items-baseline gap-2.5">
        <div className="text-3xl sm:text-4xl font-bold tracking-tight text-[#18191B] tabular-nums leading-none">
          {value}
        </div>

        {trendText && (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs shrink-0',
              trendColorClass
            )}
          >
            {trendIcon}
            <span>{trendText}</span>
          </div>
        )}
      </div>

      {/* Optional Subtitle or Footer */}
      {subtitle && !breakdowns && (
        <div className="mt-2 text-xs text-slate-500 font-medium">
          {subtitle}
        </div>
      )}

      {/* Optional Breakdowns (Gross Volume Progress Bar Style from reference) */}
      {breakdowns && breakdowns.length > 0 && (
        <div className="mt-5 space-y-3 pt-4 border-t border-slate-100">
          {breakdowns.map((item, idx) => {
            const pct = Math.min(Math.max(item.percentage ?? 0, 0), 100);
            const barClass = progressColorMap[item.color || 'emerald'] || 'progress-striped-emerald';

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{item.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
