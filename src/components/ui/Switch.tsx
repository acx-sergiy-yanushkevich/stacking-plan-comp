import type { ReactNode } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  /** Visually hide the label (it stays as the accessible name). */
  hideLabel?: boolean;
  title?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, hideLabel, title, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      className={`sp-switch ${checked ? 'sp-switch--on' : ''} ${className}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sp-switch__track" aria-hidden="true" />
      <span className={hideLabel ? 'sp-sr-only' : 'sp-switch__label'}>{label}</span>
    </button>
  );
}
