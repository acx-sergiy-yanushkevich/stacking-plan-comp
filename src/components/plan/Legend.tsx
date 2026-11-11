import type { LegendItem } from '../../domain/lenses';
import { num, pct } from '../../domain/format';

/** An entry for something drawn on the plan that is not a state of the lens: building use (the lobby). */
export interface LegendExtra {
  label: string;
  /** Exact SF it covers. */
  sf: number;
  /** Tooltip. */
  title: string;
  /** The tone whose fill and edge the swatch takes, and the pattern drawn over it: as on the plan. */
  tone: string;
  pattern: 'hatch' | 'dots' | 'dashed';
}

export interface LegendProps {
  items: LegendItem[];
  /** Entries after the lens's states, for what the plan draws beside them (see `buildingUse`). */
  extras?: LegendExtra[];
  /** Footnote shown under the items (e.g. "Suites under 56 px are enlarged"). */
  note?: string | null;
  id?: string;
  compact?: boolean;
}

/**
 * The legend entry for non-leasable area: the lobby and other building use, drawn as a grey hatch on the
 * building model (as the Stack view draws and labels it in the block itself). Null when the building has
 * none. It carries its SF and no share: it is not leasable, so it is not part of any percentage.
 */
export function buildingUse(floors: ReadonlyArray<{ floor: { nonLeasable: number } }>): LegendExtra | null {
  const sf = floors.reduce((t, f) => t + f.floor.nonLeasable, 0);
  if (sf <= 0) return null;
  return { label: 'Lobby · building use', sf, title: `Lobby and building use: ${num(sf)} SF non-leasable (lobby, loading, building use). Not counted in occupancy.`, tone: 'muted', pattern: 'hatch' };
}

/** Legend whose items carry the SF and share they currently cover; an overlay carries its SF only. */
export function Legend({ items, extras, note, id, compact }: LegendProps) {
  return (
    <div className="sp-legend" id={id} aria-label="Legend">
      {items
        .filter((i) => i.sf > 0 || !compact)
        .map((i) => (
          <span key={i.tone + i.label} className="sp-legend__item" title={i.overlay ? `${i.label}: ${num(i.sf)} SF, also counted in its rent band` : `${i.label}: ${num(i.sf)} SF${i.share > 0 ? `, ${pct(i.share)} of leasable` : ''}`}>
            <span
              className={`sp-legend__swatch ${i.pattern ? `sp-legend__swatch--${i.pattern}` : ''}`}
              style={{ backgroundColor: i.pattern === 'dashed' ? 'transparent' : `var(--tone-${i.tone}-fill)`, borderColor: `var(--tone-${i.tone}-edge)`, color: `var(--tone-${i.tone}-edge)` }}
              aria-hidden="true"
            />
            <span className="sp-legend__label">{i.label}</span>
            {/* An overlay (the rent lens's asking rent) is drawn over space already counted in a band: it
                carries its SF and says so, and no share, so the shares printed add up to 100%. */}
            {i.sf > 0 && (
              <span className="sp-legend__num">
                {i.overlay ? `${num(i.sf)} SF · also in its band` : `${num(i.sf)}${i.share > 0 ? ` · ${pct(i.share)}` : ''}`}
              </span>
            )}
          </span>
        ))}
      {extras?.map((x) => (
        <span key={`extra-${x.label}`} className="sp-legend__item sp-legend__item--extra" title={x.title}>
          <span
            className={`sp-legend__swatch sp-legend__swatch--${x.pattern}`}
            style={{ backgroundColor: x.pattern === 'dashed' ? 'transparent' : `var(--tone-${x.tone}-solid, var(--tone-${x.tone}-fill))`, borderColor: `var(--tone-${x.tone}-edge)`, color: `var(--tone-${x.tone}-edge)` }}
            aria-hidden="true"
          />
          <span className="sp-legend__label">{x.label}</span>
          <span className="sp-legend__num">{num(x.sf)}</span>
        </span>
      ))}
      {note && <span className="sp-legend__note">{note}</span>}
    </div>
  );
}
