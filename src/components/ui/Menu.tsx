import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Popover, type PopoverTriggerProps } from './Popover';
import { focused } from '../../lib/host';

export type MenuItem =
  | {
      kind?: 'item';
      id: string;
      label: string;
      icon?: IconName;
      /** Decoration drawn where the icon would be (a colour swatch). */
      adornment?: ReactNode;
      hint?: string;
      /** A second, quieter line under the label: the facts that tell this entry from its neighbours. */
      detail?: string;
      /** Read after the label by assistive technology (`aria-description`): why an entry is disabled, say. */
      description?: string;
      disabled?: boolean;
      /** Set (true or false) on an item that is one of a choice: it is then a radio item, and the chosen one carries a tick. */
      checked?: boolean;
      onSelect: () => void;
    }
  | { kind: 'separator'; id: string }
  | { kind: 'heading'; id: string; label: string };

export interface MenuProps {
  label: string;
  items: MenuItem[];
  trigger: (props: PopoverTriggerProps) => ReactNode;
  align?: 'start' | 'end';
}

export function Menu({ label, items, trigger, align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  const move = (dir: 1 | -1 | 'first' | 'last') => {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(':is([role="menuitem"], [role="menuitemradio"]):not([aria-disabled="true"])') ?? []);
    if (!els.length) return;
    const i = els.indexOf(focused() as HTMLButtonElement);
    const next = dir === 'first' ? 0 : dir === 'last' ? els.length - 1 : i === -1 ? (dir === 1 ? 0 : els.length - 1) : (i + dir + els.length) % els.length;
    els[next].focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home' || e.key === 'End') {
      // Round 39: Home and End go to the first and last item, as the APG menu pattern has them.
      e.preventDefault();
      move(e.key === 'Home' ? 'first' : 'last');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={trigger} role="menu" label={label} align={align} panelClassName="sp-pop__panel--menu">
      <ul ref={listRef} className="sp-menu" role="none" onKeyDown={onKeyDown}>
        {items.map((it) => {
          if (it.kind === 'separator') return <li key={it.id} role="separator" className="sp-menu__sep" />;
          if (it.kind === 'heading')
            return (
              <li key={it.id} role="presentation" className="sp-menu__heading">
                {it.label}
              </li>
            );
          return (
            <li key={it.id} role="none">
              <button
                type="button"
                role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={it.checked}
                className="sp-menu__item"
                aria-disabled={it.disabled || undefined}
                aria-description={it.description}
                // A disabled entry is read in place, by the arrow keys' list, and takes no tab stop of its own.
                // Items are reached with the arrow keys, Home and End; the menu is one Tab stop (Popover closes it on Tab).
                tabIndex={-1}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon && <Icon name={it.icon} size={16} />}
                {it.adornment}
                {it.detail ? (
                  <span className="sp-menu__text">
                    <span className="sp-menu__label">{it.label}</span>
                    <span className="sp-menu__detail">{it.detail}</span>
                  </span>
                ) : (
                  <span>{it.label}</span>
                )}
                {/* The hint is read after a pause ("Data issues, 8"), not run into the label (round 38: "Data issues8"). */}
                {it.hint && (
                  <span className="sp-menu__hint">
                    <span className="sp-sr-only">, </span>
                    {it.hint}
                  </span>
                )}
                {it.checked && <Icon name="check" size={16} className="sp-menu__check" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
