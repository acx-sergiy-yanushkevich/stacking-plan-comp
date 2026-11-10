import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getFontEpoch, subscribeFonts } from './lib/textFit';
import { segmentText } from './components/plan/segmentText';
import { property, TODAY } from './data/mock/property';
import { usePlanModel } from './model/usePlanModel';
import { usePlanState, useDocumentTitle } from './state/usePlanState';
import { deriveMode } from './state/planState';
import { rentRollRows, toCsv } from './domain/exportCsv';
import { Header, type ExportKind } from './components/shell/Header';
import { Toolbar } from './components/shell/Toolbar';
import { KpiStrip, type KpiAction } from './components/kpis/KpiStrip';
import { ToastProvider, useToast, Sheet } from './components/ui';
import StackView from './components/stack/StackView';
import Inspector from './components/inspector/Inspector';
import FloorView from './components/floor/FloorView';
import TimelineView from './components/timeline/TimelineView';
import { MiniTimeline } from './components/timeline/MiniTimeline';
import { createDataSource } from './data/sources';
const MapView = lazy(() => import('./components/map/MapView'));
const AreaPanel = lazy(() => import('./components/map/AreaPanel').then((m) => ({ default: m.AreaPanel })));
import { PrintLayout } from './components/print/PrintLayout';
import { csvBlob, download } from './lib/exportFile';
import { svgToPng } from './lib/exportPng';
import { useIsNarrow } from './lib/useMedia';
import { clearSelection } from './components/plan/actions';
import { focusSegment, refocusTrigger, rememberTrigger } from './state/focusStore';
import { Patterns } from './components/plan/Patterns';
import { fmtDate } from './domain/dates';
import { num, pct } from './domain/format';
import './components/ui/ui.css';
import './components/shell/shell.css';
import './components/kpis/kpis.css';

const PRINT_PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).get('print') === '1';

