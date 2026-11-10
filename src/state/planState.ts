import type { ISODate } from '../domain/types';
import { canKeepSearch, canShowIssues, canShowLeaseTerm, planDate } from '../domain/safe';

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
/** A colour palette for the glass skin. `ascendix` (the company colours) is the default. */
export type Palette = 'ascendix' | 'vice';
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
   * Visual skin. Absent (the default) is frosted glass in one of the two palettes (`palette`);
   * `aurora` is the same glass in its original blue colours and `classic` is the flat Lightning
   * look: both opt out of the palettes.
   */
  skin?: 'aurora' | 'classic';
  /** Colour palette of the default skin. Absent is `ascendix`, the company colours; `vice` is Vice City. */
  palette?: 'vice';
}

const VIEWS: readonly View[] = ['building', 'stack', 'timeline', 'map', 'floor'];
const LENSES: readonly Lens[] = ['status', 'expiry', 'deals', 'rent'];
const MODES: readonly InspectorMode[] = ['building', 'block', 'floor', 'find', 'worklist', 'issues', 'area'];
const WINDOWS: readonly WindowKey[] = ['risk', '90', '180', '12', '24'];
const THEMES: readonly Theme[] = ['light', 'dark'];
export const PALETTES: ReadonlyArray<{ id: Palette; label: string }> = [
  { id: 'ascendix', label: 'Ascendix' },
  { id: 'vice', label: 'Vice City' },
];
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

/**
 * What prospect-safe mode never holds, whatever asked for it: the renewal worklist and the rollover
 * highlight (both point at single leases by their term), the data-issues panel, and an as-of date
 * other than today (a later date shows each lease's end as a vacated suite). `today` is passed by
 * whoever owns the clock (`parseState`, `usePlanState`); without it the date is left alone.
 * Idempotent, and the identity outside prospect-safe mode.
 */
export function safeState(s: PlanState, today?: ISODate): PlanState {
  if (!s.safe) return s;
  const window = canShowLeaseTerm(s.safe) ? s.window : null;
  const bucket = canShowLeaseTerm(s.safe) ? s.bucket : null;
  const mode = (s.mode === 'worklist' && !canShowLeaseTerm(s.safe)) || (s.mode === 'issues' && !canShowIssues(s.safe)) ? 'building' : s.mode;
  const asOf = today ? planDate(s.asOf, today, s.safe) : s.asOf;
  return window === s.window && bucket === s.bucket && mode === s.mode && asOf === s.asOf ? s : { ...s, window, bucket, mode, asOf };
}

/**
 * Crossing into prospect-safe mode, by the switch or by opening a link that has it on: on top of
 * `safeState`, a search in progress is dropped, because it may be a tenant, contact or prospect name
 * and would otherwise sit in the search box and the URL. Typing a suite or floor afterwards works.
 */
export function enterSafe(s: PlanState, today?: ISODate): PlanState {
  const next = safeState(s, today);
  return next.safe && next.q && !canKeepSearch(next.safe) ? { ...next, q: '' } : next;
}

/**
 * The one way state changes: apply a patch, then hold the prospect-safe invariants. Every control
 * goes through this (`usePlanState`), so no handler has to remember to clear anything itself: a
 * handler that asks for another as-of date while the mode is on simply stays on today.
 */
export function applyPatch(prev: PlanState, patch: Partial<PlanState>, today?: ISODate): PlanState {
  const next = { ...prev, ...patch };
  return next.safe && !prev.safe ? enterSafe(next, today) : safeState(next, today);
}

export function parseState(search: string, today: ISODate): PlanState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const d = defaultState(today);
  const parsed: PlanState = {
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
    ...(p.get('palette') === 'vice' ? { palette: 'vice' as const } : {}),
  };
  // A link with `safe=1` is a crossing into the mode: `q` and `asOf` are dropped with everything else it never holds.
  return enterSafe(parsed, today);
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
  if (s.palette) p.set('palette', s.palette);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/**
 * The palette the plan is drawn in: the company colours unless the URL names Vice City. The two
 * opt-out skins (`aurora`, `classic`) have colours of their own and no palette.
 */
export function paletteOf(s: Pick<PlanState, 'skin' | 'palette'>): Palette | null {
  if (s.skin !== undefined) return null;
  return s.palette === 'vice' ? 'vice' : 'ascendix';
}

/** What the palette control writes: the default palette is left out of the URL. */
export function palettePatch(palette: Palette): Pick<PlanState, 'palette'> {
  return { palette: palette === 'vice' ? 'vice' : undefined };
}

/**
 * Effective theme. An explicit `theme` wins; both palettes are dark unless told otherwise;
 * the other skins follow the operating system.
 */
export function isDark(s: Pick<PlanState, 'skin' | 'palette' | 'theme'>, prefersDark: boolean): boolean {
  return s.theme ? s.theme === 'dark' : paletteOf(s) !== null || prefersDark;
}

/**
 * Which inspector panel to show. An explicit non-default `mode` wins; otherwise
 * the most specific thing the URL points at: a block, a floor, a search, a window.
 */
export function deriveMode(s: PlanState): InspectorMode {
  // Prospect-safe has no worklist and no issues panel (`safeState`); a state built by hand is held to the same rule.
  if (s.mode !== 'building' && safeState(s).mode === s.mode) return s.mode;
  if (s.select) return 'block';
  if (s.floor) return 'floor';
  if (s.req !== null || s.inquiry) return 'find';
  if (s.window && canShowLeaseTerm(s.safe)) return 'worklist';
  return 'building';
}

/** The building model needs width: on a phone the stack stands in for the Building view. */
export const shownView = (view: PlanState['view'], phone: boolean): PlanState['view'] => (phone && view === 'building' ? 'stack' : view);
