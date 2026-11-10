import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { blockLayout } from '../../domain/layout';
import { num, pct } from '../../domain/format';
import { fmtDate } from '../../domain/dates';
import { matchingInquiries } from '../../domain/finder';
import { useIsPhone } from '../../lib/useMedia';
import { useHoverKeys, usePinnedKeys, setPinnedKeys, setHoverFloor, useHoverFloor } from '../../state/hoverStore';
import type { FloorView, Segment } from '../../domain/derive';
import { PhoneStack } from './PhoneStack';
import { focusFacts } from '../plan/focusFacts';
import { useWidth } from '../../lib/useWidth';
import { clearSelection, openFloor, selectSegment } from '../plan/actions';
import { Legend } from '../plan/Legend';
import { segmentText } from '../plan/segmentText';
import { Block } from './Block';
import { FilterBar } from './FilterBar';
import '../plan/plan.css';
import './stack.css';

export interface StackViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  /** Hide the card chrome (legend, header) when embedded in the print layout. */
  bare?: boolean;
  /** Row height override (print uses a shorter row). */
  rowHeight?: number;
}

const ROW_GAP = 6;
const MIN_BLOCK = 56;
const MIN_BLOCK_PHONE = 64;
/** Desktop and print: no suite is drawn narrower than this, so every block can carry its name, SF and lens fact. */
const MIN_BLOCK_DESKTOP = 124;
/** A focused floor: taller row at full width, with a wider minimum per suite. */
const FOCUS_H = 132;
const MIN_BLOCK_FOCUS = 156;

const segIndexLease = (idx: Map<string, { lease?: { id: string } }>, key: string) => idx.get(key)?.lease?.id ?? null;

