import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface BaseProps {
  label: ReactNode;
  hint?: ReactNode;
  suffix?: ReactNode;
  hideLabel?: boolean;
  className?: string;
}

export interface TextFieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  kind?: 'text' | 'search' | 'number' | 'date';
  onClear?: () => void;
}

export function TextField({ label, hint, suffix, hideLabel, className = '', kind = 'text', onClear, id: idProp, ...rest }: TextFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`sp-field ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sp-sr-only' : 'sp-field__label'}>
        {label}
      </label>
      <div className="sp-field__row">
        <div className="sp-input-wrap" style={{ flex: 1 }}>
          {kind === 'search' && <Icon name="search" size={14} />}
          <input id={id} type={kind === 'search' ? 'search' : kind} className={`sp-input ${kind === 'search' ? 'sp-input--search' : ''}`} aria-describedby={hintId} {...rest} />
          {onClear && rest.value && (
            <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm sp-btn--icon sp-input-clear" aria-label="Clear" onClick={onClear}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        {suffix && <span className="sp-field__suffix">{suffix}</span>}
      </div>
      {hint && (
        <div id={hintId} className="sp-field__hint">
          {hint}
        </div>
      )}
    </div>
  );
}

export interface SelectFieldProps extends BaseProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  children: ReactNode;
}

export function SelectField({ label, hint, hideLabel, className = '', id: idProp, children, ...rest }: SelectFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className={`sp-field ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sp-sr-only' : 'sp-field__label'}>
        {label}
      </label>
      <select id={id} className="sp-select" {...rest}>
        {children}
      </select>
      {hint && <div className="sp-field__hint">{hint}</div>}
    </div>
  );
}
