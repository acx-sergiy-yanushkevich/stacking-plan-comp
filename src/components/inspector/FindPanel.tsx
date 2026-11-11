import { useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { FitKind, PlanState } from '../../state/planState';
import { addMonths, fmtDate, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import { canShowDeals, canShowInquiries } from '../../domain/safe';
import { Button, Chip, Icon, Segmented, SelectField, TextField } from '../ui';
import { selectSegment, type Patch } from '../plan/actions';
import { Section } from './parts';
import { checkNeededBy, chosenOption, type FitOption, type NearMiss } from '../../domain/finder';
import { setHoverKeys, setPinnedOption } from '../../state/hoverStore';

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

/** Quick "Needed by" dates, in months from the as-of date; 0 is the as-of date itself. */
const BY_PRESETS = [0, 3, 6, 12];

/**
 * A finder row keeps the whole option, not one suite of it: every suite is lit in the plan, the
 * first one opens in the inspector and the inspector lists the rest (`OptionSection`).
 */
function openOption(patch: Patch, row: FitOption | NearMiss) {
  setPinnedOption(chosenOption(row));
  selectSegment(patch, row.keys[0]);
}

export function FindPanel({ model, state, patch }: FindPanelProps) {
  const { safe, asOf, today, property } = model;
  const [hovered, setHovered] = useState<number | null>(null);
  // An inquiry is another prospect's requirement: in prospect-safe mode the panel does not read it at all.
  const inquiry = state.inquiry && canShowInquiries(safe) ? property.inquiries.find((i) => i.id === state.inquiry) ?? null : null;
  const req = model.req;
  const largest = model.fits?.largestNow ?? { size: model.kpis.maxContiguous.size, floorName: model.kpis.maxContiguous.floorName ?? '' };
  const options = model.fits?.options ?? [];
  // Alternatives come from the model, already held to the chosen space type: the list and the plan agree.
  const misses = model.fits?.alternatives ?? [];
  // Needed by. The control is a date input, so its value is always an ISO date and never a string to
  // interpret; what was entered stays in the field as entered. A date before the as-of date is refused
  // with a message (`checkNeededBy`): it is neither applied nor moved to another date. `draft` holds a
  // value that is in the field and not in the requirement (refused, or not a whole date yet).
  const [draft, setDraft] = useState<string | null>(null);
  const [left, setLeft] = useState(false);
  const fromState = checkNeededBy(state.by, asOf);
  const entered = draft !== null ? { value: draft, ...checkNeededBy(draft, asOf) } : { value: state.by ?? '', ...fromState };
  const by = fromState.date ?? inquiry?.neededBy ?? null;
  const setBy = (next: string | null) => {
    setDraft(null);
    patch({ by: next, inquiry: null, req: state.req ?? inquiry?.minSize ?? null, max: state.max ?? inquiry?.maxSize ?? null });
  };
  const onByChange = (value: string) => {
    setLeft(false);
    const next = checkNeededBy(value, asOf);
    if (next.problem) setDraft(value);
    else setBy(next.date);
  };
  const asOfName = asOf === today ? 'today' : 'the as-of date';
  const byProblem =
    entered.problem === 'before'
      ? `${fmtDate(entered.value)} is before the as-of date, ${fmtDate(asOf)}, so it is not applied. Enter ${asOfName} or a later date. ${by ? `The search still uses ${fmtDate(by)}.` : 'The search has no needed-by date.'}`
      : entered.problem === 'incomplete' && left
        ? `That is not a complete date, so it is not applied. ${by ? `The search still uses ${fmtDate(by)}.` : 'The search has no needed-by date.'}`
        : null;

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
              onChange={(e) => patch({ req: numberOrNull(e.target.value), inquiry: null, max: state.max ?? inquiry?.maxSize ?? null, by: state.by ?? inquiry?.neededBy ?? null })}
            />
            <TextField
              label="Max SF"
              kind="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="Optional"
              value={state.max ?? (inquiry ? inquiry.maxSize : '')}
              onChange={(e) => patch({ max: numberOrNull(e.target.value), inquiry: null, req: state.req ?? inquiry?.minSize ?? null, by: state.by ?? inquiry?.neededBy ?? null })}
            />
          </div>
          {inquiry && (
            <p className="sp-ins__note" style={{ margin: '4px 0 8px' }}>
              Based on {canShowInquiries(safe) ? <>the inquiry from <strong>{inquiry.prospect}</strong></> : 'an open inquiry'}: {num(inquiry.minSize)}–{num(inquiry.maxSize)} SF by {fmtDate(inquiry.neededBy)}. Editing a field keeps these values and drops the link.
            </p>
          )}
          <div className="sp-ins__form-row">
            <TextField
              label="Needed by"
              kind="date"
              min={asOf}
              value={draft ?? state.by ?? inquiry?.neededBy ?? ''}
              onChange={(e) => onByChange(e.target.value)}
              onBlur={() => setLeft(true)}
              aria-invalid={byProblem ? true : undefined}
              aria-describedby={byProblem || fromState.date ? 'sp-find-by-note' : undefined}
            />
            <div className="sp-field">
              <span className="sp-field__label" id="sp-find-type">
                Type
              </span>
              <Segmented aria-label="Space type" options={TYPES} value={state.fit} onChange={(fit) => patch({ fit })} />
            </div>
          </div>
          {/* Why an entry was refused; otherwise the date in the field read back with its month in words
              (a typed 11/09 is 11 September or 9 November depending on the browser's locale). */}
          {byProblem ? (
            <p id="sp-find-by-note" className="sp-ins__alert" style={{ margin: 0 }} role="alert">
              <Icon name="warning" size={14} />
              <span>{byProblem}</span>
            </p>
          ) : (
            fromState.date && (
              <p id="sp-find-by-note" className="sp-ins__note" style={{ margin: 0 }}>
                Needed by {fmtDate(fromState.date)}.
              </p>
            )
          )}
          {/* Any exact date can be typed or picked above; these set the common ones in one click. */}
          <div className="sp-ins__chips" role="group" aria-label="Needed by, quick dates">
            <Chip selected={by === null && !byProblem} onClick={() => setBy(null)}>
              Any time
            </Chip>
            {BY_PRESETS.map((months) => {
              const d = addMonths(asOf, months);
              return (
                <Chip key={months} selected={by === d} onClick={() => setBy(d)} title={fmtDate(d)}>
                  {months === 0 ? (asOf === today ? 'Today' : 'As-of date') : `+${months} mo`}
                </Chip>
              );
            })}
          </div>
          {/* The open inquiries are other prospects' requirements: the list is the broker's, not a prospect's. */}
          {canShowInquiries(safe) && (
            <SelectField label="Match an open inquiry" value={state.inquiry ?? ''} onChange={(e) => patch({ inquiry: e.target.value || null, req: null, max: null, by: null })}>
              <option value="">— None —</option>
              {property.inquiries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.prospect}
                </option>
              ))}
            </SelectField>
          )}
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
            <div className="sp-empty__title">{`No ${req.type === 'any' ? '' : `${req.type} `}space fits ${num(req.size)}${req.max ? `–${num(req.max)}` : ''} SF${req.by ? ` by ${fmtDate(req.by)}` : ''}`}</div>
            {/* Only what applies: each suggestion was counted by running the search without that limit (`noFit`).
                The date is never one of them: space that comes later is listed and marked late, not left out. */}
            <p>{model.fits?.noFit?.message}</p>
            {(model.fits?.noFit?.withoutMax ?? 0) > 0 && (
              <Button size="sm" onClick={() => patch({ max: null, inquiry: null, req: req.size, by: req.by })}>
                Remove the maximum
              </Button>
            )}
            {(model.fits?.noFit?.anyType ?? 0) > 0 && (
              <Button size="sm" onClick={() => patch({ fit: 'any' })}>
                Search any type
              </Button>
            )}
            {(model.fits?.noFit?.withoutBoth ?? 0) > 0 && (
              <Button size="sm" onClick={() => patch({ fit: 'any', max: null, inquiry: null, req: req.size, by: req.by })}>
                Remove the maximum and search any type
              </Button>
            )}
          </div>
          <NearMisses misses={misses} patch={patch} max={req.max} selected={state.select} />
        </Section>
      ) : (
        <Section title={`Options · ${options.length}`}>
          <p className="sp-ins__note" style={{ marginTop: 0, marginBottom: 8 }}>
            Ranked: on time first, then sooner, then closest in size.
            {options.length > 0 && options.every((o) => o.from) && ` Nothing this size is available now; the earliest is ${fmtMonthYear(options.map((o) => o.from!).sort()[0])}.`}
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
                    onClick={() => openOption(patch, o)}
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
                      {/* Which space this is: the floor alone does not say. */}
                      <div className="sp-ins__row-suites">{o.suites}</div>
                      <div className="sp-ins__row-meta">
                        <span>{o.type}</span>
                        <span>{when}</span>
                        {o.late && (
                          <Chip tone="warn" icon="clock">
                            late
                          </Chip>
                        )}
                        {o.inquiries > 0 && canShowInquiries(safe) && (
                          <Chip tone="success" icon="inquiry">
                            {o.inquiries === 1 ? '1 inquiry fits' : `${o.inquiries} inquiries fit`}
                          </Chip>
                        )}
                        {o.deals > 0 && canShowDeals(safe) && (
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
        <Section title="Alternatives">
          <p className="sp-ins__note" style={{ marginTop: 0, marginBottom: 8 }}>
            {state.fit === 'any' ? 'Smaller spaces with their shortfall, and stacked floors that combine direct and sublease space.' : `Smaller ${state.fit} spaces with their shortfall, and stacked floors of ${state.fit} space. Choose “Any” to combine direct and sublease space.`}
          </p>
          <NearMisses misses={misses} patch={patch} max={req?.max ?? null} selected={state.select} />
        </Section>
      )}
    </>
  );
}

