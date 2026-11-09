import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ChipTone = 'neutral' | 'brand' | 'warn' | 'error' | 'success';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  tone?: ChipTone;
  icon?: IconName;
  count?: number | string;
  /** When provided the chip renders as a toggle button. */
  selected?: boolean;
  children: ReactNode;
}

export function Chip({ tone = 'neutral', icon, count, selected, className = '', children, onClick, ...rest }: ChipProps) {
  const cls = ['sp-chip', `sp-chip--${tone}`, className].filter(Boolean).join(' ');
  if (onClick || selected !== undefined) {
    return (
      <button type="button" className={cls} aria-pressed={selected} onClick={onClick} {...rest}>
        {icon && <Icon name={icon} size={12} />}
        {children}
        {count !== undefined && <span className="sp-chip__count">{count}</span>}
      </button>
    );
  }
  return (
    <span className={cls} {...(rest as Record<string, unknown>)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
      {count !== undefined && <span className="sp-chip__count">{count}</span>}
    </span>
  );
}
