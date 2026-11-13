import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { QueryIntent } from '../../domain/query';
import { findFromQuery } from '../stack/FilterBar';
import { computedStyle, sizeObserver } from '../../lib/host';
import { canShowIssues, canShowLeaseTerm } from '../../domain/safe';
import { shownView, type PlanState, type View } from '../../state/planState';
import { Button, Icon, Segmented, TextField } from '../ui';
import { rememberTrigger } from '../../state/focusStore';
import { floorKept, openArea } from '../plan/actions';
import { useIsPhone, useMedia } from '../../lib/useMedia';
import { measure } from '../../lib/textFit';
import { SEARCH_HINTS, hintThatFits } from './toolbarRules';

export interface ToolbarProps {
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  /** Open data issues, for the Data issues button's count; 0 or absent draws no count. */
  issueCount?: number;
  /** The search query read as a space requirement: Enter runs it in Find space. */
  queryFind?: Extract<QueryIntent, { kind: 'size' }> | null;
}

const VIEWS: Array<{ id: View; label: string; icon: 'building' | 'stack' | 'timeline' | 'map' }> = [
  { id: 'building', label: 'Building', icon: 'building' },
  { id: 'stack', label: 'Stack', icon: 'stack' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'map', label: 'Map', icon: 'map' },
];

const WORKLIST_LABEL = 'Worklist';
const ISSUES_LABEL = 'Data issues';

/** What a search field keeps free at its right end for its clear button, px: text there would run under it. */
const CLEAR_ROOM = 16;

/**
 * The room the search field has for its placeholder, in px, and the font it is set in: read from the
 * field itself and again whenever it changes width (the window, a view's change of buttons).
 */
function useHintRoom(): [React.RefObject<HTMLDivElement | null>, { room: number; font: string } | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ room: number; font: string } | null>(null);
  useLayoutEffect(() => {
    const input = ref.current?.querySelector('input');
    if (!input) return;
    const read = () => {
      const cs = computedStyle(input);
      if (!cs) return;
      const edges = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const room = Math.floor(input.getBoundingClientRect().width - edges - CLEAR_ROOM);
      const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      setFit((was) => (was && was.room === room && was.font === font ? was : { room, font }));
    };
    read();
    const ro = sizeObserver(read);
    if (!ro) return;
    ro.observe(input);
    return () => ro.disconnect();
  }, []);
  return [ref, fit];
}

/**
 * The place of a button prospect-safe withholds: a box with the button's own metrics (laid out around the
 * same icon, word and count, which CSS supplies so that no word is in the page), invisible and inert. The
 * search field and the buttons before it stand where they do with the mode off, at every width.
 */
function Slot({ icon, label, count }: { icon: 'clock' | 'warning'; label: string; count?: number }) {
  return (
    <span className="sp-btn sp-btn--neutral sp-toolbar__slot" aria-hidden="true" style={{ '--sp-slot-label': JSON.stringify(label) } as CSSProperties}>
      <Icon name={icon} size={16} />
      <span className="sp-toolbar__slot-label" />
      {count !== undefined && count > 0 && <span className="sp-btn__count sp-toolbar__slot-label" style={{ '--sp-slot-label': JSON.stringify(String(count)) } as CSSProperties} />}
    </span>
  );
}

