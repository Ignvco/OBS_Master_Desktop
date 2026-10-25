import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/60 shadow-[inset_3px_0_0_#22c55e]',
    warning: 'border-amber-500/60 shadow-[inset_3px_0_0_#f59e0b]',
    error: 'border-red-500/70 shadow-[inset_3px_0_0_#ef4444]',
    info: 'border-sky-500/60 shadow-[inset_3px_0_0_#38bdf8]',
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-md bg-[#11141a] border ${borders[toast.type]} shadow-[0_14px_34px_rgba(0,0,0,0.85)] transition-all duration-150 animate-in fade-in slide-in-from-bottom-2`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-white font-mono">{toast.title}</h4>
        {toast.message && (
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="text-slate-400 hover:text-white p-1 rounded bg-[#07090c] border border-[#262c38] hover:border-slate-500 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
