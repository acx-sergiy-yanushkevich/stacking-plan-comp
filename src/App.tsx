import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { getFontEpoch, subscribeFonts } from './lib/textFit';
import { segmentText } from './components/plan/segmentText';
import { property, TODAY } from './data/mock/property';
import { usePlanModel } from './model/usePlanModel';
import { usePlanState, useDocumentTitle } from './state/usePlanState';
import { useAnnouncement } from './state/useAnnouncement';
import { canShowRollover } from './domain/safe';
import { deriveMode, paletteOf, shownView } from './state/planState';
import { rentRollRows, toCsv } from './domain/exportCsv';
import { Header, type ExportKind } from './components/shell/Header';
import { Toolbar } from './components/shell/Toolbar';
import { KpiStrip, type KpiAction } from './components/kpis/KpiStrip';
import { KpiReveal } from './components/kpis/KpiReveal';
import { ToastProvider, useToast, Sheet } from './components/ui';
import StackView from './components/stack/StackView';
import Inspector from './components/inspector/Inspector';
import FloorView from './components/floor/FloorView';
import BuildingView from './components/building/BuildingView';
import { KPI_COLUMN_QUERY, kpisBesideModel } from './components/building/kpiPlacement';
import TimelineView from './components/timeline/TimelineView';
import { MiniTimeline } from './components/timeline/MiniTimeline';
import { createDataSource } from './data/sources';
const MapView = lazy(() => import('./components/map/MapView'));
const AreaPanel = lazy(() => import('./components/map/AreaPanel').then((m) => ({ default: m.AreaPanel })));
import { PrintLayout } from './components/print/PrintLayout';
import { csvBlob, download } from './lib/exportFile';
import { svgToPng } from './lib/exportPng';
import { useIsNarrow, useIsPhone, useMedia } from './lib/useMedia';
import { clearSelection } from './components/plan/actions';
import { focusSegment, refocusTrigger, rememberTrigger } from './state/focusStore';
import { Patterns } from './components/plan/Patterns';
import { fmtDate } from './domain/dates';
import { num, pct } from './domain/format';
import './components/ui/ui.css';
import './components/shell/shell.css';
import './components/kpis/kpis.css';

/** What can take keyboard focus in a view that has just been shown. */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The KPIs that open a panel in the inspector (the others change the lens or the view). */
const opensPanel = (action: KpiAction): boolean => action === 'find' || action === 'find-largest' || action === 'expiry-worklist';

/**
 * Where the keyboard goes after a KPI was activated. A KPI that opens a tool (the finder, the worklist)
 * hands focus to that panel's heading, as the panel does itself when it opens beside the Stack; in the
 * Building view the panel is new on screen, and the KPI row that was pressed may have left with the column
 * it stood in (the KPIs move to the strip above the plan when the inspector takes the room beside the
 * model). A KPI that changes the view (WALT, to the Timeline) hands focus to the first control of the
 * view that came in. Focus never stays on a control that is gone, which would drop it to <body>.
 */
function focusAfterKpi(action: KpiAction): void {
  if (typeof document === 'undefined') return;
  // Two frames: the new state renders in the first; a panel that mounts with it is in the page by the second.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const lost = !active || active === document.body || !active.isConnected;
      const heading = opensPanel(action) ? document.querySelector<HTMLElement>('.sp-inspector .sp-ins__title, .sp-sheet .sp-ins__title') : null;
      if (heading) {
        heading.focus({ preventScroll: true });
        return;
      }
      if (!lost) return;
      const first = document.querySelector<HTMLElement>('.sp-stage')?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? document.querySelector<HTMLElement>('#sp-plan'))?.focus({ preventScroll: true });
    }),
  );
}

/**
 * The way back: when the panel a KPI opened is closed, focus returns to that KPI. The panel's own close
 * returns it to the element that opened it, which works while that element is still in the page. In the
 * Building view it is not: the KPI was a row of the column beside the model, and with the inspector gone
 * the column is drawn again as a new element. So the KPI is found again by what it is (`data-kpi`),
 * wherever the six are drawn now, once focus has been left on the page itself.
 */
function refocusKpi(action: KpiAction): void {
  if (typeof document === 'undefined') return;
  // After the frame in which the panel's close has tried the element it remembered, and the render that follows.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      const lost = !active || active === document.body || !active.isConnected || active.id === 'sp-plan';
      if (!lost) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>(`.sp-kpi[data-kpi="${action}"]`));
      (cards.find((el) => !el.closest('[inert], [hidden]')) ?? null)?.focus({ preventScroll: true });
    }),
  );
}

const PRINT_PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).get('print') === '1';

