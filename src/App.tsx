import { Component, createRef, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { getFontEpoch, subscribeFonts } from './lib/textFit';
import { segmentText } from './components/plan/segmentText';
import { property, TODAY } from './data/mock/property';
import { usePlanModel } from './model/usePlanModel';
import { usePlanState, useDocumentTitle } from './state/usePlanState';
import { useAnnouncement } from './state/useAnnouncement';
import { canShowRollover } from './domain/safe';
import { copyText, find, focused, hasPage, on, print, readUrl, requestFrame, setRootData, shareUrl } from './lib/host';
import { deriveMode, paletteOf, shownView } from './state/planState';
import { rentRollRows, toCsv } from './domain/exportCsv';
import { Header, type ExportKind } from './components/shell/Header';
import { Toolbar } from './components/shell/Toolbar';
import { KpiStrip, type KpiAction } from './components/kpis/KpiStrip';
import { ToastProvider, useToast, Sheet } from './components/ui';
import StackView from './components/stack/StackView';
import Inspector from './components/inspector/Inspector';
import { AreaPreview } from './components/inspector/AreaPreview';
import FloorView from './components/floor/FloorView';
import BuildingView from './components/building/BuildingView';
import TimelineView from './components/timeline/TimelineView';
import { MiniTimeline } from './components/timeline/MiniTimeline';
import { createDataSource } from './data/sources';
const MapView = lazy(() => import('./components/map/MapView'));
const AreaPanel = lazy(() => import('./components/map/AreaPanel').then((m) => ({ default: m.AreaPanel })));
import { PrintLayout } from './components/print/PrintLayout';
import { csvBlob, download } from './lib/exportFile';
import { svgToPng } from './lib/exportPng';
import { RECORD_REQUEST } from './components/map/recordSignal';
import { useIsNarrow, useIsPhone, usePrefersReducedMotion } from './lib/useMedia';
import { selectionSelector, useClearOfSheet } from './components/stack/aboveSheet';
import { clearSelection } from './components/plan/actions';
import { focusSegment, refocusTrigger, rememberTrigger } from './state/focusStore';
import { Patterns } from './components/plan/Patterns';
import { fmtDate } from './domain/dates';
import { num, pct } from './domain/format';
import './components/ui/ui.css';
import './components/shell/shell.css';
import './components/kpis/kpis.css';

/** The KPIs that open a panel in the inspector (the others change the lens or the view). */
const opensPanel = (action: KpiAction): boolean => action === 'find' || action === 'find-largest' || action === 'expiry-worklist';

/**
 * Where the keyboard goes after a KPI was activated. A KPI that opens a tool (the finder, the worklist)
 * hands focus to that panel's heading, as the panel does itself when it opens beside the Stack. Closing
 * the panel returns focus to the KPI (`rememberTrigger`): the KPI bar is the same element in every view
 * and every state, so the KPI that was pressed is always still there. A KPI that changes the lens or the
 * view keeps the focus it has.
 */
function focusAfterKpi(action: KpiAction): void {
  if (!hasPage() || !opensPanel(action)) return;
  // Two frames: the new state renders in the first; a panel that mounts with it is in the page by the second.
  requestFrame(() =>
    requestFrame(() => {
      find('.sp-inspector .sp-ins__title, .sp-sheet .sp-ins__title')?.focus({ preventScroll: true });
    }),
  );
}

/** What had the keyboard inside the stage, noted so that the same control can be found again after the stage is re-created. */
interface FocusMark {
  /** Tag and, where the control stands for a suite, a bar or a floor, that attribute: `button[data-floor="F8"]`. */
  selector: string;
  cls: string;
  label: string;
}

const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';

function focusMark(root: HTMLElement | null): FocusMark | null {
  const el = focused();
  if (!root || !el || !root.contains(el)) return null;
  const tag = el.tagName.toLowerCase();
  const cls = el.getAttribute('class') ?? '';
  for (const attr of ['data-key', 'data-bar', 'data-floor']) {
    const value = el.getAttribute(attr);
    if (value) return { selector: `${tag}[${attr}="${CSS.escape(value)}"]`, cls, label: '' };
  }
  return { selector: tag, cls, label: nameOf(el) };
}

function findMarked(root: HTMLElement | null, mark: FocusMark): HTMLElement | SVGElement | null {
  if (!root) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement | SVGElement>(mark.selector));
  // A suite, a bar or a floor is found by what it stands for; any other control by its class and its name.
  return mark.label ? (all.find((el) => (el.getAttribute('class') ?? '') === mark.cls && nameOf(el) === mark.label) ?? null) : (all[0] ?? null);
}

