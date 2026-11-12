import type { ISODate } from '../domain/types';
import { canKeepSearch, canShowInquiries, canShowIssues, canShowLeaseTerm, canUseLens, planDate } from '../domain/safe';

/**
 * URL-synced plan state. Pure: no React, no DOM. `usePlanState` wires it to the page (`lib/host`).
 * Every field is optional in the URL; defaults are omitted when serialising so a fresh plan is just `/`.
 */

export type View = 'building' | 'stack' | 'timeline' | 'map' | 'floor';
export type Lens = 'status' | 'expiry' | 'deals' | 'rent';
/** `brief` is the Area panel widened to the full page: the location brief, with the plan out of the way. */
export type InspectorMode = 'building' | 'block' | 'floor' | 'find' | 'worklist' | 'issues' | 'area' | 'brief';
export type WindowKey = 'risk' | '90' | '180' | '12' | '24';
export type Theme = 'light' | 'dark';
/** A colour palette for the glass skin. `ascendix` (the company colours) is the default. */
export type Palette = 'ascendix' | 'vice';
export type FitKind = 'any' | 'direct' | 'sublease';

export interface PlanState {
  /** The open building's Property id; null is the default building (data/mock/buildings). */
  building: string | null;
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
  /** Color palette of the default skin. Absent is `ascendix`, the company colours; `vice` is Vice City. */
  palette?: 'vice';
}

