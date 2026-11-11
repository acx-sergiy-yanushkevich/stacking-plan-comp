import { useCallback, useEffect, useState } from 'react';
import type { ISODate } from '../domain/types';
import { SAFE_TITLE, TITLE } from '../domain/safe';
import { onPopState, readUrl, setTitle, writeUrl } from '../lib/host';
import { openSession, serializeState, stepSession, type PlanSession, type PlanState } from './planState';

/**
 * One state object for the whole plan, mirrored into the address (`lib/host`: in a browser,
 * `history.replaceState`) so any screen is a shareable link and the back/forward buttons restore it.
 */
export function usePlanState(today: ISODate): [PlanState, (patch: Partial<PlanState>) => void] {
  // The session is the state plus what the Prospect-safe switch withheld. Only the state leaves this hook.
  const [session, setSession] = useState<PlanSession>(() => openSession(readUrl(), today));
  const { state } = session;

  // `stepSession` holds the prospect-safe invariants on every change: turning the mode on drops a search in
  // progress and returns the plan to today, no control can open the worklist, an expiry highlight or another
  // as-of date while it is on, and turning it off puts back what turning it on removed.
  const patch = useCallback(
    (p: Partial<PlanState>) => {
      setSession((prev) => stepSession(prev, p, today));
    },
    [today],
  );

  // Write every change to the address (also normalises an initial address with invalid params).
  useEffect(() => {
    writeUrl(serializeState(state, today));
  }, [state, today]);

  // Back or Forward to another address is a link opened afresh: nothing withheld is carried into it.
  useEffect(() => onPopState(() => setSession(openSession(readUrl(), today))), [today]);

  return [state, patch];
}

/** The tab title must never leak the mode: prospect-safe gets its own title. */
export function useDocumentTitle(safe: boolean, propertyName?: string): void {
  useEffect(() => {
    const base = safe ? SAFE_TITLE : TITLE;
    setTitle(propertyName ? `${propertyName} · ${base}` : base);
  }, [safe, propertyName]);
}
