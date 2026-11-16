import { useLayoutEffect, useRef, useState } from 'react';
import type { QueryIntent } from '../../domain/query';
import { rangeProblem } from '../../domain/finder';
import { findFromQuery } from '../stack/FilterBar';
import { computedStyle, find, sizeObserver } from '../../lib/host';
import { canShowIssues, canShowLeaseTerm } from '../../domain/safe';
import { shownView, type PlanState, type View } from '../../state/planState';
import { Button, Menu, Segmented, TextField } from '../ui';
import type { MenuItem } from '../ui/Menu';
import { rememberTrigger } from '../../state/focusStore';
import { floorKept, openArea } from '../plan/actions';
import { useIsPhone } from '../../lib/useMedia';
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

export function Toolbar({ state, patch, issueCount, queryFind }: ToolbarProps) {
  const phone = useIsPhone();
  const view: View = state.view === 'floor' ? 'stack' : shownView(state.view, phone);
  // A phone has no room for the model, and its tabs are words alone, so they fit beside the search.
  const views = phone ? VIEWS.filter((v) => v.id !== 'building').map(({ id, label }) => ({ id, label })) : VIEWS;
  // `from` is the control that should take focus back when the panel closes: a menu item is gone by then, so the
  // phone's More button stands in for it.
  const toggleMode = (mode: 'find' | 'worklist' | 'issues', from?: Element | null) => {
    if (state.mode === mode) patch({ mode: 'building', req: null, max: null, by: null, inquiry: null, fit: 'any', window: null });
    else {
      rememberTrigger(from === undefined ? undefined : from);
      patch({ mode, select: null, floor: floorKept(state.view, state.floor), window: mode === 'worklist' ? state.window ?? '12' : null });
    }
  };
  // While the brief has the page, the plan is put away: a change of view or search narrows the brief
  // back to the Area panel, so the change is seen (round 18: the tabs changed the URL and nothing else).
  // The lens is chosen in the KPI strip above (its Color-by switches), not here (team review, Nov 12).
  const toPlan = (p: Partial<PlanState>) => patch(state.mode === 'brief' ? { ...p, mode: 'area' } : p);
  const areaOn = state.mode === 'area' || state.mode === 'brief';
  const toggleArea = (from?: Element | null) => {
    if (areaOn) patch({ mode: 'building' });
    else {
      rememberTrigger(from === undefined ? undefined : from);
      openArea(patch, floorKept(state.view, state.floor));
    }
  };
  // Round 37 (Sol): on a phone the tools took a row of their own under the search, so the first floor started lower.
  // There Find space stays a button beside the view tabs, and the others (Area, Worklist, Data issues) are one More
  // menu that carries the issue count. A prospect has Area alone, so it stays a button and there is no menu.
  const more = () => find('.sp-toolbar__more');
  const moreItems: MenuItem[] = [
    { id: 'area', label: 'Area', icon: 'people', checked: areaOn, onSelect: () => toggleArea(more()) },
    ...(canShowLeaseTerm(state.safe) ? [{ id: 'worklist', label: WORKLIST_LABEL, icon: 'clock' as const, checked: state.mode === 'worklist', onSelect: () => toggleMode('worklist', more()) }] : []),
    ...(canShowIssues(state.safe) ? [{ id: 'issues', label: ISSUES_LABEL, icon: 'warning' as const, hint: issueCount ? String(issueCount) : undefined, checked: state.mode === 'issues', onSelect: () => toggleMode('issues', more()) }] : []),
  ];
  const phoneTools = phone ? (
    <div className="sp-toolbar__group sp-toolbar__phone-tools">
      <Button icon="filter" active={state.mode === 'find'} onClick={() => toggleMode('find')} title="Find contiguous space by size and date">
        Find space
      </Button>
      {moreItems.length > 1 ? (
        <Menu
          label="More tools"
          items={moreItems}
          trigger={(p) => (
            <Button {...p} className="sp-toolbar__more" iconRight="chevron-down" active={areaOn || state.mode === 'worklist' || state.mode === 'issues'} count={issueCount} title="Area, Worklist and Data issues">
              More
            </Button>
          )}
        />
      ) : (
        <Button icon="people" active={areaOn} onClick={() => toggleArea()} title="Demographics, transit and amenities around the property">
          Area
        </Button>
      )}
    </div>
  ) : null;
  const [searchRef, hintFit] = useHintRoom();
  const hint = hintThatFits(state.safe ? SEARCH_HINTS.safe : SEARCH_HINTS.owner, hintFit ? hintFit.room : null, (text) => measure(text, hintFit?.font ?? ''));
  return (
    <section className="sp-card sp-toolbar sp-no-print" aria-label="Views and filters">
      <Segmented aria-label="View" size="lg" options={views} value={view} onChange={(v) => toPlan({ view: v, floor: v === 'stack' ? null : state.floor })} />
      {phoneTools}
      {/* Search and its tool buttons travel together: on one row they sit at the right; when the toolbar
          wraps they take the second row whole, the search filling it from the left edge. */}
      <div className="sp-toolbar__find">
        <div className="sp-toolbar__search" ref={searchRef}>
          {/* The field is named for the search it does: a prospect-safe search finds no tenant or prospect. */}
          <TextField label={state.safe ? SEARCH_HINTS.safe[0] : SEARCH_HINTS.owner[0]} hideLabel kind="search" placeholder={hint} value={state.q} onChange={(e) => toPlan({ q: e.target.value })} onClear={() => toPlan({ q: '' })} onKeyDown={(e) => e.key === 'Enter' && queryFind && !queryFind.badBy && !rangeProblem(queryFind.size, queryFind.max) && toPlan({ ...findFromQuery(queryFind), ...(view === 'map' ? { view: 'building' as const } : {}) })} />
        </div>
        {/* Every view has Find space and Area (the area around the building was too hidden as a Map-only
            button); the ones prospect-safe withholds (Worklist, Data issues) come last, so taking them away moves nothing. */}
        {!phone && <div className="sp-toolbar__group">
          <Button icon="filter" active={state.mode === 'find'} onClick={() => toggleMode('find')} title="Find contiguous space by size and date">
            Find space
          </Button>
          <Button
            icon="people"
            active={areaOn}
            onClick={() => toggleArea()}
            title="Demographics, transit and amenities around the property"
          >
            Area
          </Button>
          {/* The renewal worklist lists leases by their term: not offered in prospect-safe mode. It leaves no
              empty place behind: Find space and Area close up to the right edge and the search grows into the
              room (team review, Nov 13: a kept, invisible place read as a gap). */}
          {canShowLeaseTerm(state.safe) && (
            <Button icon="clock" active={state.mode === 'worklist'} onClick={() => toggleMode('worklist')} title="Renewal sweep: leases ending in a window">
              {WORKLIST_LABEL}
            </Button>
          )}
          {/* Data issues, in every view and at every width (round 19: with the header button gone, a tablet or
              phone had no way to it). Withheld from a prospect like the worklist. */}
          {canShowIssues(state.safe) && (
            <Button
              icon="warning"
              active={state.mode === 'issues'}
              count={issueCount}
              onClick={() => toggleMode('issues')}
              title="Data issues: records to fix or verify"
              // No aria-label: the name is the words on the button ("Issues 8", WCAG 2.5.3), and the title says
              // what they are ("Data issues: records to fix or verify").
            >
              {ISSUES_LABEL}
            </Button>
          )}
        </div>}
      </div>
    </section>
  );
}
