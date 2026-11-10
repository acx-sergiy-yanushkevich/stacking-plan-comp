import type { ISODate } from '../domain/types';

/**
 * URL-synced plan state. Pure: no React, no DOM. `usePlanState` wires it to
 * `location` and `history`. Every field is optional in the URL; defaults are
 * omitted when serialising so a fresh plan is just `/`.
 */

export type View = 'building' | 'stack' | 'timeline' | 'map' | 'floor';
export type Lens = 'status' | 'expiry' | 'deals' | 'rent';
export type InspectorMode = 'building' | 'block' | 'floor' | 'find' | 'worklist' | 'issues' | 'area';
export type WindowKey = 'risk' | '90' | '180' | '12' | '24';
export type Theme = 'light' | 'dark';
export type FitKind = 'any' | 'direct' | 'sublease';

export interface PlanState {
  view: View;
  lens: Lens;
  asOf: ISODate;
  select: string | null;
  floor: string | null;
  safe: boolean;
  req: number | null;
  max: number | null;
  by: ISODate | null;
  fit: FitKind;
  window: WindowKey | null;
  bucket: number | null;
  inquiry: string | null;
  q: string;
  mode: InspectorMode;
  live: boolean;
  census: string | null;
  theme: Theme | null;
  /**
   * Visual skin. Absent (the default) is frosted glass in the Vice City palette; `aurora` is the
   * same glass in its original blue palette; `classic` is the flat Lightning look.
   */
  skin?: 'aurora' | 'classic';
}

const VIEWS: readonly View[] = ['building', 'stack', 'timeline', 'map', 'floor'];
const LENSES: readonly Lens[] = ['status', 'expiry', 'deals', 'rent'];
const MODES: readonly InspectorMode[] = ['building', 'block', 'floor', 'find', 'worklist', 'issues', 'area'];
const WINDOWS: readonly WindowKey[] = ['risk', '90', '180', '12', '24'];
const THEMES: readonly Theme[] = ['light', 'dark'];
const FITS: readonly FitKind[] = ['any', 'direct', 'sublease'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Defaults for `today`; `asOf` is the only default that depends on the caller. */
export function defaultState(today: ISODate): PlanState {
  return { ...DEFAULT_STATE, asOf: today };
}

/** Static defaults. `asOf: ''` means "today"; use `defaultState(today)` for a concrete date. */
export const DEFAULT_STATE: PlanState = {
  view: 'building',
  lens: 'status',
  asOf: '',
  select: null,
  floor: null,
  safe: false,
  req: null,
  max: null,
  by: null,
  fit: 'any',
  window: null,
  bucket: null,
  inquiry: null,
  q: '',
  mode: 'building',
  live: false,
  census: null,
  theme: null,
};

function oneOf<T extends string>(allowed: readonly T[], v: string | null, fallback: T): T {
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function oneOfOrNull<T extends string>(allowed: readonly T[], v: string | null): T | null {
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function isoOrNull(v: string | null): ISODate | null {
  return v !== null && ISO.test(v) ? v : null;
}

/** Positive finite number, else null. */
function positive(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Non-negative integer (rollover bucket 0 is "< 12 mo"), else null. */
function nonNegativeInt(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function text(v: string | null): string | null {
  return v !== null && v !== '' ? v : null;
}

export function parseState(search: string, today: ISODate): PlanState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const d = defaultState(today);
  return {
    view: oneOf(VIEWS, p.get('view'), d.view),
    lens: oneOf(LENSES, p.get('lens'), d.lens),
    asOf: isoOrNull(p.get('asOf')) ?? today,
    select: text(p.get('select')),
    floor: text(p.get('floor')),
    safe: p.get('safe') === '1',
    req: positive(p.get('req')),
    max: positive(p.get('max')),
    by: isoOrNull(p.get('by')),
    fit: oneOf(FITS, p.get('fit'), d.fit),
    window: oneOfOrNull(WINDOWS, p.get('window')),
    bucket: nonNegativeInt(p.get('bucket')),
    inquiry: text(p.get('inquiry')),
    q: p.get('q') ?? '',
    mode: oneOf(MODES, p.get('mode'), d.mode),
    live: p.get('live') === '1',
    census: text(p.get('census')),
    theme: oneOfOrNull(THEMES, p.get('theme')),
    ...(p.get('skin') === 'classic' ? { skin: 'classic' as const } : p.get('skin') === 'aurora' ? { skin: 'aurora' as const } : {}),
  };
}

/** Query string with defaults omitted; '' when everything is default, otherwise leading `?`. */
export function serializeState(s: PlanState, today: ISODate): string {
  const p = new URLSearchParams();
  if (s.view !== DEFAULT_STATE.view) p.set('view', s.view);
  if (s.lens !== DEFAULT_STATE.lens) p.set('lens', s.lens);
  if (s.asOf && s.asOf !== today) p.set('asOf', s.asOf);
  if (s.select) p.set('select', s.select);
  if (s.floor) p.set('floor', s.floor);
  if (s.safe) p.set('safe', '1');
  if (s.req !== null) p.set('req', String(s.req));
  if (s.max !== null) p.set('max', String(s.max));
  if (s.by) p.set('by', s.by);
  if (s.fit !== DEFAULT_STATE.fit) p.set('fit', s.fit);
  if (s.window) p.set('window', s.window);
  if (s.bucket !== null) p.set('bucket', String(s.bucket));
  if (s.inquiry) p.set('inquiry', s.inquiry);
  if (s.q) p.set('q', s.q);
  if (s.mode !== DEFAULT_STATE.mode) p.set('mode', s.mode);
  if (s.live) p.set('live', '1');
  if (s.census) p.set('census', s.census);
  if (s.theme) p.set('theme', s.theme);
  if (s.skin) p.set('skin', s.skin);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/** The Vice City palette is the default look; `aurora` and `classic` opt out of it. */
export function isVice(s: Pick<PlanState, 'skin'>): boolean {
  return s.skin === undefined;
}

/**
 * Effective theme. An explicit `theme` wins; the Vice City palette is dark unless told otherwise;
 * the other skins follow the operating system.
 */
export function isDark(s: Pick<PlanState, 'skin' | 'theme'>, prefersDark: boolean): boolean {
  return s.theme ? s.theme === 'dark' : isVice(s) || prefersDark;
}

/**
 * Which inspector panel to show. An explicit non-default `mode` wins; otherwise
 * the most specific thing the URL points at: a block, a floor, a search, a window.
 */
export function deriveMode(s: PlanState): InspectorMode {
  if (s.mode !== 'building') return s.mode;
  if (s.select) return 'block';
  if (s.floor) return 'floor';
  if (s.req !== null || s.inquiry) return 'find';
  if (s.window) return 'worklist';
  return 'building';
}

/** The building model needs width: on a phone the stack stands in for the Building view. */
export const shownView = (view: PlanState['view'], phone: boolean): PlanState['view'] => (phone && view === 'building' ? 'stack' : view);
