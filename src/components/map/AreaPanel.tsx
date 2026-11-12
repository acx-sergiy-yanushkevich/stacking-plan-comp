import { useEffect, useRef, type FocusEvent, type MouseEvent } from 'react';
import { areaCredit, compareRing, US_BENCHMARK } from '../../domain/areaBrief';
import { inMiles, mi, num, ringName } from '../../domain/format';
import { categoryKey, stopKey } from '../../domain/places';
import type { Area } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import { LocationBrief } from '../area/LocationBrief';
import { Chip, Icon, Segmented } from '../ui';
import { placeHighlight, placeLook, usePlaceHighlight } from './placeHighlight';
import type { RingMiles } from '../../state/planState';
import '../area/area.css';
import './map.css';

export interface AreaPanelProps {
  model: PlanModel;
  /** The area around the property (App's `useArea`): null while the data source answers. */
  area: Area | null;
  /** Widened to the full page (`mode=brief`): the location brief instead of the charts. */
  expanded?: boolean;
  /**
   * Beside the Map: each amenity and stop row is a tab stop that lights its pins on the map, on hover or focus,
   * and a pin clicked on the map lights its row. The rows are the keyboard way to the places the map pins.
   */
  onMap?: boolean;
  /** The ring compared with the US (`ring` in the address): the Map draws it, and the panel's switch sets it. */
  ring?: RingMiles;
  onRing?: (ring: RingMiles) => void;
}

/** How many recorded places a category row names before "and N more". */
const NAMED = 3;

/** Hover or focus lights a row's pins; leaving it puts them out, unless another row took over meanwhile. */
function linkProps(key: string, onMap: boolean | undefined, label: string) {
  if (!onMap) return {};
  const on = () => placeHighlight.set(key);
  const off = (e: MouseEvent | FocusEvent) => {
    if (placeHighlight.get() === key && !(e.currentTarget as HTMLElement).matches(':focus-within')) placeHighlight.set(null);
  };
  return { tabIndex: 0, 'data-place': key, 'aria-label': label, onMouseEnter: on, onFocus: on, onMouseLeave: off, onBlur: () => placeHighlight.get() === key && placeHighlight.set(null) };
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


/**
 * Inspector "Area" mode (DESIGN.md §2.6): the area around the building as charts. Population by
 * distance; one ring compared with the US (a bar for the ring, a tick for the US, both figures in
 * text); amenities within half a mile; nearby transit. Widened by the panel's Expand toggle, it is the
 * location brief: the same area as a page to show a client or decision maker. Sample figures are
 * flagged until a Census key is given.
 */
export function AreaPanel({ model, area, expanded, onMap, ring: chosen = 1, onRing }: AreaPanelProps) {
  const { property } = model;
  const lit = usePlaceHighlight();
  // A pin clicked on the map brings its row into view.
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!onMap || !lit) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-place="${CSS.escape(lit)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [lit, onMap]);
  const rings = area ? [...area.rings].sort((a, b) => a.miles - b.miles) : [];
  // One ring for the page (`ring` in the address): the Map's key sets it beside the map, this panel's switch elsewhere.
  const miles = chosen;
  const ring = rings.find((r) => r.miles === miles) ?? rings[0];
  const mostPeople = Math.max(1, ...rings.map((r) => r.population));
  const amenities = area ? [...area.amenities].filter((a) => a.count > 0).sort((a, b) => b.count - a.count) : [];
  const mostAmenity = amenities[0]?.count ?? 1;

  if (expanded) {
    return <section className="sp-area sp-area--wide" aria-label="Location brief">{area ? <LocationBrief property={property} area={area} /> : <Skeleton />}</section>;
  }

  // The panel's four parts, built once and laid out in the order the place calls for.
  const sections =
    area && ring
      ? {
          people: (
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
          ),
          compare: (
      <div>
        <div className="sp-area__compare-head">
          <h3 className="sp-label">Compared with the US</h3>
          {/* Beside the map the ring is chosen on the map: the key under this heading names it. */}
          {!onMap && <Segmented aria-label="Distance compared with the US" options={rings.map((r) => ({ id: String(r.miles), label: `${r.miles} mi` }))} value={String(ring.miles)} onChange={(id) => onRing?.(Number(id) as RingMiles)} />}
        </div>
        <p className="sp-area__key">
          <span>
            <i className="sp-area__key-bar" aria-hidden="true" />
            within {ringName(ring.miles)}
            {onMap ? ', the ring on the map' : ''}
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
          ),
          places: (
      <div>
        <h3 className="sp-label sp-area__sub">Amenities within ½ mile</h3>
        {amenities.length === 0 ? (
          <p className="sp-weak">None recorded.</p>
        ) : (
          <ul className="sp-brief__bars">
            {amenities.map((a) => {
              // Live data names its places: the nearest few under the row and in its name, so what a pin says on hover
              // is not the pointer's alone (round 25). Sample data has no names to give, and none are made up.
              const recorded = (area.places ?? []).filter((p) => p.category === a.category).sort((x, y) => x.distanceMi - y.distanceMi);
              const named = recorded.slice(0, NAMED);
              const more = recorded.length - named.length;
              const shown = named.map((p) => `${p.name} ${mi(p.distanceMi)}`).concat(more > 0 ? [`${num(more)} more`] : []).join(' · ');
              const spoken = named.length ? `; the nearest ${named.map((p) => `${p.name}, ${inMiles(p.distanceMi)}`).join('; ')}${more > 0 ? `; and ${num(more)} more` : ''}` : '';
              return (
              <li
                key={a.category}
                className={`sp-brief__bar ${onMap ? 'sp-area__place' : ''} ${lit === categoryKey(a.category) ? 'is-lit' : ''}`.replace(/ +/g, ' ').trim()}
                title={`${a.category}: ${a.count} within half a mile`}
                {...linkProps(categoryKey(a.category), onMap, `${a.category}: ${num(a.count)} within half a mile${spoken}, pinned on the map`)}
              >
                <span className="sp-brief__bar-name">
                  {onMap && <i className={`sp-place-dot sp-place-dot--${placeLook(a.category).cls}`} aria-hidden="true" />}
                  {a.category}
                </span>
                <span className="sp-brief__bar-track" aria-hidden="true">
                  <span className="sp-brief__bar-fill" style={{ width: `${(a.count / mostAmenity) * 100}%` }} />
                </span>
                <span className="sp-brief__bar-value">{num(a.count)}</span>
                {named.length > 0 && <span className="sp-area__names">{shown}</span>}
              </li>
              );
            })}
          </ul>
        )}
      </div>
          ),
          stops: (
      <div>
        <h3 className="sp-label sp-area__sub">Nearby transit</h3>
        {area.transit.length === 0 ? (
          <p className="sp-weak">No stops on record.</p>
        ) : (
          <ul className="sp-area-transit">
            {[...area.transit]
              .sort((a, b) => a.distanceMi - b.distanceMi)
              .map((t) => (
                <li
                  key={`${t.name}-${t.distanceMi}`}
                  className={`${onMap ? 'sp-area__place' : ''} ${lit === stopKey(t.name) ? 'is-lit' : ''}`.trim() || undefined}
                  {...linkProps(stopKey(t.name), onMap, `${t.name}, ${t.type === 'Rail' ? 'rail' : 'bus'}, ${inMiles(t.distanceMi)}, pinned on the map`)}
                >
                  {/* The kind of stop is a word as well as an icon: bus and rail are not told apart by the drawing alone. */}
              <Icon name={t.type === 'Rail' ? 'train' : 'bus'} size={14} />
                  <span className="sp-area-transit__name">{t.name}</span>
              <span className="sp-transit-kind">{t.type === 'Rail' ? 'Rail' : 'Bus'}</span>
                  <span className="sp-num sp-weak">{mi(t.distanceMi)}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
          ),
        }
      : null;

  return (
    <section className="sp-area" aria-label="Area demographics and amenities" ref={rootRef}>
      <header className="sp-area__head">
        <p className="sp-weak">
          Rings around the property
        </p>
        {area?.sample && (
          <Chip tone="neutral" title={area.source}>
            Sample figures
          </Chip>
        )}
      </header>

      {!area || !ring ? (
        <Skeleton />
      ) : (
        <>
          {/* Beside the Map its key comes first: the stops and the places it pins, then the people around it. */}
          {onMap ? (
            <>
              {sections!.stops}
              {sections!.places}
              {sections!.people}
              {sections!.compare}
            </>
          ) : (
            <>
              {sections!.people}
              {sections!.compare}
              {sections!.places}
              {sections!.stops}
            </>
          )}

          <footer className="sp-area__foot">
            {/* Sample figures say so first; only live figures are credited to the Census. How to turn live
                mode on is for the team (docs), not for a client looking at this panel. */}
            <p>{areaCredit(area)}</p>
            <p className="sp-faint">{US_BENCHMARK.source}</p>
          </footer>
        </>
      )}
    </section>
  );
}
