import { useEffect, useState } from 'react';
import type { DataSource } from '../../data/sources/DataSource';
import { num, pct, usd0 } from '../../domain/format';
import type { Area, AreaRing } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { Chip, Icon } from '../ui';
import './map.css';

export interface AreaPanelProps {
  model: PlanModel;
  state: PlanState;
  dataSource: DataSource;
}

const ROWS: Array<{ label: string; value: (r: AreaRing) => string }> = [
  { label: 'Population', value: (r) => num(r.population) },
  { label: 'Households', value: (r) => num(r.households) },
  { label: 'Median HH income', value: (r) => usd0(r.medianIncome) },
  { label: 'Median age', value: (r) => r.medianAge.toFixed(1) },
  { label: "Bachelor's degree", value: (r) => pct(r.bachelorsPct) },
  { label: 'Mean commute', value: (r) => `${r.meanCommuteMin.toFixed(1)}\u00a0min` },
];

function Skeleton() {
  return (
    <div className="sp-area-skeleton" aria-busy="true" aria-label="Loading area data">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="sp-skel" style={{ width: `${92 - (i % 3) * 14}%` }} />
      ))}
    </div>
  );
}

/**
 * Inspector "Area" mode (DESIGN.md §2.6): demographics in 1/3/5-mile rings, nearby transit,
 * amenity counts, and the source line. Sample figures are flagged until a Census key is given.
 */
export function AreaPanel({ model, state, dataSource }: AreaPanelProps) {
  const { property } = model;
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    dataSource
      .getArea(property, { censusKey: state.census })
      .then((a) => {
        if (!alive) return;
        setArea(a);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setArea(property.area);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dataSource, property, state.census]);

  const rings = area ? [...area.rings].sort((a, b) => a.miles - b.miles) : [];

  return (
    <section className="sp-area" aria-label="Area demographics and amenities">
      <header className="sp-area__head">
        <p className="sp-weak">
          {property.city}, {property.state} · rings around the property
        </p>
        {area?.sample && (
          <Chip tone="warn" icon="warning" title={area.source}>
            Sample data
          </Chip>
        )}
      </header>

      {loading || !area ? (
        <Skeleton />
      ) : (
        <>
          {area.sample && <p className="sp-area__sample">{area.source}</p>}
          <table className="sp-area-table">
            <caption className="sp-sr-only">Demographics by distance from the property</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sp-sr-only">Measure</span>
                </th>
                {rings.map((r) => (
                  <th scope="col" key={r.miles}>
                    {r.miles} mi
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {rings.map((r) => (
                    <td key={r.miles} className="sp-num">
                      {row.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="sp-label sp-area__sub">Nearby transit</h3>
          {area.transit.length === 0 ? (
            <p className="sp-weak">No stops within half a mile.</p>
          ) : (
            <ul className="sp-area-transit">
              {area.transit.map((t) => (
                <li key={`${t.name}-${t.distanceMi}`}>
                  <Icon name={t.type === 'Rail' ? 'train' : 'people'} size={14} label={t.type} />
                  <span className="sp-area-transit__name">{t.name}</span>
                  <span className="sp-num sp-weak">{t.distanceMi.toFixed(1)} mi</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="sp-label sp-area__sub">Amenities within ½ mile</h3>
          {area.amenities.length === 0 ? (
            <p className="sp-weak">None recorded.</p>
          ) : (
            <div className="sp-area-amenities">
              {area.amenities.map((a) => (
                <Chip key={a.category} count={a.count}>
                  {a.category}
                </Chip>
              ))}
            </div>
          )}

          <footer className="sp-area__foot">
            <p>Data: US Census Bureau ACS 5-year · OpenStreetMap</p>
            {!area.sample && <p className="sp-faint">{area.source}</p>}
            {area.sample && (
              <p className="sp-faint">
                Add <code>?live=1&amp;census=KEY</code> for live figures (free key at{' '}
                <a href="https://api.census.gov/data/key_signup.html" target="_blank" rel="noreferrer">
                  api.census.gov/data/key_signup.html
                </a>
                )
              </p>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
