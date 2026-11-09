import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const RECORD_MAX_MS = 20_000;
export const RECORD_FILE = 'stacking-plan';

export interface UseRecorderOptions {
  map: MapLibreMap | null;
  onStart?: () => void;
  onStop?: () => void;
  notify: (message: string, icon?: 'video' | 'warning' | 'download') => void;
}

/** Does this browser expose `MediaRecorder` and `canvas.captureStream`? */
export function recordingSupported(canvas?: HTMLCanvasElement | null): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false;
  const proto = (canvas ?? (typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement.prototype : null)) as { captureStream?: unknown } | null;
  return !!proto && typeof proto.captureStream === 'function';
}

function pickMime(): string | undefined {
  for (const m of ['video/webm;codecs=vp9', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
  return undefined;
}

/**
 * Record the map canvas to a WebM download (DESIGN.md §5). Starting also starts Present;
 * recording stops after 20 s or on click, then the file downloads and a toast confirms.
 */
export function useRecorder({ map, onStart, onStop, notify }: UseRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const cbRef = useRef({ onStart, onStop, notify });
  cbRef.current = { onStart, onStop, notify };

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else setRecording(false);
  }, []);

  const start = useCallback(() => {
    if (!map || recRef.current) return;
    const canvas = map.getCanvas();
    if (!recordingSupported(canvas)) {
      cbRef.current.notify('Video recording needs Chrome or Edge', 'warning');
      return;
    }
    let stream: MediaStream;
    let rec: MediaRecorder;
    try {
      stream = canvas.captureStream(30);
      const mimeType = pickMime();
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      cbRef.current.notify('Video recording needs Chrome or Edge', 'warning');
      return;
    }
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recRef.current = null;
      streamRef.current = null;
      setRecording(false);
      cbRef.current.onStop?.();
      const type = rec.mimeType || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        cbRef.current.notify('Nothing was recorded', 'warning');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${RECORD_FILE}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      cbRef.current.notify(`Video saved: ${RECORD_FILE}.${ext}`, 'download');
    };
    recRef.current = rec;
    streamRef.current = stream;
    rec.start(250);
    setRecording(true);
    cbRef.current.onStart?.();
    cbRef.current.notify('Recording the map for 20 seconds. Click Record again to stop early.', 'video');
    timerRef.current = window.setTimeout(stop, RECORD_MAX_MS);
  }, [map, stop]);

  const toggle = useCallback(() => (recRef.current ? stop() : start()), [start, stop]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        rec.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recRef.current = null;
    },
    [],
  );

  return { recording, start, stop, toggle };
}