export function Toolbar({ state, patch, issueCount, queryFind }: ToolbarProps) {
  const phone = useIsPhone();
  // A phone of 420 px or less shares one row between the four tool buttons: there "Data issues" is drawn
  // as "Issues" (its accessible name stays "Data issues"), so the word and its count fit the button.
  const narrow = useMedia('(max-width: 420px)');
  const view: View = state.view === 'floor' ? 'stack' : shownView(state.view, phone);
  // A phone has no room for the model, and its tabs are words alone, so they fit beside the search.
  const views = phone ? VIEWS.filter((v) => v.id !== 'building').map(({ id, label }) => ({ id, label })) : VIEWS;
  const toggleMode = (mode: 'find' | 'worklist' | 'issues') => {
    if (state.mode === mode) patch({ mode: 'building', req: null, max: null, by: null, inquiry: null, window: null });
    else {
      rememberTrigger();
      patch({ mode, select: null, floor: floorKept(state.view, state.floor), window: mode === 'worklist' ? state.window ?? '12' : null });
    }
  };
  // While the brief has the page, the plan is put away: a change of view or search narrows the brief
  // back to the Area panel, so the change is seen (round 18: the tabs changed the URL and nothing else).
  // The lens is chosen in the KPI strip above (its Color-by switches), not here (team review, Nov 12).
  const toPlan = (p: Partial<PlanState>) => patch(state.mode === 'brief' ? { ...p, mode: 'area' } : p);
  const [searchRef, hintFit] = useHintRoom();
  const hint = hintThatFits(state.safe ? SEARCH_HINTS.safe : SEARCH_HINTS.owner, hintFit ? hintFit.room : null, (text) => measure(text, hintFit?.font ?? ''));
  return (
    <section className="sp-card sp-toolbar sp-no-print" aria-label="Views and filters">
      <Segmented aria-label="View" size="lg" options={views} value={view} onChange={(v) => toPlan({ view: v, floor: v === 'stack' ? null : state.floor })} />
      {/* Search and its tool buttons travel together: on one row they sit at the right; when the toolbar
          wraps they take the second row whole, the search filling it from the left edge. */}
      <div className="sp-toolbar__find">
        <div className="sp-toolbar__search" ref={searchRef}>
          {/* The field is named for the search it does: a prospect-safe search finds no tenant or prospect. */}
          <TextField label={state.safe ? SEARCH_HINTS.safe[0] : SEARCH_HINTS.owner[0]} hideLabel kind="search" placeholder={hint} value={state.q} onChange={(e) => toPlan({ q: e.target.value })} onClear={() => toPlan({ q: '' })} onKeyDown={(e) => e.key === 'Enter' && queryFind && !queryFind.badBy && toPlan({ ...findFromQuery(queryFind), ...(view === 'map' ? { view: 'building' as const } : {}) })} />
        </div>
        {/* Every view has Find space and Area (the area around the building was too hidden as a Map-only
            button); the one prospect-safe withholds (Worklist) comes last, so its empty place moves nothing. */}
        <div className="sp-toolbar__group">
          <Button icon="filter" active={state.mode === 'find'} onClick={() => toggleMode('find')} title="Find contiguous space by size and date">
            Find space
          </Button>
          <Button
            icon="people"
            active={state.mode === 'area' || state.mode === 'brief'}
            onClick={() => {
              if (state.mode === 'area' || state.mode === 'brief') patch({ mode: 'building' });
              else {
                rememberTrigger();
                openArea(patch, floorKept(state.view, state.floor));
              }
            }}
            title="Demographics, transit and amenities around the property"
          >
            Area
          </Button>
          {/* The renewal worklist lists leases by their term: not offered in prospect-safe mode. Its place
              is kept, empty: a box the size of the button, with nothing in it to read, focus or press, so
              the search field and the buttons before it stand where they do with the mode off. */}
          {canShowLeaseTerm(state.safe) ? (
            <Button icon="clock" active={state.mode === 'worklist'} onClick={() => toggleMode('worklist')} title="Renewal sweep: leases ending in a window">
              {WORKLIST_LABEL}
            </Button>
          ) : (
            <Slot icon="clock" label={WORKLIST_LABEL} />
          )}
          {/* Data issues, in every view and at every width (round 19: with the header button gone, a tablet or
              phone had no way to it). Withheld from a prospect like the worklist, its place kept the same way. */}
          {canShowIssues(state.safe) ? (
            <Button
              icon="warning"
              active={state.mode === 'issues'}
              count={issueCount}
              onClick={() => toggleMode('issues')}
              title="Data issues: records to fix or verify"
              // No aria-label: the name is the words on the button ("Issues 8", WCAG 2.5.3), and the title says
              // what they are ("Data issues: records to fix or verify").
            >
              {narrow ? 'Issues' : ISSUES_LABEL}
            </Button>
          ) : (
            <Slot icon="warning" label={narrow ? 'Issues' : ISSUES_LABEL} count={issueCount} />
          )}
        </div>
      </div>
    </section>
  );
}
