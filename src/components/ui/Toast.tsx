import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ToastItem {
  id: number;
  message: string;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  push: (message: string, opts?: { icon?: IconName; action?: ToastItem['action']; duration?: number }) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback<ToastApi['push']>(
    (message, opts) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, message, icon: opts?.icon, action: opts?.action }]);
      window.setTimeout(() => remove(id), opts?.duration ?? 6000);
    },
    [remove],
  );
  const api = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="sp-toasts" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className="sp-toast">
            <Icon name={t.icon ?? 'check'} size={16} />
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="sp-toast__action"
                onClick={() => {
                  t.action!.onClick();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="sp-toast__close" aria-label="Dismiss" onClick={() => remove(t.id)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