const VIEWS: readonly View[] = ['building', 'stack', 'timeline', 'map', 'floor'];
const LENSES: readonly Lens[] = ['status', 'expiry', 'deals', 'rent'];
const MODES: readonly InspectorMode[] = ['building', 'block', 'floor', 'find', 'worklist', 'issues', 'area', 'brief'];
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
  building: null,
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
 * highlight (both point at single leases by their term), the data-issues panel, a lens that colours
 * by something withheld (Deals, Expiration: the plan falls back to Status), a matched inquiry (another
 * prospect's size and date would be the requirement on screen) and an as-of date other than today (a
 * later date shows each lease's end as a vacated suite). `today` is passed by whoever owns the clock
 * (`parseState`, `usePlanState`); without it the date is left alone. Because every change of state
 * passes through here (`applyPatch`), none of these can be set while the mode is on, by a control or by
 * a link. Idempotent, and the identity outside prospect-safe mode.
 */
export function safeState(s: PlanState, today?: ISODate): PlanState {
  if (!s.safe) return s;
  const window = canShowLeaseTerm(s.safe) ? s.window : null;
  const bucket = canShowLeaseTerm(s.safe) ? s.bucket : null;
  const mode = (s.mode === 'worklist' && !canShowLeaseTerm(s.safe)) || (s.mode === 'issues' && !canShowIssues(s.safe)) ? 'building' : s.mode;
  const lens = canUseLens(s.lens, s.safe) ? s.lens : DEFAULT_STATE.lens;
  const inquiry = canShowInquiries(s.safe) ? s.inquiry : null;
  const asOf = today ? planDate(s.asOf, today, s.safe) : s.asOf;
  return window === s.window && bucket === s.bucket && mode === s.mode && lens === s.lens && inquiry === s.inquiry && asOf === s.asOf ? s : { ...s, window, bucket, mode, lens, inquiry, asOf };
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
 * goes through this (by way of `stepSession`), so no handler has to remember to clear anything itself:
 * a handler that asks for another as-of date while the mode is on simply stays on today. The state
 * holds no trace of what the mode took off it: on its own, turning the mode off restores nothing.
 */
/**
 * The Map tab is about the building's surroundings, and its panel is the Area panel: a link to the map with no
 * panel named opens it there (`modeDefault`), arriving at the map with nothing else open opens it, and leaving
 * the map puts it away again, so the plan views keep their own panel. A panel opened on purpose stays.
 */
export const modeDefault = (view: PlanState['view']): InspectorMode => (view === 'map' ? 'area' : 'building');

function withMapPanel(prev: PlanState, next: PlanState): PlanState {
  if (next.view === prev.view) return next;
  if (next.view === 'map' && next.mode === 'building' && !next.select && !next.floor) return { ...next, mode: 'area' };
  if (prev.view === 'map' && (next.mode === 'area' || next.mode === 'brief')) return { ...next, mode: 'building' };
  return next;
}

export function applyPatch(prev: PlanState, patch: Partial<PlanState>, today?: ISODate): PlanState {
  const next = withMapPanel(prev, { ...prev, ...patch });
  return next.safe && !prev.safe ? enterSafe(next, today) : safeState(next, today);
}

/** Everything crossing into prospect-safe mode can take off the plan (`enterSafe`). */
const WITHHELD = ['asOf', 'lens', 'window', 'bucket', 'mode', 'inquiry', 'q'] as const;
type WithheldState = Pick<PlanState, (typeof WITHHELD)[number]>;

/**
 * What the Prospect-safe switch took off the plan when it was turned on: the broker's as-of date,
 * lens, worklist, rollover highlight, search and matched inquiry. `was` is what the plan held and
 * `left` is what the mode put in its place, field by field, for the fields it changed and no others.
 */
export interface Withheld {
  was: Partial<WithheldState>;
  left: Partial<WithheldState>;
}

/**
 * The plan's state and, beside it, what the switch withheld. The two are kept apart on purpose:
 * `state` is all that is drawn, read by the model and written to the URL, and while the mode is on it
 * holds none of what was withheld. `withheld` is read by one function, `stepSession`, when the mode is
 * turned off. It lives in memory for as long as the page does and is never serialised: a reload, or a
 * link opened with `safe=1`, starts with nothing to bring back.
 */
export interface PlanSession {
  state: PlanState;
  withheld: Withheld | null;
}

/** A session as a link opens it: the state the address gives, and nothing withheld to restore. */
export function openSession(search: string, today: ISODate): PlanSession {
  return { state: parseState(search, today), withheld: null };
}

/** The fields the mode changed on the way in, as they were and as it left them; null when it changed none. */
function withheldBy(asked: PlanState, entered: PlanState): Withheld | null {
  const was: Partial<WithheldState> = {};
  const left: Partial<WithheldState> = {};
  for (const key of WITHHELD) {
    if (asked[key] === entered[key]) continue;
    Object.assign(was, { [key]: asked[key] });
    Object.assign(left, { [key]: entered[key] });
  }
  return Object.keys(was).length > 0 ? { was, left } : null;
}

/**
 * The state with what was withheld put back. A field is restored only if it still holds what the mode
 * left there: one the user has since changed (a lens picked, a suite number searched for while the
 * prospect was looking) keeps the newer choice. A matched inquiry comes back only if no requirement
 * was typed in its place.
 */
function restored(state: PlanState, withheld: Withheld | null): PlanState {
  if (!withheld) return state;
  const back: Partial<WithheldState> = {};
  for (const key of WITHHELD) {
    if (!(key in withheld.was) || state[key] !== withheld.left[key]) continue;
    if (key === 'inquiry' && state.req !== null) continue;
    Object.assign(back, { [key]: withheld.was[key] });
  }
  return Object.keys(back).length > 0 ? { ...state, ...back } : state;
}

/**
 * One change of state, with the memory of the switch (`PlanSession`).
 *  - Turning Prospect-safe on: the state is held to the mode (`enterSafe`) and what that removed is
 *    remembered.
 *  - Any change while it is on: `applyPatch`, as before. The memory is carried and not read.
 *  - Turning it off: what was removed is put back (`restored`) and the memory is emptied, so the
 *    broker is returned to the view they had before showing the plan to a prospect.
 */
export function stepSession(prev: PlanSession, patch: Partial<PlanState>, today?: ISODate): PlanSession {
  const asked = { ...prev.state, ...patch };
  if (asked.safe && !prev.state.safe) {
    const state = enterSafe(asked, today);
    return { state, withheld: withheldBy(asked, state) };
  }
  if (!asked.safe && prev.state.safe) return { state: restored(asked, prev.withheld), withheld: null };
  // Another building: what the memory holds of the one left (its search, inquiry, worklist, highlight) names
  // records that are not here, so it is forgotten; how the plan was looked at (lens, as-of date) is kept, as
  // `switchBuilding` keeps it (round 23: "vantage" came back on Legacy West).
  const memory = asked.building !== prev.state.building ? lookOnly(prev.withheld) : prev.withheld;
  return { state: applyPatch(prev.state, patch, today), withheld: memory };
}

/** The fields of a memory that say how the plan was looked at, not which records: kept across a building switch. */
const LOOK = ['asOf', 'lens'] as const;

function lookOnly(withheld: Withheld | null): Withheld | null {
  if (!withheld) return null;
  const was: Partial<WithheldState> = {};
  const left: Partial<WithheldState> = {};
  for (const key of LOOK) {
    if (!(key in withheld.was)) continue;
    Object.assign(was, { [key]: withheld.was[key] });
    Object.assign(left, { [key]: withheld.left[key] });
  }
  return Object.keys(was).length > 0 ? { was, left } : null;
}

export function parseState(search: string, today: ISODate): PlanState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const d = defaultState(today);
  const parsed: PlanState = {
    building: text(p.get('building')),
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
    mode: oneOf(MODES, p.get('mode'), p.get('select') || p.get('floor') ? d.mode : modeDefault(oneOf(VIEWS, p.get('view'), d.view))),
    live: p.get('live') === '1',
    census: text(p.get('census')),
    theme: oneOfOrNull(THEMES, p.get('theme')),
    ...(p.get('skin') === 'classic' ? { skin: 'classic' as const } : p.get('skin') === 'aurora' ? { skin: 'aurora' as const } : {}),
    ...(p.get('palette') === 'vice' ? { palette: 'vice' as const } : {}),
  };
  // A link with `safe=1` is a crossing into the mode: `q`, `inquiry` and `asOf` are dropped with everything else it never holds.
  return enterSafe(parsed, today);
}

/** Query string with defaults omitted; '' when everything is default, otherwise leading `?`. */
export function serializeState(s: PlanState, today: ISODate): string {
  const p = new URLSearchParams();
  if (s.building) p.set('building', s.building);
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
  if (s.mode !== (s.select || s.floor ? DEFAULT_STATE.mode : modeDefault(s.view))) p.set('mode', s.mode);
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

/**
 * The change that opens another building. Everything that names a record of the building being left (a
 * suite, a floor, a search, a requirement, a highlight, a tool panel) is dropped; how the plan is looked at
 * (view, lens, as-of date, prospect-safe, theme) is kept. The Floor view needs a floor, so it falls back
 * to the Building view.
 */
export function switchBuilding(s: PlanState, building: string): Partial<PlanState> {
  return {
    building,
    view: s.view === 'floor' ? 'building' : s.view,
    select: null,
    floor: null,
    req: null,
    max: null,
    by: null,
    window: null,
    bucket: null,
    inquiry: null,
    q: '',
    mode: 'building',
  };
}
