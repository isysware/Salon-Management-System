import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-sans transition-colors focus:outline-none focus:ring-2 focus:ring-[#9D2558] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border border-[#F8D2DC] bg-[#FCE8EC] text-[#9D2558]',
        primary: 'border border-[#F8D2DC] bg-[#FCE8EC] text-[#9D2558]',
        secondary: 'border border-[#F1DEE3] bg-[#FDF2F5] text-[#23151D]',
        neutral: 'border border-[#F1DEE3] bg-white text-slate-700',
        destructive: 'border border-rose-200 bg-rose-50 text-rose-700',
        danger: 'border border-rose-200 bg-rose-50 text-rose-700',
        outline: 'border border-[#F1DEE3] text-[#23151D]',
        success: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border border-amber-200 bg-amber-50 text-amber-700',
        info: 'border border-[#F8D2DC] bg-[#FCE8EC] text-[#9D2558]',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  const dotColors: Record<string, string> = {
    default: 'bg-[#9D2558]',
    primary: 'bg-[#9D2558]',
    secondary: 'bg-slate-500',
    neutral: 'bg-slate-500',
    destructive: 'bg-rose-500',
    danger: 'bg-rose-500',
    outline: 'bg-slate-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    info: 'bg-sky-500',
  };

  const activeDotColor = dotColors[variant || 'default'] || 'bg-slate-500';

  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', activeDotColor)} />}
      <span>{children}</span>
    </div>
  );
}

export { Badge, badgeVariants };
