import { BACHELORS_LABEL, locationBrief, pct1, US_BENCHMARK } from '../../domain/areaBrief';
import { keepUnits, mi, num, usd0 } from '../../domain/format';
import type { Area, AreaRing, Property } from '../../domain/types';
import { DotJoin } from '../hero/DotJoin';
import { Chip, Icon } from '../ui';
import './area.css';

export interface LocationBriefProps {
  property: Property;
  area: Area;
  /** The PDF's section: a plain "Location" heading, on paper. */
  print?: boolean;
}


/** A figure and its unit stay on one line: "1 mile", "0.2 mi", "24.1 minutes" break before the figure, not inside. */
/** Facts joined by "·", for a line that may wrap: they break between facts, and no dot ends or starts a line. */
const facts = (text: string) => <DotJoin parts={keepUnits(text).split(' · ')} />;

/** The table's rows: each ring's figure, and the US figure where the measure has one. */
const ROWS: Array<{ label: string; ring: (r: AreaRing) => string; us: string }> = [
  { label: 'Population', ring: (r) => num(r.population), us: '—' },
  { label: 'Households', ring: (r) => num(r.households), us: '—' },
  { label: 'Median household income', ring: (r) => usd0(r.medianIncome), us: usd0(US_BENCHMARK.medianIncome) },
  { label: 'Median age', ring: (r) => r.medianAge.toFixed(1), us: US_BENCHMARK.medianAge.toFixed(1) },
  { label: BACHELORS_LABEL, ring: (r) => pct1(r.bachelorsPct), us: pct1(US_BENCHMARK.bachelorsPct) },
  { label: 'Mean commute', ring: (r) => `${r.meanCommuteMin.toFixed(1)} min`, us: `${US_BENCHMARK.meanCommuteMin.toFixed(1)} min` },
];

/**
 * The location brief (DESIGN.md §2.6): what a broker shows a client or a decision maker about the area
 * around the building. The Area panel widened to the full page, and the report's last section.
 * Holds no tenant data, so prospect-safe mode shows it whole.
 */
export function LocationBrief({ property, area, print }: LocationBriefProps) {
  const b = locationBrief(area);
  const amenities = [...area.amenities].filter((a) => a.count > 0).sort((a, b2) => b2.count - a.count);
  const most = amenities[0]?.count ?? 1;
  const stops = [...area.transit].sort((a, b2) => a.distanceMi - b2.distanceMi);
  const ringMiles = b.rings.map((r) => r.miles);
  return (
    <article className={`sp-brief ${print ? 'sp-brief--print' : ''}`}>
      <header className="sp-brief__head">
        <div>
          <h2 className="sp-brief__title">{print ? 'Location' : facts(`Location · ${property.name}`)}</h2>
          <p className="sp-brief__sub">{facts(`${property.street}, ${property.city}, ${property.state} · rings at ${ringMiles.slice(0, -1).join(', ')} and ${ringMiles.at(-1)} miles`)}</p>
        </div>
        {area.sample && !print && (
          <Chip tone="neutral" title={area.source}>
            Sample figures
          </Chip>
        )}
      </header>

      <div className="sp-brief__heroes">
        {b.headline.map((h) => (
          <div key={h.label} className="sp-brief__hero">
            <span className="sp-brief__label">{h.label}</span>
            <span className="sp-brief__hero-value">{keepUnits(h.value)}</span>
            <span className="sp-brief__hero-note">{facts(h.note)}</span>
          </div>
        ))}
      </div>

      <div className="sp-brief__cols">
        <section>
          <h3 className="sp-brief__label">What stands out</h3>
          <ul className="sp-brief__points">
            {b.points.map((p) => (
              <li key={p}>{keepUnits(p)}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="sp-brief__label">Amenities within ½ mile</h3>
          {amenities.length === 0 ? (
            <p className="sp-brief__none">None recorded.</p>
          ) : (
            <ul className="sp-brief__bars">
              {amenities.map((a) => (
                <li key={a.category} className="sp-brief__bar" title={`${a.category}: ${a.count} within half a mile`}>
                  <span className="sp-brief__bar-name">{a.category}</span>
                  <span className="sp-brief__bar-track" aria-hidden="true">
                    <span className="sp-brief__bar-fill" style={{ width: `${(a.count / most) * 100}%` }} />
                  </span>
                  <span className="sp-brief__bar-value">{num(a.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="sp-brief__cols">
        <section>
          <h3 className="sp-brief__label">Figures by distance</h3>
          <table className="sp-brief__table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sp-sr-only">Measure</span>
                </th>
                {b.rings.map((r) => (
                  <th scope="col" key={r.miles}>
                    {r.miles} mi
                  </th>
                ))}
                <th scope="col">US</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {b.rings.map((r) => (
                    <td key={r.miles} className="sp-num">
                      {row.ring(r)}
                    </td>
                  ))}
                  <td className="sp-num sp-brief__us">{row.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="sp-brief__label">Nearby transit</h3>
          {stops.length === 0 ? (
            <p className="sp-brief__none">No stops on record.</p>
          ) : (
            <ul className="sp-brief__stops">
              {stops.map((t) => (
                <li key={`${t.name}-${t.distanceMi}`}>
                  {/* The kind of stop is a word as well as an icon: bus and rail are not told apart by the drawing alone. */}
                  <Icon name={t.type === 'Rail' ? 'train' : 'bus'} size={14} />
                  <span className="sp-brief__stop-name">{t.name}</span>
                  <span className="sp-transit-kind">{t.type === 'Rail' ? 'Rail' : 'Bus'}</span>
                  <span className="sp-num">{keepUnits(mi(t.distanceMi))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="sp-brief__foot">
        <p>{area.sample ? area.source : `Area figures: ${area.source}. Amenities and transit: OpenStreetMap.`}</p>
        <p>{US_BENCHMARK.source}. A figure is said to stand out when it is at least 10% from the US figure.</p>
      </footer>
    </article>
  );
}
