import type { KeyboardEvent } from 'react';
import type { RolloverBucket } from '../../domain/rollover';
import { num, plural } from '../../domain/format';

export interface RolloverChartProps {
  buckets: RolloverBucket[];
  /** Holdover + month-to-month SF, reported outside the periods. */
  atRisk: number;
  atRiskLeases: number;
  activeBucket: number | null;
  onBucket: (key: number | null) => void;
  onAtRisk?: () => void;
  safe?: boolean;
}

// Geometry (SVG user units; the panel is 360 px wide so this renders 1:1 on desktop).
const W = 328;
const LABEL_W = 56; // bucket label column
const VALUE_W = 54; // room for a 6-digit SF value at the tip
const ROW = 24;
const BAR = 14; // ≤ 24 px: thin mark, air around it
const PAD_TOP = 4;
const RADIUS = 4;

/** A bar anchored square on the baseline with a 4 px rounded data end. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (w <= RADIUS) return `M${x} ${y}h${w}v${h}h${-w}z`;
  const r = RADIUS;
  return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r)}z`;
}

/**
 * Lease SF ending per rolling period, as horizontal bars so full SF values
 * (never rounded) fit beside every bar in a 360 px panel. One series, one
 * hue; the active bucket is emphasised and the rest recede. At-risk space is
 * a separate rose row because holdover and MTM leases have no period.
 */
export function RolloverChart({ buckets, atRisk, atRiskLeases, activeBucket, onBucket, onAtRisk, safe = false }: RolloverChartProps) {
  const max = Math.max(1, ...buckets.map((b) => b.sf), atRisk);
  const x0 = LABEL_W;
  const plotW = W - LABEL_W - VALUE_W;
  const rows = buckets.length + (safe ? 0 : 1);
  const H = PAD_TOP * 2 + rows * ROW;
  const anyActive = activeBucket !== null;
  const scale = (sf: number) => (sf <= 0 ? 0 : Math.max(2, (sf / max) * plotW));

  const onKey = (e: KeyboardEvent<SVGGElement>, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <svg className="sp-roll" viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Lease rollover by period">
      {/* baseline only: no gridlines */}
      <line className="sp-roll__baseline" x1={x0} x2={x0} y1={PAD_TOP} y2={H - PAD_TOP} />
      {buckets.map((b, i) => {
        const y = PAD_TOP + i * ROW;
        const w = scale(b.sf);
        const active = activeBucket === b.key;
        const cls = ['sp-roll__bar', active ? 'is-active' : '', anyActive && !active ? 'is-dim' : ''].filter(Boolean).join(' ');
        const label = `${b.label} ${b.sf > 0 ? num(b.sf) : '—'}: ${b.sf > 0 ? `${num(b.sf)} SF, ${plural(b.leases, 'lease')}` : 'no leases ending'}`;
        return (
          <g
            key={b.key}
            className={cls}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={label}
            onClick={() => onBucket(b.key)}
            onKeyDown={(e) => onKey(e, () => onBucket(b.key))}
          >
            <title>{label}</title>
            {/* hit target: the whole row, not just the mark */}
            <rect className="sp-roll__hit" x={0} y={y} width={W} height={ROW} />
            <text className="sp-roll__label" x={x0 - 8} y={y + ROW / 2} textAnchor="end" dominantBaseline="middle">
              {`${b.label} `}
            </text>
            {b.sf > 0 && <path className="sp-roll__mark" d={barPath(x0, y + (ROW - BAR) / 2, w, BAR)} />}
            <text className="sp-roll__value" x={x0 + w + 6} y={y + ROW / 2} dominantBaseline="middle">
              {`${b.sf > 0 ? num(b.sf) : '—'} `}
            </text>
          </g>
        );
      })}
      {!safe && (() => {
        const y = PAD_TOP + buckets.length * ROW;
        const w = scale(atRisk);
        const label = `At risk ${atRisk > 0 ? num(atRisk) : '—'}: holdover and month-to-month, ${atRisk > 0 ? `${num(atRisk)} SF, ${plural(atRiskLeases, 'lease')}` : 'none'}`;
        const clickable = atRisk > 0 && onAtRisk;
        return (
          <g
            className={`sp-roll__bar sp-roll__bar--risk ${anyActive ? 'is-dim' : ''}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={label}
            onClick={clickable ? onAtRisk : undefined}
            onKeyDown={clickable ? (e) => onKey(e, onAtRisk) : undefined}
          >
            <title>{label}</title>
            <rect className="sp-roll__hit" x={0} y={y} width={W} height={ROW} />
            <text className="sp-roll__label" x={x0 - 8} y={y + ROW / 2} textAnchor="end" dominantBaseline="middle">
              {'At risk '}
            </text>
            {atRisk > 0 && <path className="sp-roll__mark" d={barPath(x0, y + (ROW - BAR) / 2, w, BAR)} />}
            <text className="sp-roll__value" x={x0 + w + 6} y={y + ROW / 2} dominantBaseline="middle">
              {`${atRisk > 0 ? num(atRisk) : '—'} `}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