/**
 * The stage: the one view on screen. Its labels are fitted by measuring text, so the whole stage is
 * re-created (`epoch` is its key) when the web font arrives, which on a first visit can be a second or
 * more after the page is in use. Re-creating it destroys whatever control had the keyboard, and focus
 * would fall to the page: a floor opened by keyboard just before the font loaded lost its place this way.
 *
 * So the stage notes what has focus immediately before it is replaced (`getSnapshotBeforeUpdate`: React
 * calls it after rendering and before it touches the page) and hands focus to the same control in the new
 * stage as soon as that is in the page (`componentDidUpdate`, in the same commit). Nothing waits on a
 * timer, so there is no moment at which a key press finds no focused control.
 */
class Stage extends Component<{ epoch: string; children: ReactNode }> {
  private el = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(prev: { epoch: string }): FocusMark | null {
    return prev.epoch === this.props.epoch ? null : focusMark(this.el.current);
  }

  componentDidUpdate(_props: unknown, _state: unknown, mark: FocusMark | null) {
    if (!mark) return;
    const active = focused();
    if (active && active.isConnected) return;
    findMarked(this.el.current, mark)?.focus({ preventScroll: true });
  }

  render() {
    return (
      <div className="sp-stage" key={this.props.epoch} ref={this.el}>
        {this.props.children}
      </div>
    );
  }
}

const PRINT_PREVIEW = new URLSearchParams(readUrl()).get('print') === '1';

