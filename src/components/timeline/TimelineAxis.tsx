import type { KeyboardEvent } from 'react';
import type { ISODate } from '../../domain/types';
import type { RolloverBucket } from '../../domain/rollover';
import { addMonths, fmtDate } from '../../domain/dates';
import { dateToX, yearTicks } from '../../domain/timeline';
import { num, plural, sf } from '../../domain/format';
import { measure } from '../../lib/textFit';

export interface TimelineAxisProps {
  start: ISODate;
  end: ISODate;
  asOf: ISODate;
  today: ISODate;
  plotLeft: number;
  plotWidth: number;
  /** Top strip (year labels, cursor handle, Today) height. */
  stripHeight: number;
  /** Rollover band height, drawn directly under the strip. */
  bandHeight: number;
  /** Total SVG height, for the gridlines. */
  height: number;
  buckets: RolloverBucket[];
  atRisk: number;
  activeBucket: number | null;
  onBucket: (key: number) => void;
}

const LABEL_FONT = '11px Inter, system-ui, sans-serif';
const VALUE_FONT = '600 12px Inter, system-ui, sans-serif';
const VALUE_FONT_SM = '600 11px Inter, system-ui, sans-serif';

/**
 * Header of the timeline: year gridlines and labels, the Today marker, and the rollover
 * band, one column per 12-month bucket measured from the cursor (the same numbers as the
 * Building inspector). Clicking a column filters the plan to the leases ending in it.
 */
