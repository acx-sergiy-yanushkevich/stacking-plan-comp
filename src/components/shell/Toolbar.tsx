import { LENSES, type LensId } from '../../domain/lenses';
import type { PlanState, View } from '../../state/planState';
import { Button, Segmented, SelectField, TextField } from '../ui';
import { rememberTrigger } from '../../state/focusStore';
import { useIsNarrow } from '../../lib/useMedia';

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

export function Toolbar({ state, patch }: ToolbarProps) {
  // The building model needs width: below the desktop layout the stack stands in for it.
  const narrow = useIsNarrow();
  const view: View = state.view === 'floor' || (narrow && state.view === 'building') ? 'stack' : state.view;
  const views = narrow ? VIEWS.filter((v) => v.id !== 'building') : VIEWS;
  const toggleMode = (mode: 'find' | 'worklist') => {
    if (state.mode === mode) patch({ mode: 'building', req: null, max: null, by: null, inquiry: null, window: null });
    else {
      rememberTrigger();
      patch({ mode, select: null, floor: null, window: mode === 'worklist' ? state.window ?? '12' : null });
    }
  };
  return (
    <section className="sp-card sp-toolbar sp-no-print" aria-label="Views and filters">
      <Segmented aria-label="View" size="lg" options={views} value={view} onChange={(v) => patch({ view: v, floor: v === 'stack' ? null : state.floor })} />
      <div className="sp-toolbar__group sp-toolbar__lens">
        <span className="sp-toolbar__label">Colour by</span>
        <Segmented aria-label="Colour lens" options={LENSES.filter((l) => !(state.safe && l.id === 'deals')).map((l) => ({ id: l.id, label: l.label, title: l.hint }))} value={state.lens} onChange={(lens) => patch({ lens })} />
      </div>
      <div className="sp-toolbar__lens-select">
        <SelectField label="Colour by" hideLabel value={state.lens} onChange={(e) => patch({ lens: e.target.value as LensId })}>
          {LENSES.filter((l) => !(state.safe && l.id === 'deals')).map((l) => (
            <option key={l.id} value={l.id}>
              Colour by {l.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="sp-toolbar__search">
        <TextField
          label="Find tenant, suite or prospect"
          hideLabel
          kind="search"
          placeholder={state.safe ? 'Find suite or floor' : 'Find tenant, suite or prospect'}
          value={state.q}
          onChange={(e) => patch({ q: e.target.value })}
          onClear={() => patch({ q: '' })}
        />
      </div>
      <div className="sp-toolbar__group">
        <Button icon="filter" active={state.mode === 'find'} onClick={() => toggleMode('find')} title="Find contiguous space by size and date">
          Find space
        </Button>
        <Button icon="clock" active={state.mode === 'worklist'} onClick={() => toggleMode('worklist')} title="Renewal sweep: leases ending in a window">
          Worklist
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
      </div>
    </section>
  );
}
