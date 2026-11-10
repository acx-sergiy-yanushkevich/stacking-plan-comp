import { useEffect, useRef, useState, type RefObject } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import { CAMERA, STYLE_DARK, STYLE_LIGHT } from './mapStyle';

export type MapStatus = 'loading' | 'ready' | 'failed';

export interface UseMapLibreOptions {
  center: { lat: number; lng: number };
  dark: boolean;
  /** Runs after every style (re)load, including the first: add sources and layers here. */
  onStyleLoad: (map: MapLibreMap) => void;
  /** How long the style may take before the view falls back to the SVG footprint. */
  timeoutMs?: number;
}

/** WebGL 2 or 1 on a scratch canvas; MapLibre needs one of them. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Owns the MapLibre instance for a container. `status` is `failed` when WebGL is missing,
 * the constructor throws, the style errors, or the style does not load within the timeout (Review
 * Focus 5). The `error` listener keeps MapLibre from logging to the console in that path.
 */
export function useMapLibre(containerRef: RefObject<HTMLDivElement | null>, opts: UseMapLibreOptions) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const onStyleLoadRef = useRef(opts.onStyleLoad);
  onStyleLoadRef.current = opts.onStyleLoad;
  const darkRef = useRef(opts.dark);
  darkRef.current = opts.dark;
  const styleRef = useRef<string>('');
  const { lat, lng } = opts.center;
  const timeoutMs = opts.timeoutMs ?? 8000;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!hasWebGL()) {
      setStatus('failed');
      return;
    }
    let m: MapLibreMap;
    const styleUrl = darkRef.current ? STYLE_DARK : STYLE_LIGHT;
    try {
      m = new MapLibreMap({
        container: el,
        style: styleUrl,
        center: [lng, lat],
        // Narrow viewports start further out so the whole building (roof included) is in frame.
        zoom: el.clientWidth < 600 ? CAMERA.zoom - 1.4 : CAMERA.zoom,
        pitch: CAMERA.pitch,
        bearing: CAMERA.bearing,
        maxPitch: CAMERA.maxPitch,
        attributionControl: { compact: true },
        doubleClickZoom: false,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
    } catch {
      setStatus('failed');
      return;
    }
    styleRef.current = styleUrl;
    // Exposed for the verification scripts (read-only inspection of layers and paint).
    (window as unknown as { __spMap?: MapLibreMap }).__spMap = m;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setStatus('failed');
      setMap(null);
      try {
        m.remove();
      } catch {
        // already gone
      }
    };
    const timer = setTimeout(fail, timeoutMs);
    m.on('error', (e) => {
      if (settled) return; // tile hiccups after load are not fatal
      const err = e.error as { status?: number; message?: string } | undefined;
      // Before the style is in, anything is fatal (a missing style, no WebGL). Tile errors are not.
      if (!err || typeof err.status === 'number' || /style|WebGL|context/i.test(err.message ?? '')) fail();
    });
    // Ready as soon as the style is in: the building is our own GeoJSON and needs no tile. Waiting for
    // `load` (every visible tile) made a slow or flaky tile server look like a broken map.
    const ready = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setStatus('ready');
      setMap(m);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => m.resize());
        ro.observe(el);
        m.once('remove', () => ro.disconnect());
      }
    };
    m.on('style.load', () => {
      onStyleLoadRef.current(m);
      ready();
    });
    m.on('load', ready);
    return () => {
      settled = true;
      clearTimeout(timer);
      setMap(null);
      try {
        m.remove();
      } catch {
        // nothing to clean
      }
    };
  }, [containerRef, lat, lng, timeoutMs]);

  // Theme switch: swap the base style; `style.load` re-adds our layers.
  useEffect(() => {
    if (!map) return;
    const url = opts.dark ? STYLE_DARK : STYLE_LIGHT;
    if (styleRef.current === url) return;
    styleRef.current = url;
    map.setStyle(url);
  }, [map, opts.dark]);

  return { map, status };
}
