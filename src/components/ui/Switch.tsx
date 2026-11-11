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
      {hideLabel ? (
        <span className="sp-sr-only">{label}</span>
      ) : (
        // The label is bold while the switch is on. An unseen bold copy holds that width all the time, so
        // turning the switch on or off never moves what stands beside it.
        <span className="sp-switch__label">
          <span>{label}</span>
          <span className="sp-switch__label-hold" aria-hidden="true">
            {label}
          </span>
        </span>
      )}
    </button>
  );
}
