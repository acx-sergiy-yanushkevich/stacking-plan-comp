import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Marker, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Polygon } from 'geojson';
import type { DataSource, FootprintResult } from '../../data/sources/DataSource';
import type { FloorView } from '../../domain/derive';
import { suiteExtrusionFeatures } from '../../domain/geometry';
import { placesAround, ringBounds, ringCoordinates, offset, WALK_MI, type Place } from '../../domain/places';
import type { Area } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import { isDark, paletteOf, type PlanState } from '../../state/planState';
import { usePrefersDark, usePrefersReducedMotion } from '../../lib/useMedia';
import { openFloor } from '../plan/actions';
import { Chip, Icon, Segmented, useToast } from '../ui';
import { num } from '../../domain/format';
import { categoryKey } from '../../domain/places';
import { areaRing, useAreaRing, type RingMiles } from './areaRing';
import { FilterBar } from '../stack/FilterBar';
import { FootprintFallback } from './FootprintFallback';
import { MapControls } from './MapControls';
import { BUILDINGS_DARK, BUILDINGS_LIGHT, CAMERA, CAMERA_3D, LAYER_BUILDINGS, LAYER_FLOORS, SOURCE_FLOORS, dominantTone, guardedFilter, resolveVarHex, toFloorFeatures, type FloorFeatureCollection } from './mapStyle';
import { placeHighlight, placeLook, usePlaceHighlight } from './placeHighlight';
import { useMapLibre } from './useMapLibre';
import { usePresent } from './usePresent';
import { useRecorder } from './useRecorder';
import { RECORD_REQUEST } from './recordSignal';
import { cancelFrame, createElement, requestFrame } from '../../lib/host';
import './map.css';

export interface MapViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  dataSource: DataSource;
  /** The area around the building (App's `useArea`): its stops and places are pinned, its rings drawn. */
  area: Area | null;
}

/** The building is drawn 1.5 % larger than the OSM footprint so it never z-fights the tiles' own extrusion. */
const INFLATE = 1.015;
/** The rings the Area figures are counted in: the map draws and frames the chosen one (`areaRing`). */
const RINGS: RingMiles[] = [1, 3, 5];
/** A transit kind's key: the key's Bus or Rail item lights every stop of that kind. */
export const kindKey = (group: string) => `kind:${group}`;
const SOURCE_RINGS = 'sp-rings';
const LAYER_RING_FILL = 'sp-rings-fill';
const LAYER_RING_LINE = 'sp-rings-line';

interface LayerInputs {
  features: FloorFeatureCollection;
  rings: FeatureCollection<Polygon, { miles: number }>;
  brandHex: string;
  dark: boolean;
}

/** Rings at the half mile and the mile, as GeoJSON lines (and the half mile as a faint disc). */
function ringFeatures(center: { lat: number; lng: number }, outer: number): FeatureCollection<Polygon, { miles: number }> {
  return {
    type: 'FeatureCollection',
    features: [WALK_MI, outer].map((miles) => ({
      type: 'Feature',
      properties: { miles },
      geometry: { type: 'Polygon', coordinates: [ringCoordinates(center, miles)] },
    })),
  };
}

