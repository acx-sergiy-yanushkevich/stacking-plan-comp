import { useRef } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { ISODate } from '../../domain/types';
import { barSegment, dateToX, yearTicks } from '../../domain/timeline';
import { toneFor } from '../../domain/lenses';
import { AsOfCursor } from './AsOfCursor';
import { viewAxis } from './layout';
import './timeline.css';

export interface MiniTimelineProps {
  model: PlanModel;
  asOf: ISODate;
  onChange: (d: ISODate) => void;
  width?: number;
  height?: number;
}

const LABEL_H = 14;
const GRIP_H = 8;

/**
 * Thumbnail of the lease timeline used as a scrubber in the as-of popover: tone-coloured
 * bars only, no text, with the same draggable and keyboard cursor as the full view.
 */
export function MiniTimeline({ model, asOf, onChange, width = 300, height = 56 }: MiniTimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { rows } = model.timeline;
  const { start, end } = viewAxis(model.timeline, asOf, model.today);
  const plotTop = GRIP_H;
  const plotH = height - LABEL_H - plotTop;
  const pitch = rows.length ? plotH / rows.length : plotH;
  const barH = Math.max(2, Math.min(3, pitch - 0.5));
  const X = (d: ISODate) => Math.min(width, Math.max(0, dateToX(d, start, end, width)));
  const cursorX = X(asOf);
  const every = width < 320 ? 2 : 1;
  const ticks = yearTicks(start, end).filter((t) => Number(t.label) % every === 0);

  return (
    <svg ref={svgRef} className="sp-timeline sp-timeline--mini" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="As-of scrubber">
      <rect className="sp-mini__bg" x={0} y={plotTop} width={width} height={plotH} rx={2} />
      {ticks.map((t) => {
        const x = X(t.date);
        return (
          <g key={t.date}>
            <line className="sp-mini__grid" x1={x + 0.5} x2={x + 0.5} y1={plotTop} y2={plotTop + plotH} />
            <text className="sp-mini__year" x={x + 2} y={height - 3}>
              {t.label}
            </text>
          </g>
        );
      })}
      {rows.map((row, i) => {
        const y = plotTop + i * pitch + (pitch - barH) / 2;
        return row.bars.map((bar) => {
          const seg = barSegment(bar, model.segIndex);
          if (!seg) return null;
          const tone = toneFor(seg, 'status', model.safe);
          const x0 = X(bar.start);
          const open = bar.kind === 'available' || bar.kind === 'forsale';
          const x1 = open ? width : bar.end ? X(bar.end) : Math.max(x0 + 2, cursorX);
          const risk = (bar.kind === 'holdover' || bar.kind === 'projected') && cursorX > x1;
          const transparent = tone === 'empty' || tone === 'deal-none';
          return (
            <g key={bar.key}>
              <rect x={x0} y={y} width={Math.max(1, x1 - x0)} height={barH} fill={transparent ? `var(--tone-${tone}-edge)` : `var(--tone-${tone}-fill)`} fillOpacity={transparent ? 0.4 : 1} />
              {risk && <rect x={x1} y={y} width={cursorX - x1} height={barH} fill={bar.kind === 'holdover' ? 'var(--tone-risk-edge)' : 'var(--tone-projected-edge)'} fillOpacity={0.6} />}
            </g>
          );
        });
      })}
      <AsOfCursor asOf={asOf} today={model.today} start={start} end={end} svgRef={svgRef} plotLeft={0} plotWidth={width} top={0} height={plotTop + plotH} handleHeight={GRIP_H} compact onChange={onChange} />
    </svg>
  );
}
