import { useCallback, useEffect, useState } from 'react';
import type { ISODate } from '../domain/types';
import { SAFE_TITLE, TITLE } from '../domain/safe';
import { parseState, serializeState, type PlanState } from './planState';

/**
 * One state object for the whole plan, mirrored into the URL with
 * `history.replaceState` so any screen is a shareable link and the back/forward
 * buttons (popstate) restore it.
 */
export function usePlanState(today: ISODate): [PlanState, (patch: Partial<PlanState>) => void] {
  const [state, setState] = useState<PlanState>(() => parseState(window.location.search, today));

  const patch = useCallback((p: Partial<PlanState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Write every change to the URL (also normalises an initial URL with invalid params).
  useEffect(() => {
    const qs = serializeState(state, today);
    const url = `${window.location.pathname}${qs}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [state, today]);

  useEffect(() => {
    const onPop = () => setState(parseState(window.location.search, today));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [today]);

  return [state, patch];
}

/** `document.title` must never leak the mode: prospect-safe gets its own title. */
export function useDocumentTitle(safe: boolean, propertyName?: string): void {
  useEffect(() => {
    const base = safe ? SAFE_TITLE : TITLE;
    document.title = propertyName ? `${propertyName} · ${base}` : base;
  }, [safe, propertyName]);
}