export default function StackView({ model, state, patch, bare, rowHeight }: StackViewProps) {
  const phone = useIsPhone();
  const [ref, width] = useWidth<HTMLDivElement>(1040);
  const rowH = rowHeight ?? (phone ? 56 : 72);
  const selectedLease = state.select ? segIndexLease(model.segIndex, state.select) : null;
  const gutter = phone ? 44 : 124;
  const planPx = Math.max(240, width - gutter - 8);
  const hoverKeys = useHoverKeys();
  const pinnedKeys = usePinnedKeys();
  useEffect(() => {
    if (!model.fits) setPinnedKeys(null);
  }, [model.fits]);
  const { floors, segIndex } = model;
  const highlight = hoverKeys ?? model.highlight;

  /** Facts a focused floor adds to a suite (term, rent, deal), never one that is already drawn. */
  const extrasFor = useCallback(
    (seg: Segment, f: FloorView) => focusFacts(seg, state.lens, { safe: state.safe, asOf: model.asOf, today: model.today, floorName: f.floor.name }),
    [state.lens, state.safe, model.asOf, model.today],
  );

  // The focused floor: the one whose summary is open, or the floor of the selected suite. Its row grows
  // to full width and height so every suite on it is readable; rows above it do not move.
  const focusId = !bare && !phone ? (state.floor ?? (state.select ? (segIndex.get(state.select)?.floorId ?? null) : null)) : null;

  // Row width follows gross floor area (so the podium reads as the widest plate); the
  // non-leasable part is drawn as a muted block on the right and never counted.
  const rows = useMemo(() => {
    const maxSize = Math.max(...floors.map((f) => f.floor.size));
    let y = 0;
    return floors.map((f) => {
      const focused = f.floor.id === focusId;
      // A focused row grows only by the lines it gains; a floor with nothing to add keeps its size.
      const extraMax = focused ? Math.max(0, ...f.segments.map((sg) => extrasFor(sg, f).length)) : 0;
      const multi = f.segments.length > 1;
      const h = focused && extraMax > 0 ? Math.min(FOCUS_H, Math.max(rowH, 13 + 15 * (4 + extraMax))) : rowH;
      const share = focused && multi ? 1 : Math.max(0.6, f.floor.size / maxSize);
      const fw = Math.round(planPx * share);
      const minBlock = phone ? MIN_BLOCK_PHONE : focused && multi ? MIN_BLOCK_FOCUS : MIN_BLOCK_DESKTOP;
      const nonLeasablePx = f.floor.nonLeasable > 0 ? Math.max(MIN_BLOCK, Math.round((fw * f.floor.nonLeasable) / f.floor.size)) : 0;
      const leasablePx = fw - nonLeasablePx - (nonLeasablePx ? 2 : 0);
      const boxes = blockLayout(f.segments, leasablePx, minBlock, 2);
      const row = { f, y, h, focused, w: fw, boxes, nonLeasablePx, leasablePx };
      y += h + ROW_GAP;
      return row;
    });
  }, [floors, planPx, rowH, phone, focusId, extrasFor]);
  const anyEnlarged = rows.some((r) => r.boxes.some((b) => b.enlarged));
  const lastRow = rows[rows.length - 1];
  const height = lastRow ? lastRow.y + lastRow.h + 2 : 0;

  // Inquiry-fit badges while the finder is active
  const matchCount = useCallback(
    (key: string) => {
      if (!model.req || state.safe) return undefined;
      const s = segIndex.get(key);
      const a = s?.availability ?? s?.marketed;
      if (!s || !a || (s.kind !== 'available' && s.kind !== 'sublease' && !s.marketed)) return undefined;
      // While one inquiry is being matched, only its own fits are marked.
      const pool = state.inquiry ? model.property.inquiries.filter((i) => i.id === state.inquiry) : model.property.inquiries;
      const n = matchingInquiries(pool, { size: a.size, divisible: a.divisible, minDivisible: a.minDivisible, from: a.availableFrom }, model.asOf).length;
      return n || undefined;
    },
    [model.req, model.property.inquiries, model.asOf, segIndex, state.safe, state.inquiry],
  );

  const textFor = useCallback(
    (seg: Segment, f: FloorView) => {
      const reason = model.searchReasons?.get(seg.key);
      return segmentText(seg, { safe: state.safe, asOf: model.asOf, today: model.today, lens: state.lens, floorName: f.floor.name, matches: matchCount(seg.key), matchLabel: state.inquiry ? 'Fits this inquiry' : undefined, matchReason: reason && reason !== 'Tenant' && !reason.startsWith('Suite') && !reason.startsWith('Floor') ? reason : undefined });
    },
    [model.searchReasons, model.asOf, model.today, state.safe, state.lens, state.inquiry, matchCount],
  );
  const hoverFloor = useHoverFloor();

  // Focus changes row heights. When it follows a click in the plan, scroll by the same amount so the
  // row under the pointer does not move.
  const anchor = useRef<{ id: string; top: number; at: number } | null>(null);
  const onPointerDownCapture = (e: PointerEvent<SVGSVGElement>) => {
    const row = (e.target as Element).closest?.('[data-row]');
    anchor.current = row ? { id: row.getAttribute('data-row')!, top: row.getBoundingClientRect().top, at: Date.now() } : null;
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || Date.now() - a.at > 1500 || !svgRef.current) return;
    const el = svgRef.current.querySelector(`[data-row="${CSS.escape(a.id)}"]`);
    const d = el ? el.getBoundingClientRect().top - a.top : 0;
    if (Math.abs(d) > 1) window.scrollBy(0, d);
  }, [focusId]);

  // Roving tabindex across the grid
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const firstKey = rows[0]?.boxes[0]?.key ?? null;
  const activeKey = focusKey && segIndex.has(focusKey) ? focusKey : state.select && segIndex.has(state.select) ? state.select : firstKey;

  const focusBlock = useCallback((key: string) => {
    setFocusKey(key);
    requestAnimationFrame(() => {
      const el = svgRef.current?.querySelector<SVGGElement>(`[data-key="${CSS.escape(key)}"]`);
      el?.focus();
    });
  }, []);

  const onKeyDown = (e: KeyboardEvent<SVGGElement>, rowIdx: number, boxIdx: number) => {
    const row = rows[rowIdx];
    const box = row.boxes[boxIdx];
    const cx = box.x + box.w / 2;
    const nearest = (r: (typeof rows)[number]) => r.boxes.reduce((best, b) => (Math.abs(b.x + b.w / 2 - cx) < Math.abs(best.x + best.w / 2 - cx) ? b : best), r.boxes[0]);
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = row.boxes[Math.min(boxIdx + 1, row.boxes.length - 1)].key;
        break;
      case 'ArrowLeft':
        if (boxIdx === 0) {
          e.preventDefault();
          svgRef.current?.querySelector<SVGGElement>(`[data-floor="${row.f.floor.id}"]`)?.focus();
          return;
        }
        next = row.boxes[boxIdx - 1].key;
        break;
      case 'ArrowDown':
        if (rowIdx < rows.length - 1) next = nearest(rows[rowIdx + 1]).key;
        break;
      case 'ArrowUp':
        if (rowIdx > 0) next = nearest(rows[rowIdx - 1]).key;
        break;
      case 'Home':
        next = e.ctrlKey || e.metaKey ? rows[0].boxes[0].key : row.boxes[0].key;
        break;
      case 'End':
        next = e.ctrlKey || e.metaKey ? rows[rows.length - 1].boxes.at(-1)!.key : row.boxes.at(-1)!.key;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectSegment(patch, box.key);
        return;
      case 'Escape':
        if (state.select) {
          e.preventDefault();
          clearSelection(patch);
        } else if (state.floor) {
          e.preventDefault();
          patch({ floor: null, mode: 'building' });
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    if (next) focusBlock(next);
  };

  // Keep focus on the selected block when selection changes from elsewhere (worklist, finder)
  useEffect(() => {
    if (state.select && segIndex.has(state.select)) {
      setFocusKey(state.select);
      // With the bottom sheet open (narrow layouts), keep the chosen block in view above it.
      // (Deferred: on a deep link the sheet and the rows are not laid out yet.)
      const key = state.select;
      if (typeof window !== 'undefined' && window.innerWidth < 1100) window.setTimeout(() => document.querySelector<SVGGElement>(`.sp-stage [data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    }
  }, [state.select, segIndex]);

  const over = state.safe ? [] : floors.filter((f) => f.overAllocatedBy > 0);
  const legendNote = [
    anyEnlarged ? `Small suites are drawn at a minimum width for legibility; other suites on that floor shrink to compensate.` : '',
    rows.some((r) => r.focused && r.f.segments.length > 1) ? 'The focused floor is drawn at full width.' : '',
    over.length ? `${over.map((f) => `${f.floor.name} records exceed its leasable area by ${num(f.overAllocatedBy)} SF`).join('; ')}; legend shares use recorded SF.` : '',
  ]
    .filter(Boolean)
    .join(' ') || null;
  const totalLeasable = model.kpis.leasable;
  const title = state.lens === 'status' ? 'Occupancy' : state.lens === 'expiry' ? 'Expirations' : state.lens === 'deals' ? 'Deal pipeline' : 'Rents';

  // Phones get floor cards with full-width suite rows instead of a squeezed stack.
  if (phone && !bare) return <PhoneStack model={model} state={state} patch={patch} title={title} legendNote={legendNote} textFor={textFor} highlight={highlight} />;

  return (
    <section className={`sp-card sp-stack ${bare ? 'sp-stack--bare' : ''}`} aria-label="Stacking plan">
      {!bare && (
        <div className="sp-stack__head">
          <div className="sp-stack__title">
            <h2>{title}</h2>
            <span className="sp-weak">
              as of {fmtDate(model.asOf)} · {num(totalLeasable)} RSF leasable
            </span>
          </div>
          <Legend items={model.legend} compact id="sp-legend" note={legendNote} />
        </div>
      )}
      {!bare && model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} patch={patch} />}
      <div className="sp-stack__body" ref={ref}>
        <svg
          ref={svgRef}
          onPointerDownCapture={onPointerDownCapture}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="grid"
          aria-label={`Stacking plan, ${rows.length} floors, top floor first`}
          aria-describedby={bare ? undefined : 'sp-legend'}
          aria-rowcount={rows.length}
        >
          {rows.map((r, ri) => {
            const f = r.f;
            const leasedPct = f.leasable ? f.leased / f.leasable : 0;
            const floorSelected = state.floor === f.floor.id;
            const floorNum = f.floor.name.replace(/^Floor\s+/i, '');
            return (
              <g key={f.floor.id} role="row" className="sp-stack__row" data-row={f.floor.id} aria-rowindex={ri + 1} transform={`translate(0 ${r.y})`} onPointerEnter={() => setHoverFloor(f.floor.id)} onPointerLeave={() => setHoverFloor(null)}>
                <rect className={`sp-stack__rowbg ${floorSelected || r.focused ? 'is-floor-selected' : ''} ${hoverFloor === f.floor.id ? 'is-hot' : ''}`} x={0} y={-3} width={gutter + r.w + 6} height={r.h + 6} rx={6} />
                <line className="sp-stack__floorline" x1={gutter} x2={gutter + r.w} y1={r.h + 3} y2={r.h + 3} />
                {/* Gutter */}
                <g
                  role="rowheader"
                  className="sp-gutter__btn"
                  tabIndex={-1}
                  data-floor={f.floor.id}
                  aria-label={`${f.floor.name}: ${pct(leasedPct)} leased, ${num(f.leasable)} RSF leasable${f.overAllocatedBy ? `, records exceed leasable area by ${num(f.overAllocatedBy)} SF` : ''}. Open floor summary.`}
                  onClick={() => openFloor(patch, f.floor.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFloor(patch, f.floor.id);
                    } else if ((e.key === 'Home' || e.key === 'End') && r.boxes.length) {
                      e.preventDefault();
                      focusBlock(e.key === 'Home' ? r.boxes[0].key : r.boxes[r.boxes.length - 1].key);
                    } else if (e.key === 'ArrowRight' && r.boxes[0]) {
                      e.preventDefault();
                      focusBlock(r.boxes[0].key);
                    } else if (e.key === 'Escape' && state.floor) {
                      e.preventDefault();
                      patch({ floor: null, mode: 'building' });
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const nr = rows[ri + (e.key === 'ArrowDown' ? 1 : -1)];
                      if (nr) svgRef.current?.querySelector<SVGGElement>(`[data-floor="${nr.f.floor.id}"]`)?.focus();
                    }
                  }}
                >
                  <rect x={0} y={0} width={gutter - 8} height={r.h} rx={4} fill="transparent" />
                  <text className="sp-gutter__name" x={8} y={phone ? r.h / 2 - 1 : r.h >= 60 ? 22 : 15}>
                    {floorNum}
                  </text>
                  {phone && (
                    <text className="sp-gutter__pct" x={2} y={r.h / 2 + 12} fontSize={10}>
                      {pct(leasedPct)}
                    </text>
                  )}
                  {phone && f.overAllocatedBy > 0 && !state.safe && (
                    <text className="sp-gutter__warn" x={2} y={r.h - 3} fontSize={9} fontWeight={600}>
                      +{num(f.overAllocatedBy)} SF
                    </text>
                  )}
                  {!phone && (
                    <>
                      <text className="sp-gutter__pct" x={44} y={r.h >= 60 ? 22 : 15}>
                        {pct(leasedPct)}
                      </text>
                      <rect className="sp-gutter__bar-bg" x={44} y={r.h >= 60 ? 30 : 20} width={64} height={4} rx={2} />
                      <rect className={`sp-gutter__bar ${leasedPct < 0.7 ? 'sp-gutter__bar--low' : ''}`} x={44} y={r.h >= 60 ? 30 : 20} width={Math.max(2, 64 * Math.min(1, leasedPct))} height={4} rx={2} />
                      <text className="sp-gutter__rsf" x={44} y={r.h >= 60 ? 50 : 37}>
                        {num(f.leasable)} RSF
                      </text>
                      {r.focused && r.h >= 100 && (
                        <text className="sp-gutter__rsf" x={8} y={84}>
                          {f.available > 0 ? `${num(f.available)} SF available` : 'Nothing available'}
                        </text>
                      )}
                      {f.overAllocatedBy > 0 && !state.safe && (
                        <text className="sp-gutter__warn" x={8} y={r.h >= 60 ? 62 : 48} fontSize={10} fontWeight={600}>
                          +{num(f.overAllocatedBy)} SF over
                        </text>
                      )}
                    </>
                  )}
                </g>
                {r.nonLeasablePx > 0 && (
                  <g className="sp-nonleasable" transform={`translate(${gutter + r.leasablePx + 2} 0)`}>
                    <title>{`${f.floor.name}: ${num(f.floor.nonLeasable)} SF non-leasable (lobby, loading, building use). Not counted in occupancy.`}</title>
                    <rect width={r.nonLeasablePx} height={r.h} rx={4} />
                    <rect width={r.nonLeasablePx} height={r.h} rx={4} fill="url(#sp-hatch)" style={{ color: 'var(--sp-color-border-strong)' }} />
                    {r.nonLeasablePx >= 44 && (
                      <text x={r.nonLeasablePx / 2} y={r.h / 2 + 4} textAnchor="middle">
                        {r.nonLeasablePx >= 200 ? `Lobby · building use · ${num(f.floor.nonLeasable)} SF` : r.nonLeasablePx >= 96 ? `Lobby · ${num(f.floor.nonLeasable)} SF` : 'Lobby'}
                      </text>
                    )}
                  </g>
                )}
                {/* Blocks */}
                {r.boxes.map((b, bi) => {
                  const seg = segIndex.get(b.key)!;
                  const text = textFor(seg, f);
                  // A focused floor has room for the facts the other lenses carry.
                  const extra = r.focused ? extrasFor(seg, f) : undefined;
                  return (
                    <Block
                      key={b.key}
                      seg={seg}
                      text={text}
                      x={gutter + b.x}
                      y={0}
                      w={b.w}
                      h={r.h}
                      selected={state.select === b.key}
                      related={(!!selectedLease && state.select !== b.key && seg.lease?.id === selectedLease && seg.kind !== 'available') || (!!pinnedKeys && pinnedKeys.has(b.key) && state.select !== b.key)}
                      dim={!!highlight && !highlight.has(b.key) && !(highlight === model.highlight && model.partial?.has(b.key))}
                      partial={!!highlight && highlight === model.highlight && !highlight.has(b.key) && !!model.partial?.has(b.key)}
                      focusable={activeKey === b.key}
                      enlarged={b.enlarged}
                      extra={extra}
                      roomy={r.focused}
                      compact={phone}
                      onSelect={() => selectSegment(patch, b.key)}
                      onFocus={() => setFocusKey(b.key)}
                      onKeyDown={(e) => onKeyDown(e, ri, bi)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {!bare && (
        <div className="sp-stack__foot">
          <span>Floor width is proportional to gross floor area; suite width to its RSF. Click a floor number or a suite to focus that floor.</span>
          <span>
            Keys: ← → suites · ↑ ↓ floors · ← from the first suite reaches the floor label · Enter opens · Esc closes
          </span>
        </div>
      )}
    </section>
  );
}
