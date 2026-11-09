import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { blockLayout } from '../../domain/layout';
import { num, pct } from '../../domain/format';
import { fmtDate } from '../../domain/dates';
import { matchingInquiries } from '../../domain/finder';
import { useIsPhone } from '../../lib/useMedia';
import { useWidth } from '../../lib/useWidth';
import { clearSelection, openFloor, selectSegment } from '../plan/actions';
import { Legend } from '../plan/Legend';
import { Patterns } from '../plan/Patterns';
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
}

const ROW_GAP = 6;
const MIN_BLOCK = 56;

export default function StackView({ model, state, patch, bare }: StackViewProps) {
  const phone = useIsPhone();
  const [ref, width] = useWidth<HTMLDivElement>(1040);
  const rowH = phone ? 56 : 72;
  const gutter = phone ? 44 : 124;
  const planPx = Math.max(240, width - gutter - 8);
  const { floors, segIndex, highlight } = model;

  // Row width follows gross floor area (so the podium reads as the widest plate); the
  // non-leasable part is drawn as a muted block on the right and never counted.
  const rows = useMemo(() => {
    const maxSize = Math.max(...floors.map((f) => f.floor.size));
    return floors.map((f, i) => {
      const share = Math.max(0.6, f.floor.size / maxSize);
      const fw = Math.round(planPx * share);
      const nonLeasablePx = f.floor.nonLeasable > 0 ? Math.max(MIN_BLOCK, Math.round((fw * f.floor.nonLeasable) / f.floor.size)) : 0;
      const leasablePx = fw - nonLeasablePx - (nonLeasablePx ? 2 : 0);
      const boxes = blockLayout(f.segments, leasablePx, MIN_BLOCK, 2);
      return { f, y: i * (rowH + ROW_GAP), w: fw, boxes, nonLeasablePx, leasablePx };
    });
  }, [floors, planPx, rowH]);
  const anyEnlarged = rows.some((r) => r.boxes.some((b) => b.enlarged));
  const height = rows.length * (rowH + ROW_GAP) - ROW_GAP + 2;

  // Inquiry-fit badges while the finder is active
  const matchCount = useCallback(
    (key: string) => {
      if (!model.req) return undefined;
      const s = segIndex.get(key);
      const a = s?.availability ?? s?.marketed;
      if (!s || !a || (s.kind !== 'available' && s.kind !== 'sublease' && !s.marketed)) return undefined;
      const n = matchingInquiries(model.property.inquiries, { size: a.size, divisible: a.divisible, minDivisible: a.minDivisible, from: a.availableFrom }, model.asOf).length;
      return n || undefined;
    },
    [model.req, model.property.inquiries, model.asOf, segIndex],
  );

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
        next = row.boxes[Math.max(boxIdx - 1, 0)].key;
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
    if (state.select && segIndex.has(state.select)) setFocusKey(state.select);
  }, [state.select, segIndex]);

  const legendNote = anyEnlarged ? `Suites under ${MIN_BLOCK} px are enlarged for legibility; other suites on that floor shrink to compensate.` : null;
  const totalLeasable = model.kpis.leasable;

  return (
    <section className={`sp-card sp-stack ${bare ? 'sp-stack--bare' : ''}`} aria-label="Stacking plan">
      {!bare && (
        <div className="sp-stack__head">
          <div className="sp-stack__title">
            <h2>{state.lens === 'status' ? 'Occupancy' : state.lens === 'expiry' ? 'Expirations' : state.lens === 'deals' ? 'Deal pipeline' : 'Rents'}</h2>
            <span className="sp-weak">
              as of {fmtDate(model.asOf)} · {num(totalLeasable)} RSF leasable
            </span>
          </div>
          <Legend items={model.legend} compact id="sp-legend" />
        </div>
      )}
      {!bare && model.filterLabel && <FilterBar label={model.filterLabel} patch={patch} />}
      <div className="sp-stack__body" ref={ref}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="grid"
          aria-label={`Stacking plan, ${rows.length} floors, top floor first`}
          aria-describedby={bare ? undefined : 'sp-legend'}
          aria-rowcount={rows.length}
        >
          <Patterns />
          {rows.map((r, ri) => {
            const f = r.f;
            const leasedPct = f.leasable ? f.leased / f.leasable : 0;
            const floorSelected = state.floor === f.floor.id;
            const floorNum = f.floor.name.replace(/^Floor\s+/i, '');
            return (
              <g key={f.floor.id} role="row" aria-rowindex={ri + 1} transform={`translate(0 ${r.y})`}>
                <rect className={`sp-stack__rowbg ${floorSelected ? 'is-floor-selected' : ''}`} x={0} y={-3} width={gutter + r.w + 6} height={rowH + 6} rx={6} />
                <line className="sp-stack__floorline" x1={gutter} x2={gutter + r.w} y1={rowH + 3} y2={rowH + 3} />
                {/* Gutter */}
                <g
                  role="rowheader"
                  className="sp-gutter__btn"
                  tabIndex={0}
                  aria-label={`${f.floor.name}: ${pct(leasedPct)} leased, ${num(f.leasable)} RSF leasable${f.overAllocatedBy ? `, over-allocated by ${num(f.overAllocatedBy)} SF` : ''}. Open floor summary.`}
                  onClick={() => openFloor(patch, f.floor.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFloor(patch, f.floor.id);
                    }
                  }}
                >
                  <rect x={0} y={0} width={gutter - 8} height={rowH} rx={4} fill="transparent" />
                  <text className="sp-gutter__name" x={8} y={phone ? rowH / 2 + 5 : 22}>
                    {floorNum}
                  </text>
                  {!phone && (
                    <>
                      <text className="sp-gutter__pct" x={44} y={22}>
                        {pct(leasedPct)}
                      </text>
                      <rect className="sp-gutter__bar-bg" x={44} y={30} width={64} height={4} rx={2} />
                      <rect className={`sp-gutter__bar ${leasedPct < 0.7 ? 'sp-gutter__bar--low' : ''}`} x={44} y={30} width={Math.max(2, 64 * Math.min(1, leasedPct))} height={4} rx={2} />
                      <text className="sp-gutter__rsf" x={44} y={50}>
                        {num(f.leasable)} RSF
                      </text>
                      {f.overAllocatedBy > 0 && (
                        <text className="sp-gutter__warn" x={8} y={50} fontSize={11} fontWeight={600}>
                          +{num(f.overAllocatedBy)}
                        </text>
                      )}
                    </>
                  )}
                </g>
                {r.nonLeasablePx > 0 && (
                  <g className="sp-nonleasable" transform={`translate(${gutter + r.leasablePx + 2} 0)`}>
                    <title>{`${f.floor.name}: ${num(f.floor.nonLeasable)} SF non-leasable (lobby, loading, building use). Not counted in occupancy.`}</title>
                    <rect width={r.nonLeasablePx} height={rowH} rx={4} />
                    <rect width={r.nonLeasablePx} height={rowH} rx={4} fill="url(#sp-hatch)" style={{ color: 'var(--sp-color-border-strong)' }} />
                    {r.nonLeasablePx >= 120 && (
                      <text x={r.nonLeasablePx / 2} y={rowH / 2 + 4} textAnchor="middle">
                        Lobby · building use · {num(f.floor.nonLeasable)} SF
                      </text>
                    )}
                  </g>
                )}
                {/* Blocks */}
                {r.boxes.map((b, bi) => {
                  const seg = segIndex.get(b.key)!;
                  const text = segmentText(seg, { safe: state.safe, asOf: model.asOf, lens: state.lens, floorName: f.floor.name, matches: matchCount(b.key) });
                  return (
                    <Block
                      key={b.key}
                      seg={seg}
                      text={text}
                      x={gutter + b.x}
                      y={0}
                      w={b.w}
                      h={rowH}
                      selected={state.select === b.key}
                      dim={!!highlight && !highlight.has(b.key)}
                      focusable={activeKey === b.key}
                      enlarged={b.enlarged}
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
          <span>Floor width is proportional to gross floor area; suite width to its RSF. {legendNote ?? ''}</span>
          <span>
            Keys: ← → suites · ↑ ↓ floors · Enter opens · Esc closes
          </span>
        </div>
      )}
    </section>
  );
}
