import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { ISODate } from '../../domain/types';
import { addMonths, fmtDate, fmtMonthYear, monthsBetween, startOfMonth } from '../../domain/dates';
import { dateToX, xToDate } from '../../domain/timeline';
import { measure } from '../../lib/textFit';

export interface AsOfCursorProps {
  asOf: ISODate;
  today: ISODate;
  /** Axis the cursor maps pixels onto (frozen by the parent while dragging). */
  start: ISODate;
  end: ISODate;
  svgRef: RefObject<SVGSVGElement | null>;
  /** Left edge of the plot inside the SVG (gutter width) and its width in SVG units. */
  plotLeft: number;
  plotWidth: number;
  /** Line extent in SVG units. */
  top: number;
  height: number;
  /** Handle height (28 in the full view, 8 in the mini scrubber). */
  handleHeight?: number;
  /** Mini mode: a small grip instead of the labelled handle. */
  compact?: boolean;
  onChange: (d: ISODate) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const HANDLE_FONT = '600 12px Inter, system-ui, sans-serif';

/** Keep `d` inside [start, end], snapped to the 1st so the handle never shows a partial month. */
function clamp(d: ISODate, start: ISODate, end: ISODate): ISODate {
  if (d < start) return start;
  if (d > end) return end;
  return d;
}

/**
 * The as-of cursor: a brand line with a date handle, draggable with the pointer and
 * steerable from the keyboard. Every move calls `onChange` with a month-start date;
 * the parent patches global state so the whole plan recomputes. No transitions: the
 * numbers it drives must never read as interpolated.
 */
export function AsOfCursor({ asOf, today, start, end, svgRef, plotLeft, plotWidth, top, height, handleHeight = 28, compact = false, onChange, onDragStart, onDragEnd }: AsOfCursorProps) {
  const x = plotLeft + Math.min(plotWidth, Math.max(0, dateToX(asOf, start, end, plotWidth)));
  const frame = useRef<number | null>(null);
  const pendingX = useRef<number | null>(null);
  const lastEmitted = useRef<ISODate>(asOf);
  const dragging = useRef(false);
  lastEmitted.current = asOf;

  useEffect(
    () => () => {
      if (frame.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame.current);
    },
    [],
  );

  const toDate = (clientX: number): ISODate | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgWidth = svg.viewBox.baseVal?.width || svg.width.baseVal.value || rect.width;
    const scale = rect.width > 0 ? svgWidth / rect.width : 1;
    const px = (clientX - rect.left) * scale - plotLeft;
    return xToDate(px, start, end, plotWidth);
  };

  const flush = () => {
    frame.current = null;
    if (pendingX.current === null) return;
    const d = toDate(pendingX.current);
    pendingX.current = null;
    if (d && d !== lastEmitted.current) {
      lastEmitted.current = d;
      onChange(d);
    }
  };

  const schedule = (clientX: number) => {
    pendingX.current = clientX;
    if (frame.current !== null) return;
    if (typeof requestAnimationFrame === 'function') frame.current = requestAnimationFrame(flush);
    else flush();
  };

  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    onDragStart?.();
    schedule(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    if (!dragging.current) return;
    schedule(e.clientX);
  };
  const release = (e: PointerEvent<SVGGElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (frame.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    flush();
    onDragEnd?.();
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const base = startOfMonth(asOf);
    let next: ISODate | null = null;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = addMonths(base, e.shiftKey ? -12 : -1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = addMonths(base, e.shiftKey ? 12 : 1);
        break;
      case 'PageDown':
        next = addMonths(base, -12);
        break;
      case 'PageUp':
        next = addMonths(base, 12);
        break;
      case 'Home':
        next = today;
        break;
      case 'End':
        next = addMonths(today, 60);
        break;
      default:
        return;
    }
    e.preventDefault();
    const d = clamp(next, start, end);
    if (d !== asOf) onChange(d);
  };

  const label = compact ? '' : fmtMonthYear(asOf);
  const handleW = compact ? 10 : Math.ceil(measure(label, HANDLE_FONT)) + 16;
  // Keep the handle inside the SVG at both ends of the axis.
  const handleX = Math.min(Math.max(x - handleW / 2, plotLeft - 8), plotLeft + plotWidth - handleW + 8);

  return (
    <g
      className={`sp-cursor ${compact ? 'sp-cursor--compact' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="As-of date"
      aria-valuetext={fmtDate(asOf)}
      aria-valuemin={0}
      aria-valuemax={monthsBetween(start, end)}
      aria-valuenow={Math.max(0, monthsBetween(start, asOf))}
      aria-orientation="horizontal"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={onKeyDown}
    >
      <title>{`As of ${fmtDate(asOf)}. Drag, or use the arrow keys, to move the as-of date.`}</title>
      {/* Wide invisible hit area so the 2 px line is easy to grab. */}
      <rect className="sp-cursor__hit" x={x - 8} y={top} width={16} height={height} fill="transparent" />
      <line className="sp-cursor__line" x1={x} x2={x} y1={top} y2={top + height} />
      <rect className="sp-cursor__handle" x={handleX} y={top} width={handleW} height={handleHeight} rx={compact ? 2 : 4} />
      {!compact && (
        <text className="sp-cursor__label" x={handleX + handleW / 2} y={top + handleHeight / 2 + 4} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
