import { useCallback, useEffect, useMemo } from 'react';
import { property, TODAY } from './data/mock/property';
import { usePlanModel } from './model/usePlanModel';
import { usePlanState, useDocumentTitle } from './state/usePlanState';
import { deriveMode } from './state/planState';
import { rentRollRows, toCsv } from './domain/exportCsv';
import { Header, type ExportKind } from './components/shell/Header';
import { SaleBanner } from './components/shell/SaleBanner';
import { Toolbar } from './components/shell/Toolbar';
import { KpiStrip, type KpiAction } from './components/kpis/KpiStrip';
import { ToastProvider, useToast, Sheet } from './components/ui';
import StackView from './components/stack/StackView';
import Inspector from './components/inspector/Inspector';
import FloorView from './components/floor/FloorView';
import TimelineView from './components/timeline/TimelineView';
import { MiniTimeline } from './components/timeline/MiniTimeline';
import { PrintLayout } from './components/print/PrintLayout';
import { csvBlob, download } from './lib/exportFile';
import { svgToPng } from './lib/exportPng';
import { useIsNarrow } from './lib/useMedia';
import { clearSelection } from './components/plan/actions';
import './components/ui/ui.css';
import './components/shell/shell.css';
import './components/kpis/kpis.css';

const PRINT_PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).get('print') === '1';

function Shell() {
  const [state, patch] = usePlanState(TODAY);
  const model = usePlanModel(property, state, TODAY);
  const toast = useToast();
  const narrow = useIsNarrow();
  useDocumentTitle(state.safe);
  const mode = deriveMode(state);

  useEffect(() => {
    if (state.theme) document.documentElement.dataset.theme = state.theme;
    else delete document.documentElement.dataset.theme;
  }, [state.theme]);

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

  const inspector = useMemo(() => <Inspector model={model} state={state} patch={patch} mode={mode} />, [model, state, patch, mode]);
  const sheetOpen = narrow && mode !== 'building';
  const sheetTitle = mode === 'block' ? 'Suite' : mode === 'floor' ? 'Floor' : mode === 'find' ? 'Find space' : mode === 'worklist' ? 'Renewal worklist' : mode === 'issues' ? 'Data issues' : 'Area';

  return (
    <div className="sp-app" data-view={state.view} data-mode={mode}>
      <Header model={model} state={state} patch={patch} onExport={onExport} miniTimeline={<MiniTimeline model={model} asOf={state.asOf} onChange={(asOf) => patch({ asOf })} width={312} height={64} />} />
      <SaleBanner property={property} leasable={model.kpis.leasable} />
      <KpiStrip model={model} state={state} onAction={onKpi} />
      <Toolbar state={state} patch={patch} />
      <div className="sp-main sp-no-print">
        <div className="sp-stage">
          {state.view === 'stack' && <StackView model={model} state={state} patch={patch} />}
          {state.view === 'floor' && <FloorView model={model} state={state} patch={patch} />}
          {state.view === 'timeline' && <TimelineView model={model} state={state} patch={patch} />}
          {state.view === 'map' && (
            <section className="sp-card" style={{ padding: 16 }}>
              View “map” arrives shortly.
            </section>
          )}
        </div>
        {!narrow && (
          <aside className="sp-inspector sp-card" aria-label="Inspector">
            {inspector}
          </aside>
        )}
      </div>
      {narrow && (
        <Sheet open={sheetOpen} onClose={() => (mode === 'block' || mode === 'floor' ? clearSelection(patch) : patch({ mode: 'building', req: null, inquiry: null, window: null }))} title={sheetTitle} hideHeader>
          {inspector}
        </Sheet>
      )}
      <PrintLayout model={model} state={state} visible={PRINT_PREVIEW} />
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
