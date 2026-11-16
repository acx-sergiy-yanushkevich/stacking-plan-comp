import { useCallback, useEffect, useRef, useState } from 'react';
import type { ISODate } from '../domain/types';
import { SAFE_TITLE, TITLE } from '../domain/safe';
import { historyBack, media, onPopState, readUrl, sheetEntry as onSheetEntry, setTitle, writeUrl } from '../lib/host';
import { openSession, serializeState, stepSession, type PlanSession, type PlanState } from './planState';

/** The fields whose change is a move to somewhere else, not an edit of where the user already is. */
const navigates = (a: PlanState, b: PlanState): boolean =>
  a.view !== b.view || a.building !== b.building || a.floor !== b.floor || a.ring !== b.ring || a.turn !== b.turn || opensSheet(a, b);

/**
 * On a phone or a tablet (up to 1099 px, where the side panel gives way to a sheet: shell.css) a suite opens a sheet over the plan, and the system Back is how a phone closes it (round 35: Back left the
 * view instead). Opening one is a history entry there; on a desktop the suite opens in the side panel and is an edit.
 */
const opensSheet = (a: PlanState, b: PlanState): boolean => !sheetOn(a) && sheetOn(b) && media('(max-width: 1099px)').matches();

/**
 * A sheet is up on a phone or tablet: a suite's, or a tool's (Find space, Worklist, Data issues, Area). Round 38: only a
 * suite's sheet was a history entry, so Back from a tool's sheet also left the view, or the app. The Map's Area panel
 * stands in the page under the map, not in a sheet (App.tsx `mapAreaInline`), so it is no entry of its own.
 */
const TOOL_SHEETS: ReadonlySet<PlanState['mode']> = new Set(['find', 'worklist', 'issues', 'area', 'brief']);
const sheetOn = (s: PlanState): boolean => s.select !== null || (TOOL_SHEETS.has(s.mode) && !(s.view === 'map' && s.mode === 'area'));

/**
 * One state object for the whole plan, mirrored into the address (`lib/host`: in a browser,
 * `history.replaceState`, or `pushState` for a move to another view, building or floor) so any screen is a shareable link and the back/forward buttons restore it.
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

  // Write every change to the address (also normalises an initial address with invalid params). A move to
  // another view, building, floor, ring or turn is a history entry (not the Prospect-safe mode: see below), so Back returns to
  // where the user was (round 29: every change replaced the entry and Back left the app); everything else,
  // such as typing a search or choosing a suite, replaces it.
  const last = useRef<PlanState | null>(null);
  // Back and Forward already moved the history; the write that follows them replaces the entry (round 31: with the mode
  // on it pushed a second copy of the restored view, so Back needed two presses and Forward was lost).
  const popped = useRef(false);
  // A phone sheet's own entry (see `opensSheet`). Closing the sheet with its Close button steps back over that entry
  // instead of replacing it, so no Back press is left that does nothing (round 36: each sheet opened and closed cost one).
  // `closing` holds the state to keep: the Back lands on the entry before the sheet, and that entry is then given it,
  // so anything else changed while the sheet was open is kept.
  const sheetEntry = useRef(false);
  const closing = useRef<PlanState | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = state;
    if (popped.current) {
      popped.current = false;
      // Back or Forward onto a sheet's own entry (marked when it was added): Close still steps back over it (round 37:
      // Back, Forward, then Close left a Back press that did nothing).
      sheetEntry.current = sheetOn(state) && onSheetEntry();
      writeUrl(serializeState(state, today), false);
      return;
    }
    if (prev && sheetEntry.current && sheetOn(prev) && !sheetOn(state) && !navigates(prev, state)) {
      sheetEntry.current = false;
      closing.current = state;
      historyBack();
      return;
    }
    const push = prev !== null && navigates(prev, state);
    if (push) sheetEntry.current = opensSheet(prev, state);
    writeUrl(serializeState(state, today), push, push && sheetEntry.current);
  }, [state, today]);

  // Back or Forward to another address is a link opened afresh: nothing withheld is carried into it.
  // Prospect-safe is the exception (round 30): Back never turns it off, so one swipe cannot show the owner plan
  // to a prospect. Turning it on replaces the entry, and an address that opens the plan without it is entered with
  // the mode still on; only the switch turns it off.
  useEffect(
    () =>
      onPopState(() => {
        // The Back that closing a sheet asked for: the plan stays as it is, and the entry it landed on is given that state.
        const kept = closing.current;
        if (kept) {
          closing.current = null;
          writeUrl(serializeState(kept, today), false);
          return;
        }
        popped.current = true;
        setSession((prev) => {
          const next = openSession(readUrl(), today);
          return prev.state.safe && !next.state.safe ? stepSession(next, { safe: true }, today) : next;
        });
      }),
    [today],
  );

  return [state, patch];
}

/**
 * The tab reads the product name, not the building's (review, Nov 13), and must never leak the mode:
 * prospect-safe gets its own title.
 */
export function useDocumentTitle(safe: boolean): void {
  useEffect(() => {
    setTitle(safe ? SAFE_TITLE : TITLE);
  }, [safe]);
}
