import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global trigger so toast can be called anywhere
type ToastListener = (type: ToastType, message: string, title?: string, duration?: number) => void;
let globalToastListener: ToastListener | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('success', message, title, duration);
  },
  error: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('error', message, title, duration);
  },
  info: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('info', message, title, duration);
  },
  warning: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('warning', message, title, duration);
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Connect global listener
  globalToastListener = showToast;

  const success = useCallback((msg: string, title?: string) => showToast('success', msg, title), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast('error', msg, title), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast('info', msg, title), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast('warning', msg, title), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ── Toast Container & Visual Card Component ─────────────────────────────────

const ToastContainer: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed top-5 right-5 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0 z-[99999999]"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>,
    document.body
  );
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const config = {
    success: {
      accentBar: 'bg-[#9D2558]',
      iconBg: 'bg-gradient-to-br from-[#9D2558] to-[#B82F69] text-white shadow-sm shadow-[#9D2558]/30',
      icon: <Check className="w-4 h-4 stroke-[3]" />,
      defaultTitle: 'Success',
      titleColor: 'text-slate-900',
    },
    error: {
      accentBar: 'bg-rose-500',
      iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-500/30',
      icon: <AlertCircle className="w-4 h-4 stroke-[2.5]" />,
      defaultTitle: 'Action Required',
      titleColor: 'text-slate-900',
    },
    warning: {
      accentBar: 'bg-amber-500',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/30',
      icon: <AlertTriangle className="w-4 h-4 stroke-[2.5]" />,
      defaultTitle: 'Warning',
      titleColor: 'text-slate-900',
    },
    info: {
      accentBar: 'bg-[#9D2558]',
      iconBg: 'bg-gradient-to-br from-[#9D2558] to-[#B82F69] text-white shadow-sm shadow-[#9D2558]/30',
      icon: <Info className="w-4 h-4 stroke-[2.5]" />,
      defaultTitle: 'Notice',
      titleColor: 'text-slate-900',
    },
  }[item.type];

  return (
    <div
      role="alert"
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white border border-slate-100/90 shadow-[0_12px_36px_-6px_rgba(35,21,29,0.14),0_4px_14px_rgba(0,0,0,0.05)] transition-all duration-200 transform translate-y-0 opacity-100"
      style={{
        animation: 'toast-slide-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Sleek Vertical Accent Pill Bar on Left (matching reference design) */}
      <div className={`absolute left-0 top-3 bottom-3 w-1.25 rounded-r-full ${config.accentBar}`} />

      <div className="py-3 px-3.5 pl-4 flex items-center gap-3">
        {/* Solid Filled Vibrant Circular Icon Badge */}
        <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${config.iconBg}`}>
          {config.icon}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <h5 className={`text-xs font-bold leading-tight ${config.titleColor}`}>
            {item.title || config.defaultTitle}
          </h5>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug break-words font-normal">
            {item.message}
          </p>
        </div>

        {/* Minimal Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close notification"
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer self-start -mt-0.5 -mr-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <style>{`
        @keyframes toast-slide-in {
          0% {
            opacity: 0;
            transform: translateY(-14px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
