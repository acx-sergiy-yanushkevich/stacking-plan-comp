import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { refocusTrigger } from '../../state/focusStore';
import { find, requestFrame } from '../../lib/host';
import type { PlanModel } from '../../model/usePlanModel';
import type { InspectorMode, PlanState } from '../../state/planState';
import { sf } from '../../domain/format';
import { Button } from '../ui';
import { clearSelection, TOOL_CLOSE, type Patch } from '../plan/actions';
import { segmentText } from '../plan/segmentText';
import { canShowIssues, canShowTenantRisk } from '../../domain/safe';
import { BuildingHero } from '../hero/BuildingHero';
import { DotJoin } from '../hero/DotJoin';
import { BuildingPanel } from './BuildingPanel';
import { BlockPanel } from './BlockPanel';
import { FloorPanel } from './FloorPanel';
import { FindPanel } from './FindPanel';
import { WorklistPanel } from './WorklistPanel';
import { IssuesPanel } from './IssuesPanel';
import './inspector.css';

const isArea = (mode: InspectorMode) => mode === 'area' || mode === 'brief';

/** Close a block/floor panel and put keyboard focus back on the block (or floor label) it came from. */
function closeAndRefocus(patch: Patch, key: string | null, floorId: string | null) {
  clearSelection(patch);
  const sel = key ? `.sp-stage [data-key="${CSS.escape(key)}"], .sp-stage [data-bar^="tl-${CSS.escape(key)}"]` : floorId ? `.sp-stage [data-floor="${CSS.escape(floorId)}"]` : null;
  if (!sel) return;
  requestFrame(() => find(sel)?.focus());
}

export interface InspectorProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  mode: InspectorMode;
  /** The Area panel, opened from any view; supplied by the app, which owns the data source. */
  areaPanel?: ReactNode;
  /** "Around the building", first in the Building panel: the way the area is found (AreaPreview). */
  areaPreview?: ReactNode;
  /**
   * The page has drawn once. A tool panel that mounts already open on the page's first render (a link to
   * `?mode=area`) leaves focus where the browser put it; one that mounts later, because a click opened it
   * (the Building view has no inspector until then), takes focus like any panel that opens.
   */
  pageReady?: boolean;
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
      const t = segmentText(seg, { safe: model.safe, asOf: model.asOf, today: model.today, lens: state.lens, floorName: floor?.floor.name ?? seg.floorId });
      const fname = floor?.floor.name ?? '';
      return { title: t.name, subtitle: fname && !t.sub.startsWith(fname) ? `${fname} · ${t.sub}` : t.sub, close: () => closeAndRefocus(patch, state.select, null) };
    }
    case 'floor': {
      const f = model.selectedFloor;
      return { title: f?.floor.name ?? 'Floor', subtitle: f ? `${sf(f.leasable)} leasable` : undefined, close: () => closeAndRefocus(patch, null, state.floor) };
    }
    case 'find':
      return { title: 'Find space', subtitle: model.filterLabel ?? 'Rank every space that fits a requirement', close: () => { patch(TOOL_CLOSE.find); refocusTrigger(); } };
    case 'worklist':
      return { title: canShowTenantRisk(model.safe) ? 'Renewal worklist' : 'Lease expirations', subtitle: model.filterLabel ?? 'Leases ending in a window', close: () => { patch(TOOL_CLOSE.worklist); refocusTrigger(); } };
    case 'issues':
      return { title: 'Data issues', subtitle: canShowIssues(model.safe) ? `${model.counts.error} errors · ${model.counts.warning} warnings · ${model.counts.info} info` : undefined, close: () => { patch(TOOL_CLOSE.issues); refocusTrigger(); } };
    case 'area':
    case 'brief':
      return { title: 'Area', subtitle: `${model.property.city}, ${model.property.state}`, close: () => { patch(TOOL_CLOSE.area); refocusTrigger(); } };
    case 'building':
    default:
      return { title: 'Building', subtitle: model.property.name };
  }
}

