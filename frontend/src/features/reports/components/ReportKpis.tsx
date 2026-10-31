import React from 'react';

export interface ReportKpi {
  label: string;
  value: string;
  subtext?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}

const tones = {
  neutral: 'text-[#18191B]',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  accent: 'text-[#B82E69]',
};

export function ReportKpis({ items }: { items: ReportKpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {items.map(({ label, value, subtext, tone = 'neutral' }) => (
        <div
          key={label}
          className="p-5 rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            <span className="bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <span className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight block ${tones[tone]}`}>
              {value}
            </span>
            {subtext && <span className="text-xs text-[#78616C] font-medium mt-1 block">{subtext}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