function Shell() {
  const [rawState, patch] = usePlanState(TODAY);
  // The deals lens is withheld in prospect-safe mode: fall back to status rather than draw an empty lens.
  const state = rawState.safe && rawState.lens === 'deals' ? { ...rawState, lens: 'status' as const } : rawState;
  const model = usePlanModel(property, state, TODAY);
  const toast = useToast();
  const narrow = useIsNarrow();
  const phone = useIsPhone();
  const reduceMotion = usePrefersReducedMotion();
  useDocumentTitle(state.safe, state.skin === 'classic' ? undefined : property.name);
  const mode = deriveMode(state);
  // The live region's text is dropped in the render in which prospect-safe changes, so a sentence written
  // for the broker ("Opened Cirrus Energy…") never outlives the moment the mode is turned on.
  const [announce, setAnnounce] = useAnnouncement(state.safe);
  useEffect(() => {
    const t = setTimeout(() => {
      const k = model.kpis;
      const d = model.deltas;
      setAnnounce(
        `As of ${fmtDate(state.asOf)}${model.isProjected ? ' (projected)' : ''}: leased ${pct(k.occupancy)}${d ? `, ${d.occupancy >= 0 ? 'up' : 'down'} ${Math.abs(d.occupancy * 100).toFixed(1)} points` : ''}; available ${num(k.availableDirect + k.availableSublease)} SF${canShowRollover(state.safe) ? `; expiring in 12 months ${num(k.expiring12)} SF` : ''}.`,
      );
    }, 400);
    return () => clearTimeout(t);
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
    // The page's root attributes go through the host adapter, so an embedding host can supply its own root.
    const apply = (t: string | null) => setRootData('theme', t);
    apply(theme);
    // Paper is white: a dark screen theme must not reach the printed report.
    const before = () => apply('light');
    const after = () => apply(theme);
    const stopBefore = on('beforeprint', before);
    const stopAfter = on('afterprint', after);
    return () => {
      stopBefore();
      stopAfter();
    };
  }, [theme]);
  useEffect(() => {
    setRootData('skin', state.skin === 'classic' ? 'classic' : 'glass');
    setRootData('palette', palette);
  }, [state.skin, palette]);

  const onExport = useCallback(
    async (kind: ExportKind) => {
      const stamp = `${property.name.replace(/\s+/g, '-')}-${state.asOf}${state.safe ? '-prospect-safe' : ''}`;
      switch (kind) {
        case 'link':
          await copyText(shareUrl());
          toast.push('Link to this view copied', { icon: 'link' });
          return;
        case 'csv': {
          download(csvBlob(toCsv(rentRollRows(property, model.floors, model.asOf, state.safe))), `rent-roll-${stamp}.csv`);
          toast.push(`Rent roll exported${state.safe ? ' (prospect-safe)' : ''}`, { icon: 'table' });
          return;
        }
        case 'png': {
          const svg = find<SVGSVGElement>('.sp-stack__body > svg');
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
          setTimeout(() => print(), 250);
          return;
        case 'video':
          RECORD_REQUEST.emit();
          return;
      }
    },
    [model.floors, model.asOf, state.asOf, state.safe, toast],
  );

  const onKpi = (a: KpiAction) => {
    // Closing the panel a KPI opened returns focus to that KPI.
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
    focusAfterKpi(a);
  };

  const dataSource = useMemo(() => createDataSource(state.live, state.census), [state.live, state.census]);
  const areaPanel = (
    <Suspense fallback={<p className="sp-weak" style={{ padding: 16 }}>Loading area data…</p>}>
      <AreaPanel model={model} state={state} dataSource={dataSource} />
    </Suspense>
  );
  const areaPreview = <AreaPreview model={model} state={state} patch={patch} dataSource={dataSource} />;
  // Escape on the page itself (no panel, popover or block focused) clears the active filter and returns to the plan.
  // In the Building view the plan's own controls do not use the key, so it works from them as well: the
  // view closes its open floor first (BuildingView), and the next Escape clears the filter here.
  const stageOwnsEscape = shownView(state.view, phone) !== 'building';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = focused();
      if (el && el.closest(`.sp-ins, .sp-pop__panel, .sp-sheet, ${stageOwnsEscape ? '.sp-stage, ' : ''}input, select, textarea`)) return;
      if (state.bucket !== null || state.q || state.window || state.req !== null || state.inquiry) {
        patch({ bucket: null, q: '', window: null, req: null, max: null, by: null, inquiry: null, mode: 'building' });
        refocusTrigger();
      }
    };
    return on('keydown', onKey);
  }, [state.bucket, state.q, state.window, state.req, state.inquiry, patch, stageOwnsEscape]);

  const inspector = useMemo(
    () => <Inspector model={model} state={state} patch={patch} mode={mode} areaPanel={areaPanel} areaPreview={areaPreview} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, state, patch, mode, dataSource],
  );
  const view = shownView(state.view, phone);
  // The building view shows a floor itself; the inspector joins it for a suite, a search, the worklist or issues.
  const showInspector = view === 'building' ? mode !== 'building' && mode !== 'floor' : view !== 'floor' || mode === 'block';
  const sheetOpen = narrow && mode !== 'building';
  // A sheet that opened for a selection (a suite, a floor) must not hide it: the page keeps the chosen block
  // or row whole above the sheet's top edge, follows the sheet when it grows, and tells the sheet how much
  // of the window the selection needs, so the expanded sheet stops short of it (stack/aboveSheet.ts).
  const sheetShown = narrow && showInspector && sheetOpen;
  const keepClear = useClearOfSheet(sheetShown && (mode === 'block' || mode === 'floor') ? selectionSelector(state.select, state.floor) : null, sheetShown, reduceMotion);
  // While a sheet is open the page ends with as much room as the sheet covers, so its last rows can be scrolled clear of it.
  const appStyle = sheetShown ? ({ paddingBottom: 'calc(var(--sp-sheet-cover, 48vh) + var(--sp-space-4))' } as CSSProperties) : undefined;
  const sheetTitle = mode === 'block' ? 'Suite' : mode === 'floor' ? 'Floor' : mode === 'find' ? 'Find space' : mode === 'worklist' ? 'Renewal worklist' : mode === 'issues' ? 'Data issues' : 'Area';

  return (
    <div className="sp-app" data-view={view} data-mode={mode} style={appStyle}>
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
      {/* The KPI bar: always here, above the toolbar, in every view and every state. Nothing shows, hides or
          resizes it, so the toolbar and the plan under it never move when the view or the selection changes. */}
      <KpiStrip model={model} state={state} onAction={onKpi} />
      <Toolbar state={state} patch={patch} />
      <main className={`sp-main sp-no-print ${showInspector ? '' : 'sp-main--wide'}`} id="sp-plan" tabIndex={-1}>
        <Stage epoch={view === 'map' ? 'map' : `fonts-${fontTick}`}>
          {view === 'building' && <BuildingView model={model} state={state} patch={patch} />}
          {view === 'stack' && <StackView model={model} state={state} patch={patch} />}
          {view === 'floor' && <FloorView model={model} state={state} patch={patch} />}
          {view === 'timeline' && <TimelineView model={model} state={state} patch={patch} />}
          {view === 'map' && (
            <Suspense fallback={<section className="sp-card sp-map-loading" aria-busy="true">Loading map…</section>}>
              <MapView model={model} state={state} patch={patch} dataSource={dataSource} />
            </Suspense>
          )}
        </Stage>
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
          keepClear={keepClear}
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
