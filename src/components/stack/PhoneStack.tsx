import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { FloorView, Segment } from '../../domain/derive';
import { num, pct } from '../../domain/format';
import { fmtDate } from '../../domain/dates';
import { openFloor, selectSegment } from '../plan/actions';
import { Legend } from '../plan/Legend';
import { spaceOf } from '../building/floorFact';
import type { SegmentText } from '../plan/segmentText';
import { Icon } from '../ui';
import { FilterBar } from './FilterBar';

export interface PhoneStackProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  title: string;
  legendNote: string | null;
  /** Same text the desktop blocks use (lens fact, badges, inquiry fits). */
  textFor: (seg: Segment, floor: FloorView) => SegmentText;
  /** Highlight set in force (finder, search, worklist, rollover bucket or a hover). */
  highlight: Set<string> | null;
}

const badgeText = (b: SegmentText['badges'][number]) => (b.kind === 'deal' ? `${b.text} live deal${b.text === '1' ? '' : 's'}` : b.text);

/**
 * The stacking plan on a phone: one card per floor. A thin bar keeps the proportions (suite width
 * by RSF); under it every suite is a full-width row with its whole name, suite, SF, the lens fact
 * and its badges, so nothing has to shrink to fit a 30 px tile.
 */
export function PhoneStack({ model, state, patch, title, legendNote, textFor, highlight }: PhoneStackProps) {
  const { floors } = model;
  const states = model.legend.filter((i) => i.sf > 0).length;
  return (
    <section className="sp-card sp-stack sp-pstack" aria-label="Stacking plan">
      <div className="sp-stack__head">
        <div className="sp-stack__title">
          <h2>{title}</h2>
          <span className="sp-pstack__asof">as of {fmtDate(model.asOf)}</span>
        </div>
        <details className="sp-pstack__legend">
          <summary>
            Legend · {states} states
            <Icon name="chevron-down" size={14} />
          </summary>
          <Legend items={model.legend} compact id="sp-legend" note={legendNote} />
        </details>
      </div>
      {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <ol className="sp-pstack__floors" aria-label={`${floors.length} floors, top floor first`}>
        {floors.map((f) => {
          const leasedPct = f.leasable ? f.leased / f.leasable : 0;
          const floorNum = f.floor.name.replace(/^Floor\s+/i, '');
          const texts = f.segments.map((seg) => ({ seg, text: textFor(seg, f) }));
          return (
            <li key={f.floor.id} className={`sp-pfloor ${state.floor === f.floor.id ? 'is-open' : ''}`}>
              <button type="button" className="sp-pfloor__head" data-floor={f.floor.id} onClick={() => openFloor(patch, f.floor.id)}>
                <span className="sp-pfloor__num">
                  <span className="sp-sr-only">Floor </span>
                  {floorNum}
                </span>
                <span className="sp-pfloor__facts">
                  <span className="sp-pfloor__pct">{pct(leasedPct)} leased</span>
                  <span>{num(f.leasable)} RSF</span>
                  {f.available > 0 && <span className="sp-pfloor__avail">{spaceOf(f)}</span>}
                </span>
                <span className="sp-sr-only">. Open floor summary</span>
                <Icon name="chevron-right" size={14} />
              </button>
              <div className="sp-pfloor__bar" aria-hidden="true">
                {texts.map(({ seg, text }) => (
                  <span
                    key={seg.key}
                    className={`sp-pbar ${text.pattern ? `sp-pbar--${text.pattern}` : ''} ${state.select === seg.key ? 'is-selected' : ''}`}
                    style={{ flexGrow: Math.max(1, seg.size), backgroundColor: `var(--tone-${text.tone}-fill)`, borderColor: `var(--tone-${text.tone}-edge)`, color: `var(--tone-${text.tone}-edge)` }}
                  />
                ))}
                {f.floor.nonLeasable > 0 && <span className="sp-pbar sp-pbar--lobby" style={{ flexGrow: f.floor.nonLeasable }} />}
              </div>
              <ul className="sp-pfloor__suites">
                {texts.map(({ seg, text }) => {
                  const partial = !!highlight && highlight === model.highlight && !highlight.has(seg.key) && !!model.partial?.has(seg.key);
                  const dim = !!highlight && !highlight.has(seg.key) && !partial;
                  const selected = state.select === seg.key;
                  return (
                    <li key={seg.key}>
                      <button
                        type="button"
                        className={`sp-psuite ${selected ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${partial ? 'is-partial' : ''}`}
                        data-key={seg.key}
                        aria-pressed={selected}
                        onClick={() => selectSegment(patch, seg.key)}
                      >
                        <span
                          className={`sp-psuite__swatch ${text.pattern ? `sp-pbar--${text.pattern}` : ''}`}
                          style={{ backgroundColor: `var(--tone-${text.tone}-fill)`, borderColor: `var(--tone-${text.tone}-edge)`, color: `var(--tone-${text.tone}-edge)` }}
                          aria-hidden="true"
                        />
                        <span className="sp-psuite__main">
                          <span className="sp-sr-only">{f.floor.name}, </span>
                          <span className="sp-psuite__name">{text.name}</span>
                          {/* The facts break between parts only, and a separator neither ends a line nor begins one
                              (base.css, `.sp-dotrun`): "Ste 1250 · 9,300 SF" then "$38–$40/SF/yr FSG" on the next. */}
                          <span className="sp-psuite__facts sp-dotrun">
                            <span className="sp-dotrun__in">
                              {[...text.sub.split(' · '), ...(text.meta ? text.meta.split(' · ') : [])].map((part, i) => (
                                <span key={i} className="sp-dotrun__part sp-psuite__part">
                                  {i > 0 && <span className="sp-dotrun__dot">{' · '}</span>}
                                  {part}
                                </span>
                              ))}
                            </span>
                          </span>
                        </span>
                        {text.badges.length > 0 && (
                          <span className="sp-psuite__badges">
                            {text.badges.slice(0, 3).map((b, i) => (
                              <span key={i} className={`sp-pbadge sp-pbadge--${b.kind}`}>
                                {badgeText(b)}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {f.floor.nonLeasable > 0 && (
                  <li className="sp-psuite sp-psuite--lobby">
                    <span className="sp-psuite__swatch sp-pbar--lobby" aria-hidden="true" />
                    <span className="sp-psuite__main">
                      <span className="sp-psuite__facts">Lobby and building use · {num(f.floor.nonLeasable)} SF · not leasable</span>
                    </span>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="sp-pstack__foot">The bar on each floor is to scale: suite width follows its RSF.</p>
    </section>
  );
}