/** The neighbourhood, the rings and the building, added to a freshly loaded style. */
function installLayers(map: MapLibreMap, inp: LayerInputs) {
  const style = map.getStyle();
  if (!style) return;
  // Above every fill and line layer (roads, footprints) and under the labels.
  let lastFlat = -1;
  style.layers.forEach((l, i) => {
    if (l.type === 'fill' || l.type === 'line' || l.type === 'background' || l.type === 'raster' || l.type === 'hillshade') lastFlat = i;
  });
  const firstSymbol = style.layers[lastFlat + 1]?.id;
  // The dark basemap ships its own 3D buildings in black: hide them and draw the neighbourhood with ours.
  for (const l of style.layers) {
    if (l.type === 'fill-extrusion' && l.id !== LAYER_FLOORS && l.id !== LAYER_BUILDINGS) map.setLayoutProperty(l.id, 'visibility', 'none');
  }
  // The basemap compares a property some features lack (road shields by `ref_length`): give those filters a
  // fallback that leaves the same features out, so the console stays clean.
  for (const l of style.layers) {
    if (!('filter' in l) || !l.filter || l.id === LAYER_FLOORS || l.id === LAYER_BUILDINGS) continue;
    const safe = guardedFilter(l.filter);
    if (safe !== l.filter) map.setFilter(l.id, safe);
  }
  map.setLight({ anchor: 'viewport', position: [1.2, 210, 30], intensity: 0.18, color: '#ffffff' });
  const vectorSource = map.getSource('openmaptiles') ? 'openmaptiles' : Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];

  if (!map.getSource(SOURCE_RINGS)) map.addSource(SOURCE_RINGS, { type: 'geojson', data: inp.rings });
  if (!map.getLayer(LAYER_RING_FILL)) {
    map.addLayer(
      { id: LAYER_RING_FILL, type: 'fill', source: SOURCE_RINGS, filter: ['==', ['get', 'miles'], WALK_MI], paint: { 'fill-color': inp.brandHex, 'fill-opacity': inp.dark ? 0.1 : 0.06 } },
      firstSymbol,
    );
  }
  if (vectorSource && !map.getLayer(LAYER_BUILDINGS)) {
    map.addLayer(
      {
        id: LAYER_BUILDINGS,
        type: 'fill-extrusion',
        source: vectorSource,
        'source-layer': 'building',
        minzoom: 13,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': inp.dark ? BUILDINGS_DARK : BUILDINGS_LIGHT,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          // Quieter than the property, so the building is the subject.
          'fill-extrusion-opacity': inp.dark ? 0.55 : 0.4,
        },
      },
      firstSymbol,
    );
  }
  if (!map.getSource(SOURCE_FLOORS)) map.addSource(SOURCE_FLOORS, { type: 'geojson', data: inp.features });
  if (!map.getLayer(LAYER_FLOORS)) {
    // The building in one colour: its height among its neighbours, not its floors (they are the Building tab's).
    map.addLayer(
      {
        id: LAYER_FLOORS,
        type: 'fill-extrusion',
        source: SOURCE_FLOORS,
        paint: { 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-color': inp.brandHex, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false },
      },
      firstSymbol,
    );
  }
  if (!map.getLayer(LAYER_RING_LINE)) {
    map.addLayer(
      {
        id: LAYER_RING_LINE,
        type: 'line',
        source: SOURCE_RINGS,
        paint: { 'line-color': inp.brandHex, 'line-width': ['case', ['==', ['get', 'miles'], WALK_MI], 2, 1.5], 'line-dasharray': [3, 2], 'line-opacity': 0.85 },
      },
      firstSymbol,
    );
  }
}