function NearMisses({ misses, patch, max, selected }: { misses: NearMiss[]; patch: Patch; max: number | null; selected: string | null }) {
  if (!misses.length) return null;
  const light = (m: NearMiss | null) => setHoverKeys(m ? new Set(m.keys) : null);
  return (
    <ul className="sp-ins__list" aria-label="Near misses">
      {misses.map((m) => {
        const isSelected = selected !== null && m.keys.includes(selected);
        return (
          <li key={m.keys.join('+')}>
            <button
              type="button"
              className={`sp-ins__row ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => openOption(patch, m)}
              onMouseEnter={() => light(m)}
              onMouseLeave={() => light(null)}
              onFocus={() => light(m)}
              onBlur={() => light(null)}
            >
              <div className="sp-ins__row-main">
                <div className="sp-ins__row-title">
                  <span>{m.floorName}</span>
                  {m.kind === 'stack' && <span className="sp-ins__tag">stacked floors</span>}
                </div>
                <div className="sp-ins__row-suites">{m.suites}</div>
                <div className="sp-ins__row-meta">
                  <span>{m.type}</span>
                  <span>{m.from ? fmtMonthYear(m.from) : 'Now'}</span>
                  {m.shortfall > 0 && <span>{num(m.shortfall)} SF short</span>}
                  {max !== null && m.size > max && <span>{num(m.size - max)} SF over max</span>}
                  {m.kind === 'stack' && <span>{plural(m.keys.length, 'suite')} on two floors</span>}
                </div>
              </div>
              <div className="sp-ins__row-end">
                <span className="sp-ins__row-value">{sf(m.size)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
