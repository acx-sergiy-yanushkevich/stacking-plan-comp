import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { LENSES, type LensId } from '../../domain/lenses';
import { canShowLeaseTerm, canUseLens } from '../../domain/safe';
import { shownView, type PlanState, type View } from '../../state/planState';
import { Button, Icon, Segmented, SelectField, TextField } from '../ui';
import { rememberTrigger } from '../../state/focusStore';
import { useIsPhone } from '../../lib/useMedia';
import { measure } from '../../lib/textFit';
import { SEARCH_HINTS, hintThatFits, prospectFirst } from './toolbarRules';

export interface ToolbarProps {
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

const VIEWS: Array<{ id: View; label: string; icon: 'building' | 'stack' | 'timeline' | 'map' }> = [
  { id: 'building', label: 'Building', icon: 'building' },
  { id: 'stack', label: 'Stack', icon: 'stack' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'map', label: 'Map', icon: 'map' },
];

/** The lenses in the toolbar's order: those a prospect is also offered first, so they stay put when the others go. */
const TOOLBAR_LENSES = prospectFirst(LENSES);

const WORKLIST_LABEL = 'Worklist';

/** What a search field keeps free at its right end for its clear button, px: text there would run under it. */
const CLEAR_ROOM = 16;

/**
 * The room the search field has for its placeholder, in px, and the font it is set in: read from the
 * field itself and again whenever it changes width (the window, the Map view's extra button).
 */
function useHintRoom(): [React.RefObject<HTMLDivElement | null>, { room: number; font: string } | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ room: number; font: string } | null>(null);
  useLayoutEffect(() => {
    const input = ref.current?.querySelector('input');
    if (!input) return;
    const read = () => {
      const cs = getComputedStyle(input);
      const edges = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const room = Math.floor(input.getBoundingClientRect().width - edges - CLEAR_ROOM);
      const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      setFit((was) => (was && was.room === room && was.font === font ? was : { room, font }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(input);
    return () => ro.disconnect();
  }, []);
  return [ref, fit];
}

export function Toolbar({ state, patch }: ToolbarProps) {
  const phone = useIsPhone();
  const view: View = state.view === 'floor' ? 'stack' : shownView(state.view, phone);
  // A phone has no room for the model, and its tabs are words alone: without their icons the lens picker fits beside them.
  const views = phone ? VIEWS.filter((v) => v.id !== 'building').map(({ id, label }) => ({ id, label })) : VIEWS;
  // Prospect-safe offers no lens that colours by something withheld: Deals (deal stage) and Expiration
  // (months to lease end, which could only repeat the Status lens). A link that names one draws Status.
  const lenses = TOOLBAR_LENSES.filter((l) => canUseLens(l.id, state.safe));
  const lens: LensId = canUseLens(state.lens, state.safe) ? state.lens : 'status';
  const toggleMode = (mode: 'find' | 'worklist') => {
    if (state.mode === mode) patch({ mode: 'building', req: null, max: null, by: null, inquiry: null, window: null });
    else {
      rememberTrigger();
      patch({ mode, select: null, floor: null, window: mode === 'worklist' ? state.window ?? '12' : null });
    }
  };
  const [searchRef, hintFit] = useHintRoom();
  const hint = hintThatFits(state.safe ? SEARCH_HINTS.safe : SEARCH_HINTS.owner, hintFit ? hintFit.room : null, (text) => measure(text, hintFit?.font ?? ''));
  return (
    <section className="sp-card sp-toolbar sp-no-print" aria-label="Views and filters">
      <Segmented aria-label="View" size="lg" options={views} value={view} onChange={(v) => patch({ view: v, floor: v === 'stack' ? null : state.floor })} />
      <div className="sp-toolbar__group sp-toolbar__lens">
        <span className="sp-toolbar__label">Color by</span>
        <Segmented aria-label="Color lens" options={lenses.map((l) => ({ id: l.id, label: l.label, title: l.hint }))} value={lens} onChange={(next) => patch({ lens: next })} />
      </div>
      <div className="sp-toolbar__lens-select">
        <SelectField label="Color by" hideLabel value={lens} onChange={(e) => patch({ lens: e.target.value as LensId })}>
          {lenses.map((l) => (
            <option key={l.id} value={l.id}>
              Color by {l.label}
            </option>
          ))}
        </SelectField>
      </div>
      {/* Search and its tool buttons travel together: on one row they sit at the right; when the toolbar
          wraps they take the second row whole, the search filling it from the left edge. */}
      <div className="sp-toolbar__find">
        <div className="sp-toolbar__search" ref={searchRef}>
          <TextField label="Find tenant, suite or prospect" hideLabel kind="search" placeholder={hint} value={state.q} onChange={(e) => patch({ q: e.target.value })} onClear={() => patch({ q: '' })} />
        </div>
        {/* The buttons that every mode and view has come first; the one a view adds (Area) and the one
            prospect-safe withholds (Worklist) follow, so neither moves the others. */}
        <div className="sp-toolbar__group">
          <Button icon="filter" active={state.mode === 'find'} onClick={() => toggleMode('find')} title="Find contiguous space by size and date">
            Find space
          </Button>
          {view === 'map' && (
            <Button
              icon="people"
              active={state.mode === 'area'}
              onClick={() => {
                if (state.mode === 'area') patch({ mode: 'building' });
                else {
                  rememberTrigger();
                  patch({ mode: 'area', select: null, floor: null, req: null, max: null, by: null, inquiry: null, window: null });
                }
              }}
              title="Demographics, transit and amenities around the property"
            >
              Area
            </Button>
          )}
          {/* The renewal worklist lists leases by their term: not offered in prospect-safe mode. Its place
              is kept, empty: a box the size of the button, with nothing in it to read, focus or press, so
              the search field and the buttons before it stand where they do with the mode off. */}
          {canShowLeaseTerm(state.safe) ? (
            <Button icon="clock" active={state.mode === 'worklist'} onClick={() => toggleMode('worklist')} title="Renewal sweep: leases ending in a window">
              {WORKLIST_LABEL}
            </Button>
          ) : (
            <span className="sp-btn sp-btn--neutral sp-toolbar__slot" aria-hidden="true" style={{ '--sp-slot-label': JSON.stringify(WORKLIST_LABEL) } as CSSProperties}>
              <Icon name="clock" size={16} />
              <span className="sp-toolbar__slot-label" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