/** Google's own links (Maps URLs): free, no key, for the client who wants directions or a look at the entrance. */
const googleMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const streetView = (lat: number, lng: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

/** "0.2 mi" for a stop or a place: a tenth of a mile is as close as the source is. */
const miText = (d: number) => `${d.toFixed(1)} mi`;

interface Pinned {
  place: Place;
  el: HTMLElement;
}

/**
 * Map view (DESIGN.md §2.6): where the building is and what is around it. A top-down map framed on the half-mile
 * and one-mile rings, the building in the brand colour, and the area's transit stops and places pinned; the Area
 * panel beside it lists the same places, and a row lights its pins. 3D shows the building's height among its
 * neighbours, in one colour: its floors are the Building tab's. Present orbits it; Record films that.
 */
export default function MapView({ model, state, patch, dataSource, area }: MapViewProps) {
  const { property, floors } = model;
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersDark = usePrefersDark();
  const reducedMotion = usePrefersReducedMotion();
  const dark = isDark(state, prefersDark);
  const toast = useToast();

  // Live footprint (OSM via Overpass) when ?live=1; otherwise the cached polygon.
  const [live, setLive] = useState<FootprintResult | null>(null);
  useEffect(() => {
    if (!state.live) {
      setLive(null);
      return;
    }
    let alive = true;
    dataSource.getFootprint(property).then((r) => alive && setLive(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [state.live, dataSource, property]);
  const mapProperty = useMemo(() => (live ? { ...property, footprint: live.polygon, footprintSource: live.source } : property), [property, live]);
  const center = property.location;

  const features = useMemo(() => toFloorFeatures(suiteExtrusionFeatures(mapProperty, floors, () => 'neutral', property.floorHeightFt), INFLATE), [mapProperty, floors, property.floorHeightFt]);
  // The outer ring is the one chosen on the map's switch (and followed by the Area panel): 1, 3 or 5 miles.
  const miles = useAreaRing();
  const rings = useMemo(() => ringFeatures(center, miles), [center, miles]);
  const people = area?.rings.find((r) => r.miles === miles)?.population ?? null;
  const places = useMemo(() => (area ? placesAround(property.id, center, area) : []), [area, property.id, center]);

  // The brand colour from the tokens, re-read after a change of theme, palette or skin has reached the DOM.
  const palette = paletteOf(state);
  const skin = state.skin ?? null;
  const [brandHex, setBrandHex] = useState('#0176d3');
  useEffect(() => {
    let second: number | null = null;
    const read = () => setBrandHex(resolveVarHex('--sp-color-brand', '#0176d3'));
    // The app writes the palette and the theme to the root in its own effects, which run after this one.
    const first = requestFrame(() => {
      read();
      second = requestFrame(read);
    });
    return () => {
      cancelFrame(first);
      cancelFrame(second);
    };
  }, [dark, palette, skin]);

  const inputsRef = useRef<LayerInputs>({ features, rings, brandHex, dark });
  inputsRef.current = { features, rings, brandHex, dark };
  const onStyleLoad = useCallback((m: MapLibreMap) => installLayers(m, inputsRef.current), []);
  const { map, status } = useMapLibre(containerRef, { center, dark, onStyleLoad });

  useEffect(() => {
    (map?.getSource(SOURCE_FLOORS) as GeoJSONSource | undefined)?.setData(features);
  }, [map, features]);
  useEffect(() => {
    (map?.getSource(SOURCE_RINGS) as GeoJSONSource | undefined)?.setData(rings);
  }, [map, rings]);
  useEffect(() => {
    if (!map) return;
    if (map.getLayer(LAYER_FLOORS)) map.setPaintProperty(LAYER_FLOORS, 'fill-extrusion-color', brandHex);
    if (map.getLayer(LAYER_RING_LINE)) map.setPaintProperty(LAYER_RING_LINE, 'line-color', brandHex);
    if (map.getLayer(LAYER_RING_FILL)) map.setPaintProperty(LAYER_RING_FILL, 'fill-color', brandHex);
  }, [map, brandHex]);

  // The camera: top-down, framed on the mile; 3D leans in on the building.
  const viewRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const duration = reducedMotion ? 0 : 600;
  // The frame keeps the rings clear of the card: beside it on a wide map, under it on a narrow one, where the
  // card spans the top (round 24: on a phone its links covered the "1 mi" label).
  const padding = useCallback(() => {
    const narrow = (viewRef.current?.clientWidth ?? 1000) < 720;
    return { top: narrow && infoRef.current ? infoRef.current.offsetHeight + 44 : 64, bottom: 28, left: 28, right: 56 };
  }, []);
  const frame = useCallback(
    (animate: boolean) => map?.fitBounds(ringBounds(center, miles), { padding: padding(), pitch: 0, bearing: 0, duration: animate ? duration : 0 }),
    [map, center, miles, padding, duration],
  );
  // The first frame is set at once; a ring chosen later is flown to.
  const framed = useRef(false);
  useEffect(() => {
    if (status !== 'ready') return;
    frame(framed.current);
    framed.current = true;
  }, [status, frame]);
  const threeD = useCallback(() => map?.easeTo({ center: [center.lng, center.lat], zoom: CAMERA_3D.zoom, pitch: CAMERA_3D.pitch, bearing: CAMERA_3D.bearing, duration }), [map, center, duration]);
  const [pitch, setPitch] = useState<number>(CAMERA.pitch);
  useEffect(() => {
    if (!map) return;
    const on = () => setPitch(map.getPitch());
    map.on('pitchend', on);
    return () => {
      map.off('pitchend', on);
    };
  }, [map]);
  const tilted = pitch > 5;

  // The building: a click opens its floors in the Building tab; a hover says so.
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const patchRef = useRef(patch);
  patchRef.current = patch;
  useEffect(() => {
    if (!map) return;
    const onMove = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';
      setTip({ x: e.point.x, y: e.point.y });
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      setTip(null);
    };
    const onClick = () => patchRef.current({ view: 'building' });
    map.on('mousemove', LAYER_FLOORS, onMove);
    map.on('mouseleave', LAYER_FLOORS, onLeave);
    map.on('click', LAYER_FLOORS, onClick);
    return () => {
      map.off('mousemove', LAYER_FLOORS, onMove);
      map.off('mouseleave', LAYER_FLOORS, onLeave);
      map.off('click', LAYER_FLOORS, onClick);
    };
  }, [map]);

  // Pins: one DOM marker per place, drawn by React through a portal so they share the app's icons and tokens.
  // They are not tab stops (there may be dozens): the Area panel's rows are the keyboard way to the same places.
  const [pinned, setPinned] = useState<Pinned[]>([]);
  const [labels, setLabels] = useState<{ el: HTMLElement; text: string }[]>([]);
  useEffect(() => {
    if (!map) return;
    const made: Marker[] = [];
    const mk = (lng: number, lat: number, anchor: 'center' | 'bottom') => {
      const el = createElement('div') ?? undefined;
      const marker = new Marker({ element: el, anchor }).setLngLat([lng, lat]).addTo(map);
      made.push(marker);
      // MapLibre names every marker "Map marker" and makes it a button: dozens of identical buttons for a
      // screen reader (round 24). The pins are pictures of what the Area panel's rows say; the rows are the way in.
      const node = marker.getElement();
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
      node.setAttribute('aria-hidden', 'true');
      return node;
    };
    setPinned(places.map((place) => ({ place, el: mk(place.lng, place.lat, 'center') })));
    const walk = offset(center, WALK_MI, 0);
    const outer = offset(center, miles, 0);
    setLabels([
      { el: mk(walk.lng, walk.lat, 'bottom'), text: '½ mi · 10-min walk' },
      // The ring says what is counted in it: the people of the Area panel's figures (round 25: an empty mile).
      { el: mk(outer.lng, outer.lat, 'bottom'), text: people !== null ? `${miles} mi · ${num(people)} people` : `${miles} mi` },
      { el: mk(center.lng, center.lat, 'bottom'), text: property.name },
    ]);
    return () => {
      made.forEach((m) => m.remove());
      setPinned([]);
      setLabels([]);
    };
  }, [map, places, center, property.name, miles, people]);
  const lit = usePlaceHighlight();
  useEffect(() => () => placeHighlight.set(null), []);
  const keyGroups = useMemo(() => {
    const out: { group: string; kind: Place['kind'] }[] = [];
    for (const t of ['Bus', 'Rail']) if (places.some((p) => p.group === t)) out.push({ group: t, kind: 'transit' });
    for (const a of [...(area?.amenities ?? [])].filter((x) => x.count > 0).sort((x, y) => y.count - x.count)) if (places.some((p) => p.group === a.category)) out.push({ group: a.category, kind: 'amenity' });
    return out;
  }, [places, area]);
  // A stop outside the frame (a rail station three miles out) is brought into view with the building when its
  // row is lit, and the mile frame comes back when the row is let go (round 24: its pin lit off screen).
  const widened = useRef(false);
  useEffect(() => {
    if (!map) return;
    const stop = lit ? places.find((p) => p.kind === 'transit' && p.key === lit) : undefined;
    if (stop && !map.getBounds().contains([stop.lng, stop.lat])) {
      const box: [[number, number], [number, number]] = [
        [Math.min(center.lng, stop.lng), Math.min(center.lat, stop.lat)],
        [Math.max(center.lng, stop.lng), Math.max(center.lat, stop.lat)],
      ];
      // Room at the sides for the building's name, which hangs over its pin.
      map.fitBounds(box, { padding: { ...padding(), bottom: 56, left: 140, right: 140 }, pitch: 0, bearing: 0, maxZoom: 15, duration });
      widened.current = true;
    } else if (!lit && widened.current) {
      widened.current = false;
      frame(true);
    }
  }, [map, lit, places, center, padding, duration, frame]);

  const present = usePresent({ map, enabled: !reducedMotion, onStart: threeD });
  const notify = useCallback((message: string, icon?: 'video' | 'warning' | 'download') => toast.push(message, { icon }), [toast]);
  const recorder = useRecorder({ map, onStart: present.start, onStop: present.stop, notify });
  // "Record video" in the header's Export menu starts a recording, or stops the one under way.
  const toggleRecording = recorder.toggle;
  useEffect(() => RECORD_REQUEST.on(toggleRecording), [toggleRecording]);

  const toneOf = useCallback((f: FloorView) => dominantTone(f, state.lens, state.safe), [state.lens, state.safe]);
  const selectFloor = useCallback((id: string) => openFloor(patch, id), [patch]);
  const footprintLabel = mapProperty.footprintSource === 'osm' ? 'OpenStreetMap' : 'demo';
  const samplePlaces = !!area?.sample && places.length > 0;

  return (
    <div className={`sp-map ${status === 'failed' ? 'is-fallback' : ''} ${lit ? 'has-lit' : ''}`.replace(/ +/g, ' ').trim()} data-status={status}>
      {/* A search, a requirement or a worklist is answered in suites: the bar says so and takes the user to the plan. */}
      {model.filterLabel && <FilterBar label={model.filterLabel} find={model.queryFind} planElsewhere patch={patch} />}
      {/* The map's key, above it and never over it: what each mark means, and the ring to draw. Pointing at an item
          lights its pins, as the Area panel's rows do (round 25: the marks had no key on the map itself). */}
      <div className="sp-map-key" role="group" aria-label="Map key">
        <span className="sp-map-key__item">
          <i className="sp-map-key__building" aria-hidden="true" />
          Building
        </span>
        <span className="sp-map-key__item">
          <i className="sp-map-key__walk" aria-hidden="true" />½ mi walk
        </span>
        {/* The ring's switch is part of its key: which ring is drawn, and how many people live inside it. */}
        <span className="sp-map-key__item sp-map-key__item--ring">
          <i className="sp-map-key__ring" aria-hidden="true" />
          Ring
          <Segmented aria-label="Ring around the building" className="sp-map-key__switch" options={RINGS.map((r) => ({ id: String(r), label: `${r} mi` }))} value={String(miles)} onChange={(id) => areaRing.set(Number(id) as RingMiles)} />
          {people !== null && <span className="sp-num">{num(people)} people</span>}
        </span>
        {keyGroups.map(({ group, kind }) => {
          const look = placeLook(group);
          const key = kind === 'transit' ? kindKey(group) : categoryKey(group);
          return (
            <span
              key={group}
              className={`sp-map-key__item sp-map-key__item--place ${lit === key ? 'is-lit' : ''}`.trim()}
              tabIndex={0}
              aria-label={`${group}: light ${kind === 'transit' ? 'these stops' : 'these places'} on the map`}
              onMouseEnter={() => placeHighlight.set(key)}
              onFocus={() => placeHighlight.set(key)}
              onMouseLeave={() => placeHighlight.get() === key && placeHighlight.set(null)}
              onBlur={() => placeHighlight.get() === key && placeHighlight.set(null)}
            >
              {look.icon ? (
                <i className="sp-map-key__stop" aria-hidden="true">
                  <Icon name={look.icon} size={10} />
                </i>
              ) : (
                <i className={`sp-place-dot sp-place-dot--${look.cls}`} aria-hidden="true" />
              )}
              {group}
            </span>
          );
        })}
      </div>
      <div className="sp-map__view" ref={viewRef}>
        <div ref={containerRef} className="sp-map__canvas" aria-label={`Map of the area around ${property.name}: the half-mile and one-mile rings, transit stops and places nearby. The Area panel lists them.`} role="application" />
        {status === 'failed' && <FootprintFallback footprint={mapProperty.footprint} floors={floors} toneOf={toneOf} selectedFloorId={state.floor} onSelect={selectFloor} />}

        <div className="sp-map-overlay sp-map-info" ref={infoRef}>
          <h2 className="sp-map-info__name">{property.name}</h2>
          <p className="sp-weak">
            {property.street}, {property.city}, {property.state}
          </p>
          <p className="sp-map-info__meta">
            <span className="sp-map-info__footprint">
              Footprint: {footprintLabel} <Chip tone={mapProperty.footprintSource === 'osm' ? 'success' : 'neutral'}>{mapProperty.footprintSource === 'osm' ? 'OSM' : 'demo'}</Chip>
            </span>
            {samplePlaces && (
              <Chip tone="neutral" title="The demo building's places are drawn at sample positions inside the distance they were counted in">
                Sample places
              </Chip>
            )}
          </p>
          <p className="sp-map-info__links">
            <button type="button" className="sp-linkbtn" onClick={() => patch({ view: 'building' })}>
              See its floors <Icon name="chevron-right" size={12} />
            </button>
            <a href={googleMaps(center.lat, center.lng)} target="_blank" rel="noopener noreferrer">
              Google Maps <Icon name="external" size={12} />
            </a>
            <a href={streetView(center.lat, center.lng)} target="_blank" rel="noopener noreferrer">
              Street View <Icon name="external" size={12} />
            </a>
          </p>
        </div>

        {status === 'ready' && (
          <MapControls
            onZoomIn={() => map?.zoomIn()}
            onZoomOut={() => map?.zoomOut()}
            onCompass={() => frame(true)}
            onTilt={() => (tilted ? frame(true) : threeD())}
            tilted={tilted}
            presenting={present.presenting}
            onPresent={present.toggle}
            presentDisabledReason={reducedMotion ? 'Present is off because your system prefers reduced motion' : null}
            recording={recorder.recording}
            onRecord={recorder.toggle}
          />
        )}

        {tip && status === 'ready' && (
          <div className="sp-map-tip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="tooltip">
            {property.name} · click to see its floors
          </div>
        )}
        {present.presenting && (
          <div className="sp-map-overlay sp-map-present" role="status" aria-live="polite">
            Presenting
          </div>
        )}
      </div>
      {pinned.map(({ place, el }) => {
        const look = placeLook(place.group);
        const on = lit === place.key || lit === kindKey(place.group);
        return createPortal(
          <span
            className={`sp-pin sp-pin--${look.cls} ${place.kind === 'transit' ? 'sp-pin--stop' : ''} ${on ? 'is-lit' : ''}`.replace(/ +/g, ' ').trim()}
            data-label={`${place.name} · ${miText(place.distanceMi)}`}
            aria-hidden="true"
            onClick={() => placeHighlight.set(on ? null : place.key)}
          >
            {look.icon ? <Icon name={look.icon} size={11} /> : look.letter}
          </span>,
          el,
          place.id,
        );
      })}
      {labels.map(({ el, text }, i) =>
        createPortal(
          i === labels.length - 1 ? (
            <span className="sp-map-label sp-map-label--building" aria-hidden="true">
              {text}
            </span>
          ) : (
            <span className="sp-map-label" aria-hidden="true">
              {text}
            </span>
          ),
          el,
          `label-${i}`,
        ),
      )}
    </div>
  );
}
