import { useCallback, useEffect } from 'react';
import { property, TODAY } from './data/mock/property';
import { usePlanModel } from './model/usePlanModel';
import { usePlanState, useDocumentTitle } from './state/usePlanState';
import { deriveMode } from './state/planState';
import { Header, type ExportKind } from './components/shell/Header';
import { SaleBanner } from './components/shell/SaleBanner';
import { Toolbar } from './components/shell/Toolbar';
import { KpiStrip, type KpiAction } from './components/kpis/KpiStrip';
import { ToastProvider, useToast } from './components/ui';
import './components/ui/ui.css';
import './components/shell/shell.css';
import './components/kpis/kpis.css';

function Shell() {
  const [state, patch] = usePlanState(TODAY);
  const model = usePlanModel(property, state, TODAY);
  const toast = useToast();
  useDocumentTitle(state.safe);
  const mode = deriveMode(state);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme ?? '';
  }, [state.theme]);

  const onExport = useCallback(
    (kind: ExportKind) => {
      if (kind === 'link') {
        navigator.clipboard?.writeText(location.href);
        toast.push('Link copied', { icon: 'link' });
        return;
      }
      toast.push(`Export (${kind}) arrives in Task 19`, { icon: 'download' });
    },
    [toast],
  );

  const onKpi = (a: KpiAction) => {
    switch (a) {
      case 'status':
        patch({ lens: 'status', mode: 'building', select: null, q: '', window: null, req: null, inquiry: null });
        break;
      case 'find':
        patch({ mode: 'find', select: null, floor: null, window: null });
        break;
      case 'find-largest':
        patch({ mode: 'find', req: model.kpis.maxContiguous.size, max: null, by: null, select: null, floor: null, window: null });
        break;
      case 'expiry-worklist':
        patch({ lens: 'expiry', mode: 'worklist', window: '12', select: null, floor: null, req: null, inquiry: null });
        break;
      case 'timeline':
        patch({ view: 'timeline' });
        break;
      case 'deals':
        patch({ lens: 'deals', mode: 'building', select: null, window: null, req: null, inquiry: null });
        break;
    }
  };

  return (
    <div className="sp-app" data-view={state.view} data-mode={mode}>
      <Header model={model} state={state} patch={patch} onExport={onExport} />
      <SaleBanner property={property} leasable={model.kpis.leasable} />
      <KpiStrip model={model} state={state} onAction={onKpi} />
      <Toolbar state={state} patch={patch} />
      <div className="sp-main">
        <section className="sp-stage sp-card" aria-label="Plan">
          <p style={{ padding: 16 }}>View “{state.view}” arrives in Tasks 13–18.</p>
        </section>
        <aside className="sp-inspector sp-card" aria-label="Inspector">
          <p style={{ padding: 16 }}>Inspector ({mode}) arrives in Task 14.</p>
        </aside>
      </div>
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
