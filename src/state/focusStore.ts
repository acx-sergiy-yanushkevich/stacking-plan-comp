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
