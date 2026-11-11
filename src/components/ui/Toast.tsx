import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface ToastItem {
  id: number;
  message: string;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
}

export interface ToastOptions {
  icon?: IconName;
  action?: ToastItem['action'];
  duration?: number;
  /**
   * The message names a record (a tenant, a prospect, a deal). A named toast is refused while the
   * toasts are withheld (prospect-safe mode), whoever asks for it.
   */
  named?: boolean;
}

interface ToastApi {
  push: (message: string, opts?: ToastOptions) => void;
  /** Remove every toast now. */
  clear: () => void;
  /**
   * The prospect-safe boundary. Turning it on removes every toast on screen at once (one of them may
   * name a tenant or a prospect) and refuses named toasts until it is turned off again.
   */
  withhold: (on: boolean) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {}, clear: () => {}, withhold: () => {} });

/** At most three toasts; a named one is refused while withheld. Pure, so the rule is testable without a DOM. */
export function nextToasts(items: ToastItem[], item: ToastItem, opts: { named?: boolean; withheld: boolean }): ToastItem[] {
  if (opts.named && opts.withheld) return items;
  return [...items.slice(-2), item];
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const withheld = useRef(false);
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems((xs) => (xs.length ? [] : xs)), []);
  const push = useCallback<ToastApi['push']>(
    (message, opts) => {
      const id = ++seq.current;
      setItems((xs) => nextToasts(xs, { id, message, icon: opts?.icon, action: opts?.action }, { named: opts?.named, withheld: withheld.current }));
      setTimeout(() => remove(id), opts?.duration ?? 6000);
    },
    [remove],
  );
  const withhold = useCallback(
    (on: boolean) => {
      withheld.current = on;
      if (on) clear();
    },
    [clear],
  );
  const api = useMemo(() => ({ push, clear, withhold }), [push, clear, withhold]);
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

/**
 * Ties the toasts to prospect-safe mode. A layout effect runs after React has applied the change and
 * before the browser paints, so the frame that first shows the mode on already has no toast in it,
 * however the mode was turned on (the switch, the back button, a link).
 */
export function useToastBoundary(safe: boolean): void {
  const { withhold } = useToast();
  useLayoutEffect(() => {
    withhold(safe);
  }, [safe, withhold]);
}
