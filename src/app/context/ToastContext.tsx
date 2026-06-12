import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue>({
  toast: { success: () => {}, error: () => {}, warning: () => {}, info: () => {} },
});

const config: Record<ToastType, { icon: typeof CheckCircle2; iconBg: string; iconColor: string; label: string; bar: string }> = {
  success: { icon: CheckCircle2,  iconBg: 'bg-[#DCFCE7]', iconColor: 'text-[#16A34A]', label: 'Success', bar: 'bg-[#16A34A]' },
  error:   { icon: XCircle,       iconBg: 'bg-[#FEE2E2]', iconColor: 'text-[#DC2626]', label: 'Error',   bar: 'bg-[#DC2626]' },
  warning: { icon: AlertTriangle, iconBg: 'bg-[#FEF3C7]', iconColor: 'text-[#D97706]', label: 'Warning', bar: 'bg-[#D97706]' },
  info:    { icon: Info,          iconBg: 'bg-[#DBEAFE]', iconColor: 'text-[#2563EB]', label: 'Info',    bar: 'bg-[#2563EB]' },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { icon: Icon, iconBg, iconColor, label, bar } = config[item.type];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 bg-white rounded-2xl shadow-xl border border-[#E8E8F0] min-w-[300px] max-w-[400px] overflow-hidden relative ${item.leaving ? 'toast-out' : 'toast-in'}`}
    >
      {/* top color bar */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${bar} rounded-t-2xl`} />
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 mt-0.5">
        <div className="text-[13px] font-semibold text-[#030213]">{label}</div>
        <div className="text-[12px] text-[#717182] mt-0.5 leading-snug">{item.message}</div>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#F3F3F5] hover:bg-[#E8E8EC] flex items-center justify-center transition-colors mt-0.5"
      >
        <X className="w-3.5 h-3.5 text-[#717182]" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error',   msg),
    warning: (msg: string) => addToast('warning', msg),
    info:    (msg: string) => addToast('info',    msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard item={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
