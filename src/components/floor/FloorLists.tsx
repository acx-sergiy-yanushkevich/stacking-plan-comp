import { useState } from 'react';
import type { FloorView } from '../../domain/derive';
import { fmtDate } from '../../domain/dates';
import { num, sf } from '../../domain/format';
import type { Issue } from '../../domain/issues';
import { stageRank } from '../../domain/lenses';
import { canShowDeals, canShowInquiries, canShowIssues } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { useRecordAction } from '../inspector/Actions';
import { selectSegment, type Patch } from '../plan/actions';
import { segmentText } from '../plan/segmentText';
import { Button, Icon, Segmented } from '../ui';
import { fittingInquiries, floorDeals, floorIssues, type FloorDeal, type FloorInquiry } from './floorData';

export interface FloorListsProps {
  floor: FloorView;
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

type Tab = 'suites' | 'deals' | 'inquiries' | 'issues';

const SEVERITY_ICON: Record<Issue['severity'], 'warning' | 'info'> = { error: 'warning', warning: 'warning', info: 'info' };

/** Tabbed lists under the floor KPIs: Suites, Deals, Inquiries that fit, Issues on this floor. */
export function FloorLists({ floor, model, state, patch }: FloorListsProps) {
  const [chosen, setTab] = useState<Tab>('suites');
  const { safe, asOf, property } = model;

  // Each list arrives already passed through the prospect-safe policy (empty when withheld), and a
  // withheld list has no tab either: its count alone would say something.
  const deals = floorDeals(floor, safe);
  const inquiries = fittingInquiries(floor, property.inquiries, asOf, safe);
  const issues = floorIssues(model.issues, floor.floor.id, safe);

  const options: Array<{ id: Tab; label: string }> = [
    { id: 'suites', label: `Suites (${num(floor.segments.length)})` },
    ...(canShowDeals(safe) ? [{ id: 'deals' as const, label: `Deals (${num(deals.length)})` }] : []),
    ...(canShowInquiries(safe) ? [{ id: 'inquiries' as const, label: `Inquiries (${num(inquiries.length)})` }] : []),
    ...(canShowIssues(safe) ? [{ id: 'issues' as const, label: `Issues (${num(issues.length)})` }] : []),
  ];
  // A tab chosen before prospect-safe was switched on falls back to the suites.
  const tab: Tab = options.some((o) => o.id === chosen) ? chosen : 'suites';

  return (
    <section className="sp-flists" aria-label={`${floor.floor.name} lists`}>
      {options.length > 1 && <Segmented aria-label="Floor lists" options={options} value={tab} onChange={setTab} className="sp-flists__tabs" />}
      {tab === 'suites' && <SuiteRows floor={floor} model={model} state={state} patch={patch} />}
      {tab === 'deals' && <DealRows deals={deals} floorName={floor.floor.name} patch={patch} />}
      {tab === 'inquiries' && <InquiryRows inquiries={inquiries} floorName={floor.floor.name} activeId={state.inquiry} patch={patch} />}
      {tab === 'issues' && <IssueRows issues={issues} patch={patch} />}
    </section>
  );
}

function SuiteRows({ floor, model, state, patch }: FloorListsProps) {
  return (
    <ul className="sp-flist" aria-label="Suites">
      {floor.segments.map((seg) => {
        const t = segmentText(seg, { safe: model.safe, asOf: model.asOf, lens: state.lens, floorName: floor.floor.name });
        const selected = state.select === seg.key;
        return (
          <li key={seg.key}>
            <button type="button" className={`sp-flist__row ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => selectSegment(patch, seg.key)}>
              <span className="sp-flist__swatch" style={{ background: `var(--tone-${t.tone}-fill)`, borderColor: `var(--tone-${t.tone}-edge)` }} aria-hidden="true" />
              <span className="sp-flist__body">
                <span className="sp-flist__primary">{t.name}</span>
                <span className="sp-flist__secondary">{t.sub}</span>
                {t.meta && <span className="sp-flist__tertiary">{t.meta}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Live deals on the floor (from `floorDeals`, so never in prospect-safe mode): the row shows the suite, the link opens the deal. */
export function DealRows({ deals, floorName, patch }: { deals: FloorDeal[]; floorName: string; patch: Patch }) {
  const run = useRecordAction();
  if (deals.length === 0) return <p className="sp-flist__empty">No live deals on this floor.</p>;
  return (
    <ul className="sp-flist" aria-label="Deals">
      {deals.map(({ deal, seg }) => {
        const rank = stageRank(deal.stage);
        return (
          <li key={deal.id} className="sp-flist__item">
            <button type="button" className="sp-flist__row" title="Show the suite this deal is on" onClick={() => selectSegment(patch, seg.key)}>
              <span className="sp-flist__stage" style={{ background: `var(--tone-deal-${rank}-fill)`, color: `var(--tone-deal-${rank}-text)`, borderColor: `var(--tone-deal-${rank}-edge)` }}>
                {deal.stage}
              </span>
              <span className="sp-flist__body">
                <span className="sp-flist__primary">
                  {deal.prospect}
                  {deal.kind === 'Renewal' ? ' · renewal' : ''}
                </span>
                <span className="sp-flist__secondary">
                  {sf(deal.size)} · {seg.suite ? `Ste ${seg.suite}` : floorName}
                </span>
                <span className="sp-flist__tertiary">
                  {deal.broker} · updated {fmtDate(deal.updated)}
                </span>
              </span>
            </button>
            <Button
              size="sm"
              variant="ghost"
              iconRight="external"
              className="sp-flist__open"
              aria-label={`Open record: ${deal.prospect} deal, ${deal.stage}`}
              onClick={() => run('open-deal', `Deal ${deal.id} (${deal.prospect})`)}
            >
              Open record
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Open inquiries the floor's space fits (from `fittingInquiries`, so never in prospect-safe mode): the row highlights the space, the link opens the inquiry. */
export function InquiryRows({ inquiries, floorName, activeId, patch }: { inquiries: FloorInquiry[]; floorName: string; activeId: string | null; patch: Patch }) {
  const run = useRecordAction();
  if (inquiries.length === 0) return <p className="sp-flist__empty">No open inquiry fits the space on this floor.</p>;
  return (
    <ul className="sp-flist" aria-label="Inquiries that fit">
      {inquiries.map(({ inquiry, segs }) => {
        const active = activeId === inquiry.id;
        return (
          <li key={inquiry.id} className="sp-flist__item">
            <button
              type="button"
              className={`sp-flist__row ${active ? 'is-selected' : ''}`}
              aria-pressed={active}
              title="Highlight the space this inquiry fits"
              onClick={() => patch({ inquiry: active ? null : inquiry.id, req: null, max: null, by: null, select: null })}
            >
              <Icon name="inquiry" size={16} className="sp-flist__icon" />
              <span className="sp-flist__body">
                <span className="sp-flist__primary">{inquiry.prospect}</span>
                <span className="sp-flist__secondary">
                  {num(inquiry.minSize)}–{num(inquiry.maxSize)} SF · needed by {fmtDate(inquiry.neededBy)}
                </span>
                <span className="sp-flist__tertiary">
                  {inquiry.source} · fits {segs.map((s) => (s.suite ? `Ste ${s.suite}` : floorName)).join(', ')}
                </span>
              </span>
            </button>
            <Button
              size="sm"
              variant="ghost"
              iconRight="external"
              className="sp-flist__open"
              aria-label={`Open record: ${inquiry.prospect} inquiry`}
              onClick={() => run('open-inquiry', `Inquiry ${inquiry.id} (${inquiry.prospect})`)}
            >
              Open record
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function IssueRows({ issues, patch }: { issues: Issue[]; patch: Patch }) {
  if (issues.length === 0) return <p className="sp-flist__empty">No data issues on this floor.</p>;
  return (
    <ul className="sp-flist" aria-label="Issues on this floor">
      {issues.map((issue) => (
        <li key={issue.id}>
          <button type="button" className="sp-flist__row" onClick={() => (issue.segKey ? selectSegment(patch, issue.segKey) : patch({ mode: 'issues', select: null }))}>
            <Icon name={SEVERITY_ICON[issue.severity]} size={16} className={`sp-flist__icon sp-sev--${issue.severity}`} label={issue.severity} />
            <span className="sp-flist__body">
              <span className="sp-flist__primary">{issue.title}</span>
              <span className="sp-flist__secondary">{issue.detail}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
