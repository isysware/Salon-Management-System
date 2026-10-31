import * as React from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'subtle' | 'ghost' | 'gradient';
}

const CardMoreAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="More options"
    className={cn(
      'w-7 h-7 sm:w-8 sm:h-8 rounded-full border-0 bg-white/80 backdrop-blur-md hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer shrink-0',
      className
    )}
    {...props}
  >
    <MoreHorizontal className="w-4 h-4" />
  </button>
));
CardMoreAction.displayName = 'CardMoreAction';

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, variant = 'glass', ...props }, ref) => {
    const paddingStyles = {
      none: 'p-0',
      sm: 'p-3.5 sm:p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    };

    const variantStyles = {
      default:
        'border border-white/80 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:shadow-[0_16px_45px_rgba(184,46,105,0.07)] hover:border-white transition-all duration-300',
      glass:
        'border border-white/90 bg-white/70 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:shadow-[0_18px_45px_rgba(184,46,105,0.08)] hover:border-white transition-all duration-300',
      subtle:
        'border border-white/60 bg-[#FAF8F9]/80 backdrop-blur-xl shadow-2xs',
      ghost:
        'border-transparent bg-transparent shadow-none',
      gradient:
        'border border-white/30 bg-gradient-to-br from-rose-500/90 via-pink-600/90 to-purple-700/90 text-white shadow-lg backdrop-blur-xl',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[24px] text-[#18191B] font-sans transition-all duration-300 relative',
          variantStyles[variant],
          padding ? paddingStyles[padding] : '',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
    showMore?: boolean;
    onMore?: () => void;
  }
>(({ className, title, subtitle, action, showMore, onMore, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)}
    {...props}
  >
    {title || subtitle || action || showMore ? (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="font-semibold text-base leading-snug tracking-tight text-[#18191B]">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {action}
          {showMore && <CardMoreAction onClick={onMore} />}
        </div>
      </div>
    ) : null}
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-semibold leading-tight tracking-tight text-[#18191B]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-slate-500', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 sm:p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-5 sm:p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardMoreAction };
