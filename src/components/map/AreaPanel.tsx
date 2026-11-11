import { useState } from 'react';
import { compareRing, US_BENCHMARK } from '../../domain/areaBrief';
import { num } from '../../domain/format';
import type { Area } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import { LocationBrief } from '../area/LocationBrief';
import { Chip, Icon, Segmented } from '../ui';
import '../area/area.css';
import './map.css';

export interface AreaPanelProps {
  model: PlanModel;
  /** The area around the property (App's `useArea`): null while the data source answers. */
  area: Area | null;
  /** Widened to the full page (`mode=brief`): the location brief instead of the charts. */
  expanded?: boolean;
}

function Skeleton() {
  return (
    <div className="sp-area-skeleton" aria-busy="true" aria-label="Loading area data">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="sp-skel" style={{ width: `${92 - (i % 3) * 14}%` }} />
      ))}
    </div>
  );
}

const ringName = (miles: number) => `${miles}\u00a0${miles === 1 ? 'mile' : 'miles'}`;

/**
 * Inspector "Area" mode (DESIGN.md §2.6): the area around the building as charts. Population by
 * distance; one ring compared with the US (a bar for the ring, a tick for the US, both figures in
 * text); amenities within half a mile; nearby transit. Widened by the panel's Expand toggle, it is the
 * location brief: the same area as a page to show a client or decision maker. Sample figures are
 * flagged until a Census key is given.
 */
export function AreaPanel({ model, area, expanded }: AreaPanelProps) {
  const { property } = model;
  const rings = area ? [...area.rings].sort((a, b) => a.miles - b.miles) : [];
  const [miles, setMiles] = useState<number | null>(null);
  const ring = rings.find((r) => r.miles === miles) ?? rings[0];
  const mostPeople = Math.max(1, ...rings.map((r) => r.population));
  const amenities = area ? [...area.amenities].filter((a) => a.count > 0).sort((a, b) => b.count - a.count) : [];
  const mostAmenity = amenities[0]?.count ?? 1;

  if (expanded) {
    return <section className="sp-area sp-area--wide" aria-label="Location brief">{area ? <LocationBrief property={property} area={area} /> : <Skeleton />}</section>;
  }

  return (
    <section className="sp-area" aria-label="Area demographics and amenities">
      <header className="sp-area__head">
        <p className="sp-weak">
          Rings around the property
        </p>
        {area?.sample && (
          <Chip tone="warn" icon="warning" title={area.source}>
            Sample data
          </Chip>
        )}
      </header>

      {!area || !ring ? (
        <Skeleton />
      ) : (
        <>
          <div>
            <h3 className="sp-label sp-area__sub">Population by distance</h3>
            <ul className="sp-brief__bars">
              {rings.map((r) => (
                <li key={r.miles} className="sp-brief__bar" title={`${num(r.population)} people and ${num(r.households)} households within ${ringName(r.miles)}`}>
                  <span className="sp-brief__bar-name">{ringName(r.miles)}</span>
                  <span className="sp-brief__bar-track" aria-hidden="true">
                    <span className="sp-brief__bar-fill" style={{ width: `${(r.population / mostPeople) * 100}%` }} />
                  </span>
                  <span className="sp-brief__bar-value">{num(r.population)}</span>
                  <span className="sp-area__households">{num(r.households)} households</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="sp-area__compare-head">
              <h3 className="sp-label">Compared with the US</h3>
              <Segmented aria-label="Distance compared with the US" options={rings.map((r) => ({ id: String(r.miles), label: `${r.miles} mi` }))} value={String(ring.miles)} onChange={(id) => setMiles(Number(id))} />
            </div>
            <p className="sp-area__key">
              <span>
                <i className="sp-area__key-bar" aria-hidden="true" />
                within {ringName(ring.miles)}
              </span>
              <span>
                <i className="sp-area__key-tick" aria-hidden="true" />
                US
              </span>
            </p>
            <ul className="sp-area-meters">
              {compareRing(ring).map((c) => {
                const top = Math.max(c.raw, c.usRaw) * 1.2;
                return (
                  <li key={c.measure} className="sp-area-meter" title={`${c.label}: ${c.value} within ${ringName(ring.miles)}, US ${c.us}: ${c.delta}`}>
                    <div className="sp-area-meter__top">
                      <span>
                        {c.label} <b className="sp-num">{c.value}</b>
                      </span>
                      <span className="sp-area-meter__us sp-num">US {c.us}</span>
                    </div>
                    <div className="sp-area-meter__track" aria-hidden="true">
                      <span className="sp-area-meter__fill" style={{ width: `${(c.raw / top) * 100}%` }} />
                      <span className="sp-area-meter__tick" style={{ left: `${(c.usRaw / top) * 100}%` }} />
                    </div>
                    <div className="sp-area-meter__delta">{c.delta}</div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="sp-label sp-area__sub">Amenities within ½ mile</h3>
            {amenities.length === 0 ? (
              <p className="sp-weak">None recorded.</p>
            ) : (
              <ul className="sp-brief__bars">
                {amenities.map((a) => (
                  <li key={a.category} className="sp-brief__bar" title={`${a.category}: ${a.count} within half a mile`}>
                    <span className="sp-brief__bar-name">{a.category}</span>
                    <span className="sp-brief__bar-track" aria-hidden="true">
                      <span className="sp-brief__bar-fill" style={{ width: `${(a.count / mostAmenity) * 100}%` }} />
                    </span>
                    <span className="sp-brief__bar-value">{num(a.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="sp-label sp-area__sub">Nearby transit</h3>
            {area.transit.length === 0 ? (
              <p className="sp-weak">No stops on record.</p>
            ) : (
              <ul className="sp-area-transit">
                {[...area.transit]
                  .sort((a, b) => a.distanceMi - b.distanceMi)
                  .map((t) => (
                    <li key={`${t.name}-${t.distanceMi}`}>
                      {/* The kind of stop is a word as well as an icon: bus and rail are not told apart by the drawing alone. */}
                  <Icon name={t.type === 'Rail' ? 'train' : 'bus'} size={14} />
                      <span className="sp-area-transit__name">{t.name}</span>
                  <span className="sp-transit-kind">{t.type === 'Rail' ? 'Rail' : 'Bus'}</span>
                      <span className="sp-num sp-weak">{t.distanceMi.toFixed(1)} mi</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <footer className="sp-area__foot">
            {/* Sample figures say so first; only live figures are credited to the Census. How to turn live
                mode on is for the team (docs), not for a client looking at this panel. */}
            <p>{area.sample ? area.source : `Area figures: ${area.source}. Amenities and transit: OpenStreetMap.`}</p>
            <p className="sp-faint">{US_BENCHMARK.source}</p>
          </footer>
        </>
      )}
    </section>
  );
}
