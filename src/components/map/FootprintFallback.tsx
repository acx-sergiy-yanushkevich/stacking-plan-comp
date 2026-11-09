import type { FloorView } from '../../domain/derive';
import { projectPolygon } from '../../domain/geometry';
import type { Tone } from '../../domain/lenses';
import { num, pct } from '../../domain/format';
import type { GeoPolygon } from '../../domain/types';
import { Icon } from '../ui';

export interface FootprintFallbackProps {
  footprint: GeoPolygon;
  floors: FloorView[];
  toneOf: (f: FloorView) => Tone;
  selectedFloorId: string | null;
  onSelect: (floorId: string) => void;
}

const PLAN_W = 260;
const PLAN_H = 200;
const ELEV_W = 220;
const BAND_H = 14;
const BAND_GAP = 2;

/**
 * Static stand-in when WebGL or the tile server is unavailable (Review Focus 5): the footprint
 * in plan, and a side elevation of stacked bands coloured by the active lens.
 */
export function FootprintFallback({ footprint, floors, toneOf, selectedFloorId, onSelect }: FootprintFallbackProps) {
  const pts = projectPolygon(footprint, { w: PLAN_W, h: PLAN_H }, 12);
  const d = pts.length ? `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z` : '';
  const ordered = [...floors].sort((a, b) => b.floor.sequence - a.floor.sequence);
  const elevH = ordered.length * (BAND_H + BAND_GAP) + 24;
  return (
    <div className="sp-map-fallback" role="group" aria-label="Footprint (map unavailable)">
      <p className="sp-map-fallback__notice" role="status">
        <Icon name="info" size={14} />
        Map tiles unavailable; showing the footprint only.
      </p>
      <div className="sp-map-fallback__row">
        <svg className="sp-map-fallback__plan" viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} width={PLAN_W} height={PLAN_H} role="img" aria-label="Building footprint, plan view">
          <rect x={0} y={0} width={PLAN_W} height={PLAN_H} fill="var(--sp-color-card-2)" rx={6} />
          {d && <path d={d} fill="var(--sp-color-card)" stroke="var(--sp-color-border-strong)" strokeWidth={1.5} />}
          <text x={PLAN_W / 2} y={PLAN_H - 8} textAnchor="middle" className="sp-map-fallback__caption">
            Footprint · plan
          </text>
        </svg>
        <svg className="sp-map-fallback__elev" viewBox={`0 0 ${ELEV_W} ${elevH}`} width={ELEV_W} height={elevH} role="img" aria-label="Side elevation: one band per floor coloured by the active lens">
          {ordered.map((f, i) => {
            const tone = toneOf(f);
            const y = 4 + i * (BAND_H + BAND_GAP);
            const selected = f.floor.id === selectedFloorId;
            const leasedPct = f.leasable > 0 ? f.leased / f.leasable : 0;
            return (
              <g key={f.floor.id} className="sp-map-fallback__band" onClick={() => onSelect(f.floor.id)} style={{ cursor: 'pointer' }}>
                <title>{`${f.floor.name} · ${pct(leasedPct)} leased · ${num(f.leasable)} RSF`}</title>
                <rect
                  x={36}
                  y={y}
                  width={ELEV_W - 44}
                  height={BAND_H}
                  rx={2}
                  fill={`var(--tone-${tone}-fill)`}
                  stroke={selected ? 'var(--sp-color-brand)' : `var(--tone-${tone}-edge)`}
                  strokeWidth={selected ? 2 : 1}
                  strokeDasharray={tone === 'empty' || tone === 'deal-none' ? '3 2' : undefined}
                />
                <text x={30} y={y + BAND_H - 3} textAnchor="end" className="sp-map-fallback__label">
                  {f.floor.sequence}
                </text>
              </g>
            );
          })}
          <line x1={36} x2={ELEV_W - 8} y1={elevH - 18} y2={elevH - 18} stroke="var(--sp-color-border-strong)" />
          <text x={(ELEV_W + 28) / 2} y={elevH - 5} textAnchor="middle" className="sp-map-fallback__caption">
            Elevation · {ordered.length} floors
          </text>
        </svg>
      </div>
    </div>
  );
}
