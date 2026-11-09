import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Popover, type PopoverTriggerProps } from './Popover';

export type MenuItem =
  | { kind?: 'item'; id: string; label: string; icon?: IconName; hint?: string; disabled?: boolean; onSelect: () => void }
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

  const move = (dir: 1 | -1) => {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (!els.length) return;
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const next = i === -1 ? (dir === 1 ? 0 : els.length - 1) : (i + dir + els.length) % els.length;
    els[next].focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
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
                role="menuitem"
                className="sp-menu__item"
                aria-disabled={it.disabled || undefined}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon && <Icon name={it.icon} size={16} />}
                <span>{it.label}</span>
                {it.hint && <span className="sp-menu__hint">{it.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
