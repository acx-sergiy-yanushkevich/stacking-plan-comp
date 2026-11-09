import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DataSource, FootprintResult } from '../../data/sources/DataSource';
import type { FloorView } from '../../domain/derive';
import { num, pct } from '../../domain/format';
import { suiteExtrusionFeatures } from '../../domain/geometry';
import { toneFor } from '../../domain/lenses';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { usePrefersDark, usePrefersReducedMotion } from '../../lib/useMedia';
import { openFloor, openFloorPlate } from '../plan/actions';
import { Legend } from '../plan/Legend';
import { Chip, useToast } from '../ui';
import { FootprintFallback } from './FootprintFallback';
import { MapControls } from './MapControls';
import {
  BUILDINGS_DARK,
  BUILDINGS_LIGHT,
  CAMERA,
  LAYER_BUILDINGS,
  LAYER_CAP,
  LAYER_FLOORS,
  SOURCE_FLOORS,
  dominantTone,
  floorColorExpression,
  resolveToneHex,
  resolveVarHex,
  toFloorFeatures,
  type FloorFeatureCollection,
} from './mapStyle';
import { useMapLibre } from './useMapLibre';
import { usePresent } from './usePresent';
import { useRecorder } from './useRecorder';
import '../plan/plan.css';
import './map.css';

export interface MapViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  dataSource: DataSource;
}

/** Floors are drawn 1.5 % larger than the OSM footprint so they never z-fight the tiles' own extrusion. */
const INFLATE = 1.015;
const CAP_M = 0.35;
const NO_FLOOR: FilterSpecification = ['==', ['get', 'floorId'], '__none__'];

interface LayerInputs {
  features: FloorFeatureCollection;
  hexByTone: Record<string, string>;
  brandHex: string;
  dark: boolean;
  selected: string | null;
}

const capFilter = (floorId: string | null): FilterSpecification => (floorId ? ['==', ['get', 'floorId'], floorId] : NO_FLOOR);