/**
 * Right-hand detail panel. The container is sticky and clips; only the body scrolls.
 * The body remounts (and fades in) when the mode or the thing it describes changes.
 */
export default function Inspector({ model, state, patch, mode, areaPanel, areaPreview, pageReady = false }: InspectorProps) {
  const head = headFor(mode, model, state, patch);
  const bodyKey = `${mode}:${mode === 'block' ? state.select : mode === 'floor' ? state.floor : mode === 'worklist' ? state.window : ''}`;
  // The scroll container outlives a panel change (the building model stays mounted), so reset it by hand.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [bodyKey]);

  // Tool panels (find, worklist, issues, area) take focus when they open so Escape works at once.
  // Widening or narrowing the Area panel is the same panel: focus stays on the toggle that did it.
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const prevMode = useRef<InspectorMode | null>(pageReady ? null : mode);
  useEffect(() => {
    const toolModes: InspectorMode[] = ['find', 'worklist', 'issues', 'area', 'brief'];
    const resized = isArea(mode) && prevMode.current !== null && isArea(prevMode.current);
    if (mode !== prevMode.current && toolModes.includes(mode) && !resized) requestFrame(() => titleRef.current?.focus());
    prevMode.current = mode;
  }, [mode]);

  // The Area panel widens to the full page (the location brief) and back; Escape narrows it before it closes it.
  const wide = mode === 'brief';
  const toggleWide = () => patch({ mode: wide ? 'area' : 'brief' });
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    if (wide) {
      e.stopPropagation();
      toggleWide();
    } else if (head.close) {
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
    case 'brief':
      body = areaPanel ?? <p className="sp-ins__placeholder">Area demographics and amenities appear here.</p>;
      break;
    default:
      body = (
        <>
          {areaPreview}
          <BuildingPanel model={model} state={state} patch={patch} />
        </>
      );
  }

  return (
    <div className="sp-ins" data-mode={mode} onKeyDown={onKey}>
      <div className="sp-ins__head">
        <div className="sp-ins__titles">
          <h2 className="sp-ins__title" ref={titleRef} tabIndex={-1}>
            {head.title}
          </h2>
          {/* The subtitle is facts with a "·" between them ("Leases ending within 12 months · 4 leases ·
              35,300 SF"): it wraps between facts, or inside a long one, and never leaves a separator at
              the end of a line or the start of the next (DotJoin). */}
          {head.subtitle && (
            <p className="sp-ins__subtitle">
              <DotJoin parts={head.subtitle.split(' · ')} />
            </p>
          )}
        </div>
        {isArea(mode) && (
          <Button variant="ghost" size="sm" icon={wide ? 'collapse' : 'expand'} iconOnly aria-label="Location brief" aria-pressed={wide} title={wide ? 'Back to the side panel (Esc)' : 'Expand to the full page: the location brief'} onClick={toggleWide} />
        )}
        {head.close && <Button variant="ghost" size="sm" icon="close" iconOnly aria-label="Close" title="Close (Esc)" onClick={head.close} />}
      </div>
      {/* The part that scrolls: the bottom sheet sizes itself to what this holds (ui/Sheet.tsx). */}
      {/* The brief holds no control: its scroller takes a tab stop of its own (with a name), so a keyboard can
          scroll it where it scrolls (a phone or tablet sheet). */}
      <div className="sp-ins__body" ref={bodyRef} data-sheet-scroll="" {...(wide ? { tabIndex: 0, role: 'region', 'aria-label': 'Location brief' } : {})}>
        {(mode === 'building' || mode === 'floor' || mode === 'block') && state.view !== 'map' && <BuildingHero model={model} state={state} patch={patch} compact={mode === 'block'} />}
        <div key={bodyKey} className="sp-ins__content">
          {body}
        </div>
      </div>
    </div>
  );
}

export { Inspector };
