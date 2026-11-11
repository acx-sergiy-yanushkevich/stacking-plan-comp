import { useRef, useState, type KeyboardEvent } from 'react';

/**
 * The keyboard model of a list of floors that stands for the building model: the list is one tab stop,
 * ↑ ↓ move between floors, Home and End jump to the top and bottom floor. (Enter and Space are the
 * button's own.) The tab stop is the open floor; with none open, the floor last focused, the top floor
 * at first. The docked floor picker (MiniStack) and the list of floor labels beside the model
 * (FloorLabels) share it, so the two behave as one control in two shapes.
 */
export function useFloorRoving(ids: string[], currentId: string) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const at = (id: string | null) => (id === null ? -1 : ids.indexOf(id));
  const stop = at(currentId) >= 0 ? at(currentId) : Math.max(0, at(lastId));
  return {
    /** Called when a row takes focus: it becomes the tab stop while no floor is open. */
    remember: setLastId,
    /** What makes row `i` part of the one tab stop. */
    rowProps: (i: number) => ({
      ref: (el: HTMLButtonElement | null) => {
        refs.current[i] = el;
      },
      tabIndex: i === stop ? 0 : -1,
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : null;
        if (to === null) return;
        e.preventDefault();
        refs.current[Math.min(ids.length - 1, Math.max(0, to))]?.focus();
      },
    }),
  };
}
