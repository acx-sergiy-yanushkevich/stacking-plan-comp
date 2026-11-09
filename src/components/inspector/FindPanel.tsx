import { useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { FitKind, PlanState } from '../../state/planState';
import { addMonths, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import { prospectLabel } from '../../domain/safe';
import { Button, Chip, Icon, Segmented, SelectField, TextField } from '../ui';
import { selectSegment, type Patch } from '../plan/actions';
import { Section } from './parts';
import { nearMisses } from '../../domain/finder';
import { setHoverKeys } from '../../state/hoverStore';

export interface FindPanelProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

const QUICK = [5000, 10000, 20000];
const TYPES: Array<{ id: FitKind; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'direct', label: 'Direct' },
  { id: 'sublease', label: 'Sublease' },
];

export function FindPanel({ model, state, patch }: FindPanelProps) {
  const { safe, asOf, property } = model;
  const [hovered, setHovered] = useState<number | null>(null);
  const inquiry = state.inquiry ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = model.req;
  const largest = model.fits?.largestNow ?? { size: model.kpis.maxContiguous.size, floorName: model.kpis.maxContiguous.floorName ?? '' };
  const options = model.fits?.options ?? [];
  const misses = req && options.length < 3 ? nearMisses(model.floors, req.size, asOf) : [];

  const numberOrNull = (v: string) => {
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
  };
  const clear = () => patch({ req: null, max: null, by: null, inquiry: null, fit: 'any' });

  return (
    <>
      <Section title="Requirement" aside={req ? <Button size="sm" variant="ghost" icon="close" onClick={clear}>Clear</Button> : undefined}>
        <div className="sp-ins__form">
          <div className="sp-ins__form-row">
            <TextField
              label="Need SF"
              kind="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="e.g. 12,000"
              value={state.req ?? (inquiry ? inquiry.minSize : '')}
              onChange={(e) => patch({ req: numberOrNull(e.target.value), inquiry: null })}
            />
            <TextField
              label="Max SF"
              kind="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="Optional"
              value={state.max ?? (inquiry ? inquiry.maxSize : '')}
              onChange={(e) => patch({ max: numberOrNull(e.target.value), inquiry: null, req: state.req ?? inquiry?.minSize ?? null })}
            />
          </div>
          <div className="sp-ins__form-row">
            <TextField label="By date" kind="date" value={state.by ?? inquiry?.neededBy ?? ''} min={asOf} onChange={(e) => patch({ by: e.target.value || null, inquiry: null, req: state.req ?? inquiry?.minSize ?? null })} />
            <div className="sp-field">
              <span className="sp-field__label" id="sp-find-type">
                Type
              </span>
              <Segmented aria-label="Space type" options={TYPES} value={state.fit} onChange={(fit) => patch({ fit })} />
            </div>
          </div>
          <SelectField label="Match an open inquiry" value={state.inquiry ?? ''} onChange={(e) => patch({ inquiry: e.target.value || null, req: null, max: null, by: null })}>
            <option value="">— None —</option>
            {property.inquiries.map((i) => (
              <option key={i.id} value={i.id}>
                {prospectLabel(i, safe)}
                {safe ? ` (${i.id})` : ''} · {num(i.minSize)}–{num(i.maxSize)} SF · by {fmtMonthYear(i.neededBy)}
              </option>
            ))}
          </SelectField>
          <p className="sp-ins__largest">
            Largest block now: <strong>{largest.size > 0 ? sf(largest.size) : '—'}</strong>
            {largest.size > 0 && largest.floorName ? ` on ${largest.floorName}` : ''}
          </p>
        </div>
      </Section>

      {!req ? (
        <Section title="Options">
          <p className="sp-ins__explain">Enter a requirement to rank every space that fits: single suites, contiguous runs, space marketed for later and two-floor combinations. Matching blocks light up in the plan.</p>
          <div className="sp-ins__chips" style={{ marginTop: 12 }}>
            {QUICK.map((q) => (
              <Chip key={q} onClick={() => patch({ req: q, inquiry: null })} icon="filter">
                {num(q)} SF
              </Chip>
            ))}
          </div>
        </Section>
      ) : options.length === 0 ? (
        <Section title="Options">
          <div className="sp-empty">
            <Icon name="search" size={24} />
            <div className="sp-empty__title">{`No space fits ${num(req.size)}${req.max ? `–${num(req.max)}` : ''} SF${req.by ? ` by ${fmtMonthYear(req.by)}` : ''}`}</div>
            <p>Raise the maximum, drop the type filter or move the date to include space marketed for later.</p>
            <Button size="sm" onClick={() => patch({ by: addMonths(req.by ?? asOf, 12), inquiry: null, req: req.size, max: req.max })}>
              Try 12 months later
            </Button>
          </div>
          <NearMisses misses={misses} patch={patch} />
        </Section>
      ) : (
        <Section title={`Options · ${options.length}`}>
          <p className="sp-ins__note" style={{ marginTop: 0, marginBottom: 8 }}>
            Ranked: on time first, then sooner, then closest in size.
          </p>
          <ul className="sp-ins__list">
            {options.map((o, i) => {
              const selected = state.select !== null && o.keys.includes(state.select);
              const when = o.from ? fmtMonthYear(o.from) : 'Now';
              return (
                <li key={`${o.keys.join('+')}-${i}`}>
                  <button
                    type="button"
                    className={`sp-ins__row ${hovered === i ? 'is-hover' : ''} ${selected ? 'is-selected' : ''}`}
                    onClick={() => selectSegment(patch, o.keys[0])}
                    onMouseEnter={() => {
                      setHovered(i);
                      setHoverKeys(new Set(o.keys));
                    }}
                    onMouseLeave={() => {
                      setHovered(null);
                      setHoverKeys(null);
                    }}
                    onFocus={() => {
                      setHovered(i);
                      setHoverKeys(new Set(o.keys));
                    }}
                    onBlur={() => {
                      setHovered(null);
                      setHoverKeys(null);
                    }}
                    aria-pressed={selected}
                  >
                    <div className="sp-ins__row-main">
                      <div className="sp-ins__row-title">
                        <span>{o.floorName}</span>
                        {o.multiFloor && <span className="sp-ins__tag">two floors</span>}
                        {o.contiguous && <span className="sp-ins__tag">contiguous</span>}
                        {o.notMarketed && <span className="sp-ins__tag">not marketed</span>}
                      </div>
                      <div className="sp-ins__row-meta">
                        <span>{o.type}</span>
                        <span>· {when}</span>
                        {o.late && (
                          <Chip tone="warn" icon="clock">
                            late
                          </Chip>
                        )}
                        {o.inquiries > 0 && (
                          <Chip tone="success" icon="inquiry">
                            {o.inquiries === 1 ? '1 inquiry fits' : `${o.inquiries} inquiries fit`}
                          </Chip>
                        )}
                        {o.deals > 0 && !safe && (
                          <Chip tone="brand" icon="deal">
                            {plural(o.deals, 'live deal')}
                          </Chip>
                        )}
                      </div>
                    </div>
                    <div className="sp-ins__row-end">
                      <span className="sp-ins__row-value">{sf(o.size)}</span>
                      {o.splitTo && <span className="sp-ins__row-sub">split to {num(o.splitTo)}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {options.length > 0 && misses.length > 0 && (
        <Section title="Near misses">
          <NearMisses misses={misses} patch={patch} />
        </Section>
      )}
    </>
  );
}

function NearMisses({ misses, patch }: { misses: ReturnType<typeof nearMisses>; patch: Patch }) {
  if (!misses.length) return null;
  return (
    <ul className="sp-ins__list" aria-label="Near misses">
      {misses.map((m) => (
        <li key={m.keys.join('+')}>
          <button type="button" className="sp-ins__row" onClick={() => selectSegment(patch, m.keys[0])}>
            <div className="sp-ins__row-main">
              <div className="sp-ins__row-title">
                <span>{m.floorName}</span>
                {m.kind === 'stack' && <span className="sp-ins__tag">stacked floors</span>}
              </div>
              <div className="sp-ins__row-meta">
                <span>{m.type}</span>
                <span>· {m.from ? fmtMonthYear(m.from) : 'Now'}</span>
                {m.shortfall > 0 && <span>· {num(m.shortfall)} SF short</span>}
              </div>
            </div>
            <div className="sp-ins__row-end">
              <span className="sp-ins__row-value">{sf(m.size)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
