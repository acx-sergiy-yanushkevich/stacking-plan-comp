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
 * the constructor throws, the style errors, or nothing loads within the timeout (Review
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
        zoom: CAMERA.zoom,
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
      if (!err || typeof err.status === 'number' || /style|WebGL|context/i.test(err.message ?? '')) fail();
    });
    m.on('style.load', () => onStyleLoadRef.current(m));
    m.on('load', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setStatus('ready');
      setMap(m);
    });
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