function Shell() {
  const [rawState, patch] = usePlanState(TODAY);
  // The deals lens is withheld in prospect-safe mode: fall back to status rather than draw an empty lens.
  const state = rawState.safe && rawState.lens === 'deals' ? { ...rawState, lens: 'status' as const } : rawState;
  const model = usePlanModel(property, state, TODAY);
  const toast = useToast();
  const narrow = useIsNarrow();
  useDocumentTitle(state.safe, state.skin === 'classic' ? undefined : property.name);
  const mode = deriveMode(state);
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => {
      const k = model.kpis;
      const d = model.deltas;
      setAnnounce(
        `As of ${fmtDate(state.asOf)}${model.isProjected ? ' (projected)' : ''}: leased ${pct(k.occupancy)}${d ? `, ${d.occupancy >= 0 ? 'up' : 'down'} ${Math.abs(d.occupancy * 100).toFixed(1)} points` : ''}; available ${num(k.availableDirect + k.availableSublease)} SF; expiring in 12 months ${num(k.expiring12)} SF.`,
      );
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.asOf]);

  // Selecting a block is announced: focus stays on the plan, so a screen-reader user would otherwise hear nothing.
  const announcedSelect = useRef(state.select);
  useEffect(() => {
    if (state.select === announcedSelect.current) return;
    announcedSelect.current = state.select;
    const seg = state.select ? model.segIndex.get(state.select) : null;
    if (!seg) return;
    const floorName = model.floors.find((f) => f.floor.id === seg.floorId)?.floor.name ?? '';
    const t = segmentText(seg, { safe: model.safe, asOf: model.asOf, today: model.today, lens: state.lens, floorName });
    setAnnounce(`Opened ${t.name}, ${floorName}${seg.suite ? `, suite ${seg.suite}` : ''}, ${num(seg.size)} SF. Details are in the side panel; Escape returns to the plan.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.select]);
  // Labels are fitted by measuring text: fit them again once the web font has loaded.
  const fontTick = useSyncExternalStore(subscribeFonts, getFontEpoch, () => 0);

  useEffect(() => {
    if (state.theme) document.documentElement.dataset.theme = state.theme;
    else delete document.documentElement.dataset.theme;
  }, [state.theme]);
  useEffect(() => {
    document.documentElement.dataset.skin = state.skin === 'classic' ? 'classic' : 'glass';
  }, [state.skin]);

  const onExport = useCallback(
    async (kind: ExportKind) => {
      const stamp = `${property.name.replace(/\s+/g, '-')}-${state.asOf}${state.safe ? '-prospect-safe' : ''}`;
      switch (kind) {
        case 'link':
          await navigator.clipboard?.writeText(location.href);
          toast.push('Link to this view copied', { icon: 'link' });
          return;
        case 'csv': {
          download(csvBlob(toCsv(rentRollRows(property, model.floors, model.asOf, state.safe))), `rent-roll-${stamp}.csv`);
          toast.push(`Rent roll exported${state.safe ? ' (prospect-safe)' : ''}`, { icon: 'table' });
          return;
        }
        case 'png': {
          const svg = document.querySelector<SVGSVGElement>('.sp-stack__body > svg');
          if (!svg) {
            toast.push('Switch to the Stack view to export the plan as an image', { icon: 'info' });
            return;
          }
          try {
            download(await svgToPng(svg, 2), `stacking-plan-${stamp}.png`);
            toast.push('Plan exported at 2× for slides', { icon: 'image' });
          } catch {
            toast.push('Image export failed in this browser', { icon: 'warning' });
          }
          return;
        }
        case 'pdf':
          toast.push('Opening the print dialog: choose "Save as PDF", landscape', { icon: 'file' });
          setTimeout(() => window.print(), 250);
          return;
        case 'video':
          window.dispatchEvent(new CustomEvent('sp:record'));
          return;
      }
    },
    [model.floors, model.asOf, state.asOf, state.safe, toast],
  );

  const onKpi = (a: KpiAction) => {
    rememberTrigger();
    switch (a) {
      case 'status':
        patch({ lens: 'status', mode: 'building', select: null, q: '', window: null, req: null, inquiry: null, bucket: null });
        break;
      case 'find':
        patch({ mode: 'find', select: null, floor: null, window: null, bucket: null });
        break;
      case 'find-largest':
        patch({ mode: 'find', req: model.kpis.maxContiguous.size, max: null, by: null, inquiry: null, select: null, floor: null, window: null, bucket: null });
        break;
      case 'expiry-worklist':
        patch({ lens: 'expiry', mode: 'worklist', window: '12', select: null, floor: null, req: null, inquiry: null, bucket: null });
        break;
      case 'timeline':
        patch({ view: 'timeline' });
        break;
      case 'deals':
        patch({ lens: 'deals', mode: 'building', select: null, window: null, req: null, inquiry: null, bucket: null });
        break;
    }
  };

  const dataSource = useMemo(() => createDataSource(state.live, state.census), [state.live, state.census]);
  const areaPanel = (
    <Suspense fallback={<p className="sp-weak" style={{ padding: 16 }}>Loading area data…</p>}>
      <AreaPanel model={model} state={state} dataSource={dataSource} />
    </Suspense>
  );
  // Escape on the page itself (no panel, popover or block focused) clears the active filter and returns to the plan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el.closest('.sp-ins, .sp-pop__panel, .sp-sheet, .sp-stage, input, select, textarea')) return;
      if (state.bucket !== null || state.q || state.window || state.req !== null || state.inquiry) {
        patch({ bucket: null, q: '', window: null, req: null, max: null, by: null, inquiry: null, mode: 'building' });
        refocusTrigger();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.bucket, state.q, state.window, state.req, state.inquiry, patch]);

  const inspector = useMemo(
    () => <Inspector model={model} state={state} patch={patch} mode={mode} areaPanel={areaPanel} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, state, patch, mode, dataSource],
  );
  const sheetOpen = narrow && mode !== 'building';
  const sheetTitle = mode === 'block' ? 'Suite' : mode === 'floor' ? 'Floor' : mode === 'find' ? 'Find space' : mode === 'worklist' ? 'Renewal worklist' : mode === 'issues' ? 'Data issues' : 'Area';

  return (
    <div className="sp-app" data-view={state.view} data-mode={mode}>
      <svg className="sp-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <Patterns />
      </svg>
      <a className="sp-skip" href="#sp-plan">
        Skip to plan
      </a>
      <div className="sp-sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      <Header model={model} state={state} patch={patch} onExport={onExport} miniTimeline={<MiniTimeline model={model} asOf={state.asOf} onChange={(asOf) => patch({ asOf })} width={312} height={64} />} />
      <KpiStrip model={model} state={state} onAction={onKpi} />
      <Toolbar state={state} patch={patch} />
      <main className={`sp-main sp-no-print ${state.view === 'floor' && mode !== 'block' ? 'sp-main--wide' : ''}`} id="sp-plan" tabIndex={-1}>
        <div className="sp-stage" key={state.view === 'map' ? 'map' : `fonts-${fontTick}`}>
          {state.view === 'stack' && <StackView model={model} state={state} patch={patch} />}
          {state.view === 'floor' && <FloorView model={model} state={state} patch={patch} />}
          {state.view === 'timeline' && <TimelineView model={model} state={state} patch={patch} />}
          {state.view === 'map' && (
            <Suspense fallback={<section className="sp-card sp-map-loading" aria-busy="true">Loading map…</section>}>
              <MapView model={model} state={state} patch={patch} dataSource={dataSource} />
            </Suspense>
          )}
        </div>
        {!narrow && (state.view !== 'floor' || mode === 'block') && (
          <aside className="sp-inspector sp-card" aria-label="Inspector">
            {inspector}
          </aside>
        )}
      </main>
      {narrow && (state.view !== 'floor' || mode === 'block') && (
        <Sheet
          open={sheetOpen}
          onClose={() => {
            if (mode === 'block' || mode === 'floor') {
              const key = state.select;
              clearSelection(patch);
              if (key) focusSegment(key);
              else refocusTrigger();
            } else {
              patch({ mode: 'building', req: null, inquiry: null, window: null });
              refocusTrigger();
            }
          }}
          title={sheetTitle}
          hideHeader
          modeless={mode === 'find' || mode === 'worklist' || mode === 'issues'}
        >
          {inspector}
        </Sheet>
      )}
      <PrintLayout key={`print-${fontTick}`} model={model} state={state} visible={PRINT_PREVIEW} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
