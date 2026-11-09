import type { KeyboardEvent, ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { InspectorMode, PlanState } from '../../state/planState';
import { sf } from '../../domain/format';
import { Button } from '../ui';
import { clearSelection, type Patch } from '../plan/actions';

/** Close a block/floor panel and put keyboard focus back on the block (or floor label) it came from. */
function closeAndRefocus(patch: Patch, key: string | null, floorId: string | null) {
  clearSelection(patch);
  const sel = key ? `.sp-stage [data-key="${CSS.escape(key)}"], .sp-stage [data-bar^="tl-${CSS.escape(key)}"]` : floorId ? `.sp-stage [data-floor="${CSS.escape(floorId)}"]` : null;
  if (!sel) return;
  requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
}
import { segmentText } from '../plan/segmentText';
import { BuildingPanel } from './BuildingPanel';
import { BlockPanel } from './BlockPanel';
import { FloorPanel } from './FloorPanel';
import { FindPanel } from './FindPanel';
import { WorklistPanel } from './WorklistPanel';
import { IssuesPanel } from './IssuesPanel';
import './inspector.css';

export interface InspectorProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  mode: InspectorMode;
  /** The Area panel (Map view) is supplied by the map task. */
  areaPanel?: ReactNode;
}

interface Head {
  title: string;
  subtitle?: string;
  /** Undefined on Building: nothing to go back to. */
  close?: () => void;
}

function headFor(mode: InspectorMode, model: PlanModel, state: PlanState, patch: Patch): Head {
  switch (mode) {
    case 'block': {
      const seg = model.selected;
      if (!seg) return { title: 'Block', subtitle: 'This block is not on the plan for the as-of date', close: () => closeAndRefocus(patch, state.select, null) };
      const floor = model.floors.find((f) => f.floor.id === seg.floorId);
      const t = segmentText(seg, { safe: model.safe, asOf: model.asOf, lens: state.lens, floorName: floor?.floor.name ?? seg.floorId });
      const fname = floor?.floor.name ?? '';
      return { title: t.name, subtitle: fname && !t.sub.startsWith(fname) ? `${fname} · ${t.sub}` : t.sub, close: () => closeAndRefocus(patch, state.select, null) };
    }
    case 'floor': {
      const f = model.selectedFloor;
      return { title: f?.floor.name ?? 'Floor', subtitle: f ? `${sf(f.leasable)} leasable` : undefined, close: () => closeAndRefocus(patch, null, state.floor) };
    }
    case 'find':
      return { title: 'Find space', subtitle: model.filterLabel ?? 'Rank every space that fits a requirement', close: () => patch({ mode: 'building', req: null, max: null, by: null, inquiry: null }) };
    case 'worklist':
      return { title: 'Renewal worklist', subtitle: model.filterLabel ?? 'Leases ending in a window', close: () => patch({ mode: 'building', window: null }) };
    case 'issues':
      return { title: 'Data issues', subtitle: `${model.counts.error} errors · ${model.counts.warning} warnings · ${model.counts.info} info`, close: () => patch({ mode: 'building' }) };
    case 'area':
      return { title: 'Area', subtitle: `${model.property.city}, ${model.property.state}`, close: () => patch({ mode: 'building' }) };
    case 'building':
    default:
      return { title: 'Building', subtitle: model.property.name };
  }
}

/**
 * Right-hand detail panel. The container is sticky and clips; only the body scrolls.
 * The body remounts (and fades in) when the mode or the thing it describes changes.
 */
export default function Inspector({ model, state, patch, mode, areaPanel }: InspectorProps) {
  const head = headFor(mode, model, state, patch);
  const bodyKey = `${mode}:${mode === 'block' ? state.select : mode === 'floor' ? state.floor : mode === 'worklist' ? state.window : ''}`;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && head.close) {
      e.stopPropagation();
      head.close();
    }
  };

  let body: ReactNode;
  switch (mode) {
    case 'block':
      body = model.selected ? <BlockPanel seg={model.selected} model={model} state={state} patch={patch} /> : <p className="sp-ins__placeholder">Nothing selected.</p>;
      break;
    case 'floor':
      body = model.selectedFloor ? <FloorPanel floor={model.selectedFloor} model={model} state={state} patch={patch} /> : <p className="sp-ins__placeholder">Floor not found.</p>;
      break;
    case 'find':
      body = <FindPanel model={model} state={state} patch={patch} />;
      break;
    case 'worklist':
      body = <WorklistPanel model={model} state={state} patch={patch} />;
      break;
    case 'issues':
      body = <IssuesPanel model={model} state={state} patch={patch} />;
      break;
    case 'area':
      body = areaPanel ?? <p className="sp-ins__placeholder">Area demographics and amenities appear here in Map view.</p>;
      break;
    default:
      body = <BuildingPanel model={model} state={state} patch={patch} />;
  }

  return (
    <div className="sp-ins" data-mode={mode} onKeyDown={onKey}>
      <div className="sp-ins__head">
        <div className="sp-ins__titles">
          <h2 className="sp-ins__title">{head.title}</h2>
          {head.subtitle && <p className="sp-ins__subtitle">{head.subtitle}</p>}
        </div>
        {head.close && <Button variant="ghost" size="sm" icon="close" iconOnly aria-label="Close" title="Close (Esc)" onClick={head.close} />}
      </div>
      <div key={bodyKey} className="sp-ins__body">
        {body}
      </div>
    </div>
  );
}

export { Inspector };
