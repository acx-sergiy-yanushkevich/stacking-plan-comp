import { useState } from 'react';
import type { FloorView } from '../../domain/derive';
import { fmtDate } from '../../domain/dates';
import { num, sf } from '../../domain/format';
import type { Issue } from '../../domain/issues';
import { stageRank } from '../../domain/lenses';
import { prospectLabel } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { selectSegment, type Patch } from '../plan/actions';
import { segmentText } from '../plan/segmentText';
import { Icon, Segmented } from '../ui';
import { fittingInquiries, issueTitle, liveDeals } from './floorData';

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
  const [tab, setTab] = useState<Tab>('suites');
  const { safe, asOf, property } = model;
  const floorId = floor.floor.id;

  const deals = liveDeals(floor);
  const inquiries = fittingInquiries(floor, property.inquiries, asOf);
  const issues = model.issues.filter((i) => i.floorId === floorId);

  const options: Array<{ id: Tab; label: string }> = [
    { id: 'suites', label: `Suites (${num(floor.segments.length)})` },
    { id: 'deals', label: `Deals (${num(deals.length)})` },
    { id: 'inquiries', label: `Inquiries (${num(inquiries.length)})` },
    { id: 'issues', label: `Issues (${num(issues.length)})` },
  ];

  return (
    <section className="sp-flists" aria-label={`${floor.floor.name} lists`}>
      <Segmented aria-label="Floor lists" options={options} value={tab} onChange={setTab} className="sp-flists__tabs" />

      {tab === 'suites' && (
        <ul className="sp-flist" aria-label="Suites">
          {floor.segments.map((seg) => {
            const t = segmentText(seg, { safe, asOf, lens: state.lens, floorName: floor.floor.name });
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
      )}

      {tab === 'deals' &&
        (deals.length === 0 ? (
          <p className="sp-flist__empty">No live deals on this floor.</p>
        ) : (
          <ul className="sp-flist" aria-label="Deals">
            {deals.map(({ deal, seg }) => {
              const rank = stageRank(deal.stage);
              return (
                <li key={deal.id}>
                  <button type="button" className="sp-flist__row" onClick={() => selectSegment(patch, seg.key)}>
                    <span
                      className="sp-flist__stage"
                      style={{ background: `var(--tone-deal-${rank}-fill)`, color: `var(--tone-deal-${rank}-text)`, borderColor: `var(--tone-deal-${rank}-edge)` }}
                    >
                      {deal.stage}
                    </span>
                    <span className="sp-flist__body">
                      <span className="sp-flist__primary">
                        {prospectLabel(deal, safe)}
                        {deal.kind === 'Renewal' ? ' · renewal' : ''}
                      </span>
                      <span className="sp-flist__secondary">
                        {sf(deal.size)} · {seg.suite ? `Ste ${seg.suite}` : floor.floor.name}
                      </span>
                      <span className="sp-flist__tertiary">
                        {deal.broker} · updated {fmtDate(deal.updated)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'inquiries' &&
        (inquiries.length === 0 ? (
          <p className="sp-flist__empty">No open inquiry fits the space on this floor.</p>
        ) : (
          <ul className="sp-flist" aria-label="Inquiries that fit">
            {inquiries.map(({ inquiry, segs }) => {
              const active = state.inquiry === inquiry.id;
              return (
                <li key={inquiry.id}>
                  <button
                    type="button"
                    className={`sp-flist__row ${active ? 'is-selected' : ''}`}
                    aria-pressed={active}
                    title="Highlight the space this inquiry fits"
                    onClick={() => patch({ inquiry: active ? null : inquiry.id, req: null, max: null, by: null, select: null })}
                  >
                    <Icon name="inquiry" size={16} className="sp-flist__icon" />
                    <span className="sp-flist__body">
                      <span className="sp-flist__primary">{prospectLabel(inquiry, safe)}</span>
                      <span className="sp-flist__secondary">
                        {num(inquiry.minSize)}–{num(inquiry.maxSize)} SF · needed by {fmtDate(inquiry.neededBy)}
                      </span>
                      <span className="sp-flist__tertiary">
                        {inquiry.source} · fits {segs.map((s) => (s.suite ? `Ste ${s.suite}` : floor.floor.name)).join(', ')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'issues' &&
        (issues.length === 0 ? (
          <p className="sp-flist__empty">No data issues on this floor.</p>
        ) : (
          <ul className="sp-flist" aria-label="Issues on this floor">
            {issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  className="sp-flist__row"
                  onClick={() => (issue.segKey ? selectSegment(patch, issue.segKey) : patch({ mode: 'issues', select: null }))}
                >
                  <Icon name={SEVERITY_ICON[issue.severity]} size={16} className={`sp-flist__icon sp-sev--${issue.severity}`} label={issue.severity} />
                  <span className="sp-flist__body">
                    <span className="sp-flist__primary">{issueTitle(issue, safe)}</span>
                    {!safe && <span className="sp-flist__secondary">{issue.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
