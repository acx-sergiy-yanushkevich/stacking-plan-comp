import type { PlanState } from './planState';

/** Remembers the element that opened a panel so closing it can return keyboard focus there. */
let trigger: HTMLElement | null = null;
export function rememberTrigger(el: Element | null = document.activeElement) {
  trigger = el instanceof HTMLElement ? el : null;
}
export function refocusTrigger() {
  const t = trigger;
  trigger = null;
  requestAnimationFrame(() => (t && t.isConnected ? t.focus() : document.querySelector<HTMLElement>('#sp-plan')?.focus()));
}
/** Focus a plan block (stack cell, timeline bar or plate slice) by segment key. */
export function focusSegment(key: string) {
  const sel = `.sp-stage [data-key="${CSS.escape(key)}"], .sp-stage [data-bar="tl-${CSS.escape(key)}"]`;
  requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
}

/** The tool panel (Issues, Worklist) that located a block, so clearing that selection returns there. */
let returnMode: PlanState['mode'] | null = null;
export function setReturnMode(mode: PlanState['mode']) {
  returnMode = mode;
}
export function takeReturnMode(): PlanState['mode'] | null {
  const m = returnMode;
  returnMode = null;
  return m;
}

/**
 * Entering and leaving the Floor view. Opening a floor plate swaps the whole stage, so the control
 * that was pressed ("Full floor plan", "Open floor plate") is unmounted and focus would fall to
 * <body>. The entry is noted here, the Floor view takes focus on its heading when it opens, and Back
 * returns to the view the user came from and to the control that opened it.
 */
export type FloorOrigin = 'building' | 'stack';

interface FloorEntry {
  from: FloorOrigin;
  /** Enough to find the opening control again: it is re-created when its view comes back. */
  tag: string;
  cls: string;
  label: string;
}

let floorEntry: FloorEntry | null = null;
let floorFocusDue = false;

const labelOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';

/** Call before navigating to the Floor view. Moving between floors inside it changes nothing. */
export function noteFloorEntry(): void {
  if (typeof document === 'undefined') return;
  const el = document.activeElement;
  if (el instanceof Element && el.closest('.sp-floor')) return;
  const shown = document.querySelector('.sp-app')?.getAttribute('data-view');
  const trigger = el instanceof HTMLElement && el !== document.body ? el : null;
  floorEntry = { from: shown === 'building' ? 'building' : 'stack', tag: trigger?.tagName ?? '', cls: trigger?.className ?? '', label: trigger ? labelOf(trigger) : '' };
  floorFocusDue = true;
}

/** The Floor view asks once, when it opens: true when it was opened by a control and should take focus. */
export function takeFloorFocus(): boolean {
  const due = floorFocusDue;
  floorFocusDue = false;
  return due;
}

/** The view Back returns to: where the user came from; the stack when the Floor view was opened by a link. */
export const floorOrigin = (): FloorOrigin => floorEntry?.from ?? 'stack';

/**
 * After Back: focus the control that opened the floor plate (found again by tag, class and name),
 * else that floor's own row or label in the view (`data-floor`), else the plan itself.
 */
export function refocusFloorTrigger(floorId: string): void {
  const entry = floorEntry;
  floorEntry = null;
  const find = (): HTMLElement | null => {
    const again = entry?.tag ? Array.from(document.querySelectorAll<HTMLElement>(`.sp-stage ${entry.tag.toLowerCase()}, .sp-inspector ${entry.tag.toLowerCase()}`)).find((el) => el.className === entry.cls && labelOf(el) === entry.label) : null;
    return again ?? document.querySelector<HTMLElement>(`.sp-stage [data-floor="${CSS.escape(floorId)}"]`);
  };
  // The returning view renders on the next frame; one more frame covers a view that mounts in two passes.
  requestAnimationFrame(() => {
    const el = find();
    if (el) el.focus();
    else requestAnimationFrame(() => (find() ?? document.querySelector<HTMLElement>('#sp-plan'))?.focus());
  });
}
