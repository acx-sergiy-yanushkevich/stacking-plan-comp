import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'brand' | 'neutral' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: IconName;
  iconRight?: IconName;
  /** Icon-only button: `aria-label` is required. */
  iconOnly?: boolean;
  count?: number;
  /** What the count counts, for a screen reader ("8 data issues"): the visible figure alone says nothing (round 38). */
  countLabel?: string;
  active?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'neutral', size = 'md', icon, iconRight, iconOnly, count, countLabel, active, className = '', children, type = 'button', ...rest },
  ref,
) {
  if (iconOnly && !rest['aria-label'] && import.meta.env.DEV) console.warn('Icon-only button needs aria-label');
  const cls = ['sp-btn', `sp-btn--${variant}`, size === 'sm' ? 'sp-btn--sm' : '', iconOnly ? 'sp-btn--icon' : '', active ? 'is-active' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} aria-pressed={active !== undefined && !rest['aria-haspopup'] ? active : undefined} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {!iconOnly && children}
      {/* A menu button is not a toggle: its active state is the class alone (round 38: it was announced as both). */}
      {count !== undefined && count > 0 && (
        <span className="sp-btn__count" aria-hidden={countLabel ? true : undefined}>
          {count}
        </span>
      )}
      {count !== undefined && count > 0 && countLabel && <span className="sp-sr-only">, {countLabel}</span>}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  );
});