function Shell() {
  const [rawState, patch] = usePlanState(TODAY);
  // The deals lens is withheld in prospect-safe mode: fall back to status rather than draw an empty lens.
  const state = rawState.safe && rawState.lens === 'deals' ? { ...rawState, lens: 'status' as const } : rawState;
  const model = usePlanModel(property, state, TODAY);
  const toast = useToast();
  const narrow = useIsNarrow();
  const phone = useIsPhone();
  useDocumentTitle(state.safe, state.skin === 'classic' ? undefined : property.name);
  const mode = deriveMode(state);
  // The live region's text is dropped in the render in which prospect-safe changes, so a sentence written
  // for the broker ("Opened Cirrus Energy…") never outlives the moment the mode is turned on.
  const [announce, setAnnounce] = useAnnouncement(state.safe);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const k = model.kpis;
      const d = model.deltas;
      setAnnounce(
        `As of ${fmtDate(state.asOf)}${model.isProjected ? ' (projected)' : ''}: leased ${pct(k.occupancy)}${d ? `, ${d.occupancy >= 0 ? 'up' : 'down'} ${Math.abs(d.occupancy * 100).toFixed(1)} points` : ''}; available ${num(k.availableDirect + k.availableSublease)} SF${canShowRollover(state.safe) ? `; expiring in 12 months ${num(k.expiring12)} SF` : ''}.`,
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

  // Both palettes are dark unless the URL names a theme; the print preview keeps the white report.
  const palette = paletteOf(state);
  const theme = state.theme ?? (palette && !PRINT_PREVIEW ? 'dark' : null);
  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: string | null) => {
      if (t) root.dataset.theme = t;
      else delete root.dataset.theme;
    };
    apply(theme);
    // Paper is white: a dark screen theme must not reach the printed report.
    const before = () => apply('light');
    const after = () => apply(theme);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [theme]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = state.skin === 'classic' ? 'classic' : 'glass';
    if (palette) root.dataset.palette = palette;
    else delete root.dataset.palette;
  }, [state.skin, palette]);

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

  // The KPI that opened the panel now in the inspector: focus goes back to it when that panel closes.
  const kpiOpener = useRef<KpiAction | null>(null);
  const onKpi = (a: KpiAction) => {
    rememberTrigger();
    kpiOpener.current = opensPanel(a) ? a : null;
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
    focusAfterKpi(a);
  };

  const dataSource = useMemo(() => createDataSource(state.live, state.census), [state.live, state.census]);
  const areaPanel = (
    <Suspense fallback={<p className="sp-weak" style={{ padding: 16 }}>Loading area data…</p>}>
      <AreaPanel model={model} state={state} dataSource={dataSource} />
    </Suspense>
  );
  // Escape on the page itself (no panel, popover or block focused) clears the active filter and returns to the plan.
  // In the Building view the plan's own controls do not use the key, so it works from them as well: the
  // view closes its open floor first (BuildingView), and the next Escape clears the filter here.
  const stageOwnsEscape = shownView(state.view, phone) !== 'building';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el.closest(`.sp-ins, .sp-pop__panel, .sp-sheet, ${stageOwnsEscape ? '.sp-stage, ' : ''}input, select, textarea`)) return;
      if (state.bucket !== null || state.q || state.window || state.req !== null || state.inquiry) {
        patch({ bucket: null, q: '', window: null, req: null, max: null, by: null, inquiry: null, mode: 'building' });
        refocusTrigger();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.bucket, state.q, state.window, state.req, state.inquiry, patch, stageOwnsEscape]);

  const inspector = useMemo(
    () => <Inspector model={model} state={state} patch={patch} mode={mode} areaPanel={areaPanel} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, state, patch, mode, dataSource],
  );
  const view = shownView(state.view, phone);
  // The building view shows a floor itself; the inspector joins it for a suite, a search, the worklist or issues.
  const showInspector = view === 'building' ? mode !== 'building' && mode !== 'floor' : view !== 'floor' || mode === 'block';
  // The Building view keeps its KPIs in a column beside the model where the card has the room for one: a wide
  // window with no inspector beside the plan. That is decided by the room alone, never by whether a floor is
  // open, so opening or closing a floor moves neither the KPIs nor the toolbar. Everywhere else (a tablet,
  // the inspector open, every other view) the six stand in the strip above the plan.
  const roomForKpiColumn = useMedia(KPI_COLUMN_QUERY);
  const kpiColumn = kpisBesideModel({ view, roomy: roomForKpiColumn, inspector: showInspector && !narrow });
  const kpisOnTop = !kpiColumn;
  // A panel opened from a KPI has closed: back to that KPI (see refocusKpi).
  const lastMode = useRef(mode);
  useEffect(() => {
    const before = lastMode.current;
    lastMode.current = mode;
    if (before === mode || mode !== 'building') return;
    const opener = kpiOpener.current;
    kpiOpener.current = null;
    if (opener && (before === 'find' || before === 'worklist')) refocusKpi(opener);
  }, [mode]);
  const sheetOpen = narrow && mode !== 'building';
  const sheetTitle = mode === 'block' ? 'Suite' : mode === 'floor' ? 'Floor' : mode === 'find' ? 'Find space' : mode === 'worklist' ? 'Renewal worklist' : mode === 'issues' ? 'Data issues' : 'Area';

  return (
    <div className="sp-app" data-view={view} data-mode={mode}>
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
      <KpiReveal open={kpisOnTop}>
        <KpiStrip model={model} state={state} onAction={onKpi} />
      </KpiReveal>
      <Toolbar state={state} patch={patch} />
      <main className={`sp-main sp-no-print ${showInspector ? '' : 'sp-main--wide'}`} id="sp-plan" tabIndex={-1}>
        <div className="sp-stage" key={view === 'map' ? 'map' : `fonts-${fontTick}`}>
          {view === 'building' && <BuildingView model={model} state={state} patch={patch} onKpi={onKpi} kpiColumn={kpiColumn} />}
          {view === 'stack' && <StackView model={model} state={state} patch={patch} />}
          {view === 'floor' && <FloorView model={model} state={state} patch={patch} />}
          {view === 'timeline' && <TimelineView model={model} state={state} patch={patch} />}
          {view === 'map' && (
            <Suspense fallback={<section className="sp-card sp-map-loading" aria-busy="true">Loading map…</section>}>
              <MapView model={model} state={state} patch={patch} dataSource={dataSource} />
            </Suspense>
          )}
        </div>
        {!narrow && showInspector && (
          <aside className="sp-inspector sp-card" aria-label="Inspector">
            {inspector}
          </aside>
        )}
      </main>
      {narrow && showInspector && (
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
