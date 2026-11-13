import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useSlideMark } from './slideMark';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  title?: string;
  /** Decoration drawn before the label (a colour swatch). The label is then its own element, so a narrow layout can keep it for screen readers only. */
  adornment?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (id: T) => void;
  'aria-label': string;
  size?: 'md' | 'lg';
  /** Hide labels and show icons only (labels stay as accessible names). */
  iconsOnly?: boolean;
  className?: string;
}

/** Radio-group style segmented control with roving tabindex and arrow-key movement. */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', iconsOnly, className = '', ...rest }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // The chosen option's pill (its ::before) slides over from the option chosen before.
  const group = useRef<HTMLDivElement | null>(null);
  useSlideMark(group, '[aria-checked="true"]', value, '::before');
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = options.length;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next !== null) {
      e.preventDefault();
      onChange(options[next].id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div ref={group} role="radiogroup" aria-label={rest['aria-label']} className={`sp-segmented ${size === 'lg' ? 'sp-segmented--lg' : ''} ${className}`}>
      {options.map((o, i) => {
        const checked = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconsOnly ? o.label : undefined}
            title={o.title ?? (iconsOnly ? o.label : undefined)}
            tabIndex={checked ? 0 : -1}
            className="sp-segmented__opt"
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.adornment}
            {!iconsOnly && (o.adornment ? <span className="sp-segmented__label">{o.label}</span> : o.label)}
          </button>
        );
      })}
    </div>
  );
}