export function TimelineAxis({ start, end, asOf, today, plotLeft, plotWidth, stripHeight, bandHeight, height, buckets, atRisk, activeBucket, onBucket }: TimelineAxisProps) {
  const X = (d: ISODate) => plotLeft + Math.min(plotWidth, Math.max(0, dateToX(d, start, end, plotWidth)));
  const allTicks = yearTicks(start, end);
  // Thin the year labels when a year is too narrow for a 4-digit label; gridlines stay yearly.
  const pxPerYear = allTicks.length > 1 ? (X(allTicks[1].date) - X(allTicks[0].date)) : plotWidth;
  const every = pxPerYear >= 34 ? 1 : pxPerYear >= 17 ? 2 : 5;
  const bandTop = stripHeight;
  const bandBottom = stripHeight + bandHeight;
  const todayX = X(today);
  const showToday = today !== asOf;
  const todayAfter = today > asOf;
  const todayLabelW = measure('Today', LABEL_FONT) + 10;
  const todayLabelX0 = todayAfter ? todayX : todayX - todayLabelW;
  const periods = buckets.length - 1;

  const keyActivate = (key: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onBucket(key);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cols = Array.from((e.currentTarget.parentElement as Element).querySelectorAll<SVGGElement>('[role="button"]'));
      const i = cols.indexOf(e.currentTarget);
      const next = cols[i + (e.key === 'ArrowRight' ? 1 : -1)];
      next?.focus();
    } else if (e.key === 'Escape' && activeBucket !== null) {
      e.preventDefault();
      onBucket(activeBucket);
    }
  };

  return (
    <g className="sp-tl-axis">
      {/* Rollover band background and gutter cell */}
      <rect className="sp-tl-band__bg" x={0} y={bandTop} width={plotLeft + plotWidth} height={bandHeight} />
      <g className="sp-tl-band__gutter">
        <text className="sp-tl-band__caption" x={10} y={bandTop + 20}>
          {atRisk > 0 ? 'At risk' : 'Rollover'}
        </text>
        {atRisk > 0 ? (
          <text className="sp-tl-band__risk" x={10} y={bandTop + 38}>
            <title>{`${sf(atRisk)} in holdover or month-to-month: not in any bucket`}</title>
            {sf(atRisk)}
          </text>
        ) : (
          <text className="sp-tl-band__hint" x={10} y={bandTop + 38}>
            from cursor
          </text>
        )}
      </g>

      {/* Bucket columns */}
      <g className="sp-tl-band">
        {buckets.map((b, i) => {
          const from = addMonths(asOf, 12 * i);
          const to = i === periods ? end : addMonths(asOf, 12 * (i + 1));
          const x0 = X(from);
          const x1 = X(to);
          const w = x1 - x0;
          if (w <= 0) return null;
          const active = activeBucket === b.key;
          const value = b.sf > 0 ? `${num(b.sf)} SF` : '—';
          // Never rounded: drop the unit, then the point size, before dropping the number (the title keeps it).
          const fitsIn = (t: string, font: string) => measure(t, font) + 6 <= w;
          const [valueText, small] = fitsIn(value, VALUE_FONT) ? [value, false] : fitsIn(num(b.sf), VALUE_FONT) ? [num(b.sf), false] : fitsIn(num(b.sf), VALUE_FONT_SM) ? [num(b.sf), true] : ['', false];
          const compactLabel = b.label === '< 12 mo' ? '<12 mo' : b.label.replace(/ yr$/, '');
          const labelText = fitsIn(b.label, LABEL_FONT) ? b.label : fitsIn(compactLabel, LABEL_FONT) ? compactLabel : '';
          const title = `${b.leases ? `${sf(b.sf)} in ${plural(b.leases, 'lease')}` : 'No leases'} ending ${b.label.startsWith('<') ? 'in the next 12 months' : b.label.endsWith('+ yr') ? `${periods}+ years out` : `${b.label} out`} from ${fmtDate(asOf)}. ${active ? 'Click to clear the filter.' : 'Click to highlight them.'}`;
          return (
            <g
              key={b.key}
              className={`sp-tl-band__col ${i % 2 ? 'is-alt' : ''} ${active ? 'is-active' : ''} ${b.sf === 0 ? 'is-empty' : ''}`}
              role="button"
              tabIndex={i === (activeBucket !== null ? buckets.findIndex((x) => x.key === activeBucket) : 0) ? 0 : -1}
              aria-pressed={active}
              aria-label={`${[labelText, valueText].filter(Boolean).join(' ')}${labelText || valueText ? '. ' : ''}${b.label}: ${sf(b.sf)}, ${plural(b.leases, 'lease')}`}
              onClick={() => onBucket(b.key)}
              onKeyDown={keyActivate(b.key)}
            >
              <title>{title}</title>
              <rect className="sp-tl-band__fill" x={x0} y={bandTop} width={w} height={bandHeight} />
              {active && <rect className="sp-tl-band__beam" x={x0} y={bandBottom} width={w} height={Math.max(0, height - bandBottom)} />}
              {labelText && (
                <text className="sp-tl-band__label" x={Math.min(x0 + w / 2, plotLeft + plotWidth - measure(labelText, LABEL_FONT) / 2 - 4)} y={bandTop + 20} textAnchor="middle">
                  {`${labelText} `}
                </text>
              )}
              {valueText && (
                <text className={`sp-tl-band__value ${small ? 'is-small' : ''}`} x={Math.min(x0 + w / 2, plotLeft + plotWidth - measure(valueText, small ? VALUE_FONT_SM : VALUE_FONT) / 2 - 4)} y={bandTop + 38} textAnchor="middle">
                  {`${valueText} `}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <line className="sp-tl-axis__rule" x1={0} x2={plotLeft + plotWidth} y1={bandBottom + 0.5} y2={bandBottom + 0.5} />

      {/* Year gridlines and labels */}
      <g className="sp-tl-axis__years">
        {allTicks.map((t) => {
          const x = X(t.date);
          const labelW = measure(t.label, LABEL_FONT) + 8;
          const cursorX = X(asOf);
          const nearCursor = x + labelW > cursorX - 44 && x < cursorX + 44;
          const collides = nearCursor || (showToday && x < todayLabelX0 + todayLabelW && x + labelW > todayLabelX0);
          const labelled = Number(t.label) % every === 0 && !collides && x + labelW <= plotLeft + plotWidth;
          return (
            <g key={t.date}>
              <line className="sp-tl-axis__grid" x1={x + 0.5} x2={x + 0.5} y1={stripHeight} y2={height} />
              {labelled && (
                <text className="sp-tl-axis__year" x={x + 4} y={18}>
                  {t.label}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Today marker */}
      {showToday && (
        <g className="sp-tl-today" aria-hidden="true">
          <line x1={todayX + 0.5} x2={todayX + 0.5} y1={stripHeight} y2={height} />
          <text x={todayAfter ? todayX + 5 : todayX - 5} y={18} textAnchor={todayAfter ? 'start' : 'end'}>
            Today
          </text>
        </g>
      )}
    </g>
  );
}
