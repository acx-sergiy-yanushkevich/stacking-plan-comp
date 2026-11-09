import { dateToX } from '../../domain/timeline';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { ISODate } from '../../domain/types';
import { clearSelection, selectSegment, toggleBucket, type Patch } from '../plan/actions';
import { TimelineAxis } from './TimelineAxis';
import { TimelineRows, type BarHover } from './TimelineRows';
import { layoutRows, rowsHeight, viewAxis } from './layout';
import { AsOfCursor } from './AsOfCursor';
import { useWidth } from './useWidth';
import './timeline.css';

export interface TimelineViewProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

export const GUTTER = 88;
const MIN_WIDTH = 640;
/** Top strip: year labels, the cursor handle and the Today label. */
const STRIP_H = 28;
/** Rollover band under the strip. */
const BAND_H = 56;
const ROWS_TOP = STRIP_H + BAND_H + 2;
const BOTTOM_PAD = 6;

/**
 * Lease timeline (DESIGN.md §2.5): one SVG with a floor gutter, a rollover band measured
 * from the cursor, year gridlines, a bar per lease or availability and the draggable as-of
 * cursor. Moving the cursor patches `asOf`, so every view recomputes from the same model.
 */
export default function TimelineView({ model, state, patch }: TimelineViewProps) {
  const [hostRef, width] = useWidth<HTMLDivElement>(MIN_WIDTH);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const plotWidth = Math.max(200, width - GUTTER - 8);
  const rows = model.timeline.rows;
  const laid = useMemo(() => layoutRows(rows, model.asOf, ROWS_TOP), [rows, model.asOf]);
  const height = ROWS_TOP + rowsHeight(laid) + BOTTOM_PAD;
  const clipId = `sp-tl-plot-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // The axis follows as-of (as-of + 10 yr). Freeze it while dragging so the chart does not
  // rescale under the pointer; it snaps to the new extent on release.
  const axis = viewAxis(model.timeline, model.asOf, model.today);
  const [frozen, setFrozen] = useState<{ start: ISODate; end: ISODate } | null>(null);
  const start = frozen?.start ?? axis.start;
  const end = frozen?.end ?? axis.end;

  const [hover, setHover] = useState<BarHover | null>(null);
  const onHover = useCallback((h: BarHover | null) => setHover(h), []);
  // Selecting the selected bar again (click or Escape) clears the selection.
  const onSelect = useCallback((key: string) => (key === state.select ? clearSelection(patch) : selectSegment(patch, key)), [patch, state.select]);
  const onBucket = useCallback((key: number) => toggleBucket(patch, state.bucket, key), [patch, state.bucket]);
  const onAsOf = useCallback((d: ISODate) => patch({ asOf: d }), [patch]);

  // Floating tooltip position, relative to the host element.
  let tipStyle: { left: number; top: number } | null = null;
  if (hover && hostRef.current) {
    const rect = hostRef.current.getBoundingClientRect();
    if (Number.isNaN(hover.clientX)) {
      // Keyboard focus: anchor to the bar itself.
      const el = hostRef.current.querySelector<SVGGElement>(`[data-seg="${CSS.escape(hover.key.replace(/^tl-/, ''))}"]`);
      const b = el?.getBoundingClientRect();
      tipStyle = b ? { left: b.left - rect.left + 8, top: b.bottom - rect.top + 6 } : null;
    } else {
      tipStyle = { left: hover.clientX - rect.left + 12, top: hover.clientY - rect.top + 16 };
    }
  }

  return (
    <div className="sp-timeline" ref={hostRef}>
      <svg ref={svgRef} className="sp-timeline__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Lease timeline, ${rows.length} floors`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={GUTTER} y={0} width={plotWidth} height={height} />
          </clipPath>
        </defs>
        <TimelineAxis
          start={start}
          end={end}
          asOf={model.asOf}
          today={model.today}
          plotLeft={GUTTER}
          plotWidth={plotWidth}
          stripHeight={STRIP_H}
          bandHeight={BAND_H}
          height={height - BOTTOM_PAD}
          buckets={model.roll.buckets}
          atRisk={model.roll.atRisk}
          activeBucket={state.bucket}
          onBucket={onBucket}
        />
        <line className="sp-cursor__line sp-cursor__line--under" x1={GUTTER + dateToX(model.asOf, start, end, plotWidth)} x2={GUTTER + dateToX(model.asOf, start, end, plotWidth)} y1={0} y2={height - BOTTOM_PAD} />
        <TimelineRows
          rows={laid}
          segIndex={model.segIndex}
          start={start}
          end={end}
          asOf={model.asOf}
          lens={state.lens}
          safe={model.safe}
          plotLeft={GUTTER}
          plotWidth={plotWidth}
          clipId={clipId}
          highlight={model.highlight}
          selected={state.select}
          hovered={hover?.key ?? null}
          onSelect={onSelect}
          onHover={onHover}
        />
        <AsOfCursor
          asOf={model.asOf}
          today={model.today}
          start={start}
          end={end}
          svgRef={svgRef}
          plotLeft={GUTTER}
          plotWidth={plotWidth}
          top={0}
          height={height - BOTTOM_PAD}
          hideLine
          handleHeight={STRIP_H}
          onChange={onAsOf}
          onDragStart={() => setFrozen(axis)}
          onDragEnd={() => setFrozen(null)}
        />
      </svg>
      {hover && tipStyle && (
        <div className="sp-tl-tip" aria-hidden="true" style={tipStyle}>
          {hover.text}
        </div>
      )}
      <p className="sp-timeline__note">Drag the cursor or use ← → to move the as-of date; the whole plan recomputes.</p>
    </div>
  );
}