/** Add the surrounding-buildings layer, the floors source and both floor layers to a freshly loaded style. */
function installLayers(map: MapLibreMap, inp: LayerInputs) {
  const style = map.getStyle();
  if (!style) return;
  const firstSymbol = style.layers.find((l) => l.type === 'symbol')?.id;
  const vectorSource = map.getSource('openmaptiles') ? 'openmaptiles' : Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];

  if (vectorSource && !map.getLayer(LAYER_BUILDINGS)) {
    map.addLayer(
      {
        id: LAYER_BUILDINGS,
        type: 'fill-extrusion',
        source: vectorSource,
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': inp.dark ? BUILDINGS_DARK : BUILDINGS_LIGHT,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.55,
        },
      },
      firstSymbol,
    );
  }

  if (!map.getSource(SOURCE_FLOORS)) map.addSource(SOURCE_FLOORS, { type: 'geojson', data: inp.features });
  if (!map.getLayer(LAYER_FLOORS)) {
    map.addLayer(
      {
        id: LAYER_FLOORS,
        type: 'fill-extrusion',
        source: SOURCE_FLOORS,
        paint: {
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-color': floorColorExpression(inp.hexByTone),
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      firstSymbol,
    );
  }
  if (!map.getLayer(LAYER_CAP)) {
    map.addLayer(
      {
        id: LAYER_CAP,
        type: 'fill-extrusion',
        source: SOURCE_FLOORS,
        filter: capFilter(inp.selected),
        paint: {
          'fill-extrusion-base': ['get', 'height'],
          'fill-extrusion-height': ['+', ['get', 'height'], CAP_M],
          'fill-extrusion-color': inp.brandHex,
          'fill-extrusion-opacity': 1,
        },
      },
      firstSymbol,
    );
  }
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

const floorTip = (f: FloorView) => `${f.floor.name} · ${pct(f.leasable > 0 ? f.leased / f.leasable : 0)} leased · ${num(f.leasable)} RSF`;

/** Keyboard-reachable equivalent of clicking a 3D floor (DESIGN.md §6). */
function FloorList({ floors, selected, onSelect }: { floors: FloorView[]; selected: string | null; onSelect: (id: string) => void }) {
  const ordered = useMemo(() => [...floors].sort((a, b) => b.floor.sequence - a.floor.sequence), [floors]);
  const ref = useRef<HTMLDivElement>(null);
  const focusIndex = Math.max(
    0,
    ordered.findIndex((f) => f.floor.id === selected),
  );
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ordered.findIndex((f) => f.floor.id === (document.activeElement as HTMLElement | null)?.dataset.floor);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') next = Math.min(ordered.length - 1, i + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ordered.length - 1;
    else return;
    e.preventDefault();
    const target = ordered[next];
    onSelect(target.floor.id);
    ref.current?.querySelector<HTMLButtonElement>(`[data-floor="${target.floor.id}"]`)?.focus();
  };
  return (
    <div ref={ref} className="sp-map-floors" role="group" aria-label="Floors" onKeyDown={onKey}>
      {ordered.map((f, i) => (
        <button
          key={f.floor.id}
          type="button"
          data-floor={f.floor.id}
          className="sp-map-floor"
          aria-pressed={f.floor.id === selected}
          aria-label={floorTip(f)}
          title={floorTip(f)}
          tabIndex={i === focusIndex ? 0 : -1}
          onClick={() => onSelect(f.floor.id)}
          onDoubleClick={() => undefined}
        >
          {f.floor.sequence}
        </button>
      ))}
    </div>
  );
}

/**
 * Map view (DESIGN.md §2.6): the property extruded floor by floor over OpenFreeMap tiles,
 * coloured by the active lens; hover tooltips, click to select, double-click to drill in;
 * Present and Record; an SVG fallback when the map cannot load.
 */
export default function MapView({ model, state, patch, dataSource }: MapViewProps) {
  const { property, floors } = model;
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersDark = usePrefersDark();
  const reducedMotion = usePrefersReducedMotion();
  const dark = state.theme ? state.theme === 'dark' : prefersDark;
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

  const toneOf = useCallback((f: FloorView) => dominantTone(f, state.lens, state.safe), [state.lens, state.safe]);
  const toneOfSeg = useCallback((s: FloorView['segments'][number]) => toneFor(s, state.lens, state.safe), [state.lens, state.safe]);
  const features = useMemo(() => toFloorFeatures(suiteExtrusionFeatures(mapProperty, floors, toneOfSeg, property.floorHeightFt), INFLATE), [mapProperty, floors, toneOfSeg, property.floorHeightFt]);
  const toneKey = useMemo(() => [...new Set(features.features.map((f) => f.properties.tone))].sort().join(','), [features]);

  // Tone → hex from the CSS tokens, re-read after a theme change has reached the DOM.
  const [hexByTone, setHexByTone] = useState<Record<string, string>>({});
  const [brandHex, setBrandHex] = useState('#0176d3');
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const out: Record<string, string> = {};
      for (const t of toneKey.split(',').filter(Boolean)) out[t] = resolveToneHex(t);
      setHexByTone(out);
      setBrandHex(resolveVarHex('--sp-color-brand', '#0176d3'));
    });
    return () => cancelAnimationFrame(id);
  }, [toneKey, dark]);

  const inputsRef = useRef<LayerInputs>({ features, hexByTone, brandHex, dark, selected: state.floor });
  inputsRef.current = { features, hexByTone, brandHex, dark, selected: state.floor };
  const onStyleLoad = useCallback((m: MapLibreMap) => installLayers(m, inputsRef.current), []);
  const { map, status } = useMapLibre(containerRef, { center: property.location, dark, onStyleLoad });

  // Keep the floors source, colours and selection in step with the model.
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_FLOORS) as GeoJSONSource | undefined;
    src?.setData(features);
  }, [map, features]);
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_FLOORS)) return;
    map.setPaintProperty(LAYER_FLOORS, 'fill-extrusion-color', floorColorExpression(hexByTone));
    if (map.getLayer(LAYER_CAP)) map.setPaintProperty(LAYER_CAP, 'fill-extrusion-color', brandHex);
  }, [map, hexByTone, brandHex]);
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_FLOORS)) return;
    for (const f of features.features) map.setFeatureState({ source: SOURCE_FLOORS, id: f.id }, { selected: f.properties.floorId === state.floor });
    if (map.getLayer(LAYER_CAP)) map.setFilter(LAYER_CAP, capFilter(state.floor));
  }, [map, features, state.floor]);

  // Pointer interaction on the floors layer.
  const [tip, setTip] = useState<Tip | null>(null);
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  const patchRef = useRef(patch);
  patchRef.current = patch;
  useEffect(() => {
    if (!map) return;
    let hoverId: number | string | null = null;
    const clearHover = () => {
      if (hoverId !== null && map.getSource(SOURCE_FLOORS)) map.setFeatureState({ source: SOURCE_FLOORS, id: hoverId }, { hover: false });
      hoverId = null;
    };
    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.id === undefined) return;
      if (hoverId !== f.id) {
        clearHover();
        hoverId = f.id;
        map.setFeatureState({ source: SOURCE_FLOORS, id: f.id }, { hover: true });
      }
      map.getCanvas().style.cursor = 'pointer';
      const fv = floorsRef.current.find((x) => x.floor.id === f.properties.floorId);
      if (fv) setTip({ x: e.point.x, y: e.point.y, text: floorTip(fv) });
    };
    const onLeave = () => {
      clearHover();
      map.getCanvas().style.cursor = '';
      setTip(null);
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties.floorId as string | undefined;
      if (id) openFloor(patchRef.current, id);
    };
    const onDbl = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties.floorId as string | undefined;
      if (id) openFloorPlate(patchRef.current, id);
    };
    map.on('mousemove', LAYER_FLOORS, onMove);
    map.on('mouseleave', LAYER_FLOORS, onLeave);
    map.on('click', LAYER_FLOORS, onClick);
    map.on('dblclick', LAYER_FLOORS, onDbl);
    return () => {
      map.off('mousemove', LAYER_FLOORS, onMove);
      map.off('mouseleave', LAYER_FLOORS, onLeave);
      map.off('click', LAYER_FLOORS, onClick);
      map.off('dblclick', LAYER_FLOORS, onDbl);
    };
  }, [map]);

  // Camera state for the tilt toggle.
  const [pitch, setPitch] = useState<number>(CAMERA.pitch);
  useEffect(() => {
    if (!map) return;
    const on = () => setPitch(map.getPitch());
    map.on('pitchend', on);
    return () => {
      map.off('pitchend', on);
    };
  }, [map]);

  const present = usePresent({ map, today: model.today, patch, enabled: !reducedMotion });
  const notify = useCallback((message: string, icon?: 'video' | 'warning' | 'download') => toast.push(message, { icon }), [toast]);
  const recorder = useRecorder({ map, onStart: present.start, onStop: present.stop, notify });

  const selectFloor = useCallback((id: string) => openFloor(patch, id), [patch]);
  const floorCount = floors.length;
  const footprintLabel = mapProperty.footprintSource === 'osm' ? 'OpenStreetMap' : 'demo';

  return (
    <div className={`sp-map ${status === 'failed' ? 'is-fallback' : ''}`.trim()} data-status={status}>
      <div ref={containerRef} className="sp-map__canvas" aria-label="3D map of the property" role="application" />
      {status === 'failed' && <FootprintFallback footprint={mapProperty.footprint} floors={floors} toneOf={toneOf} selectedFloorId={state.floor} onSelect={selectFloor} />}

      <div className="sp-map-overlay sp-map-info">
        <h2 className="sp-map-info__name">{property.name}</h2>
        <p className="sp-weak">
          {property.street}, {property.city}, {property.state}
        </p>
        <p className="sp-map-info__meta">
          <span>
            Footprint: {footprintLabel} <Chip tone={mapProperty.footprintSource === 'osm' ? 'success' : 'neutral'}>{mapProperty.footprintSource === 'osm' ? 'OSM' : 'demo'}</Chip>
          </span>
          <span className="sp-num">
            {floorCount} floors · {property.floorHeightFt} ft each
          </span>
        </p>
      </div>

      <div className="sp-map-overlay sp-map-legend">
        <Legend items={model.legend} compact />
      </div>

      <FloorList floors={floors} selected={state.floor} onSelect={selectFloor} />

      {status === 'ready' && (
        <MapControls
          onZoomIn={() => map?.zoomIn()}
          onZoomOut={() => map?.zoomOut()}
          onCompass={() => map?.easeTo({ bearing: 0, pitch: CAMERA.pitch })}
          onTilt={() => map?.easeTo({ pitch: pitch > 5 ? 0 : CAMERA.pitch })}
          tilted={pitch > 5}
          presenting={present.presenting}
          onPresent={present.toggle}
          presentDisabledReason={reducedMotion ? 'Present is off because your system prefers reduced motion' : null}
          recording={recorder.recording}
          onRecord={recorder.toggle}
        />
      )}

      {tip && status === 'ready' && (
        <div className="sp-map-tip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="tooltip">
          {tip.text}
        </div>
      )}
      {present.presenting && (
        <div className="sp-map-overlay sp-map-present" role="status" aria-live="polite">
          Presenting · as of {model.asOf}
        </div>
      )}
    </div>
  );
}
