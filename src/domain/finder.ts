import type { Deal, Inquiry, ISODate } from './types';
import { activeDeals, segmentIndex, type FloorView, type Segment } from './derive';

// ── Requirement fit ────────────────────────────────────────

export interface FitOption {
  floorId: string;
  floorName: string;
  size: number;
  keys: string[];
  /** null = available on as-of date */
  from: ISODate | null;
  type: 'Direct' | 'Sublease';
  inquiries: number;
  deals: number;
  /** Available after the requirement's needed-by date. */
  late?: boolean;
  /** Space is larger than the maximum: the SF to split off (divisible space only). */
  splitTo?: number;
  /** Two vertically adjacent floors combined. */
  multiFloor?: boolean;
  /** Several adjacent suites combined into one block. */
  contiguous?: boolean;
  /** Vacant on the as-of date but no availability record yet (time travel). */
  notMarketed?: boolean;
  /** Live deals already working this space (to avoid creating duplicates). */
  dealList?: Deal[];
  divisible?: boolean;
}

export type FitType = 'any' | 'direct' | 'sublease';

/** Narrow finder results to direct or sublease space; 'any' returns the list unchanged. */
export function filterFits(options: FitOption[], type: FitType): FitOption[] {
  if (type === 'any') return options;
  const want = type === 'direct' ? 'Direct' : 'Sublease';
  return options.filter((o) => o.type === want);
}

/**
 * Open inquiries a space could satisfy: size within the requirement (or divisible down to it)
 * and available on or before the needed-by date. Matches the requirement finder exactly.
 */
export function matchingInquiries(
  inquiries: Inquiry[],
  space: { size: number; divisible: boolean; minDivisible: number | null; from: ISODate | null; sizes?: number[] },
  asOf: ISODate,
): Inquiry[] {
  return inquiries.filter((i) => {
    // Same rule as the requirement finder: within the range, or divisible down to it.
    // `sizes` = the exact sizes achievable from adjacent whole suites (no suite in the run is divisible).
    const fitsRange = space.sizes
      ? space.sizes.some((z) => z >= i.minSize && z <= i.maxSize)
      : space.size >= i.minSize && space.size <= i.maxSize;
    const canSplit = !space.sizes && space.divisible && space.size >= i.minSize && (space.minDivisible ?? 0) <= i.maxSize;
    const when = space.from && space.from > asOf ? space.from : asOf;
    return (fitsRange || canSplit) && when <= i.neededBy;
  });
}

/**
 * Where can a tenant needing `req` SF go? Contiguous direct runs and their single suites,
 * sublease space, occupied space marketed for later, and adjacent-floor pairs.
 * Units offered for sale (`forsale`) are never lease options and, like a leased
 * neighbour, end any contiguous run they sit next to.
 */
export function findFits(
  floors: FloorView[],
  req: number,
  neededBy?: ISODate | null,
  maxSize?: number | null,
  inquiries: Inquiry[] = [],
  asOf?: ISODate,
): { options: FitOption[]; keys: Set<string>; largestNow: { size: number; floorName: string } } {
  const at = asOf ?? '0000-01-01'; // deterministic: callers pass the as-of date
  const inqCount = (size: number, divisible: boolean, minDivisible: number | null, from: ISODate | null, sizes?: number[]) =>
    matchingInquiries(inquiries, { size, divisible, minDivisible, from, sizes }, at).length;
  /** Sizes a tenant can take from adjacent whole suites: every contiguous sub-run's total. */
  const runSizes = (segs: Segment[]) => {
    const out = new Set<number>();
    for (let a = 0; a < segs.length; a++) {
      let t = 0;
      for (let b = a; b < segs.length; b++) out.add((t += segs[b].size));
    }
    return [...out];
  };
  const anyDivisible = (segs: Segment[]) => segs.some((x) => x.availability?.divisible);
  const options: FitOption[] = [];
  let largestNow = { size: 0, floorName: '' };
  for (const f of floors) {
    if (f.maxContiguous > largestNow.size) largestNow = { size: f.maxContiguous, floorName: f.floor.name };
    // contiguous direct runs available now
    let run: Segment[] = [];
    const flush = () => {
      const size = run.reduce((s, x) => s + x.size, 0);
      // Each suite on its own (a tenant rarely wants the whole run) …
      if (run.length > 1)
        for (const x of run)
          if (x.size >= req)
            options.push({
              floorId: f.floor.id,
              floorName: f.floor.name,
              size: x.size,
              keys: [x.key],
              from: x.availableFrom ?? null,
              type: 'Direct',
              inquiries: inqCount(x.size, !!x.availability?.divisible, x.availability?.minDivisible ?? null, x.availableFrom ?? null),
              deals: activeDeals(x.availability?.deals).length,
              divisible: !!x.availability?.divisible,
            });
      // … and the contiguous run combined.
      if (run.length && size >= req) {
        const from = run.map((x) => x.availableFrom ?? null).filter(Boolean).sort().at(-1) ?? null;
        options.push({
          floorId: f.floor.id,
          floorName: f.floor.name,
          size,
          keys: run.map((s) => s.key),
          from,
          type: 'Direct',
          inquiries: anyDivisible(run)
            ? inqCount(size, true, Math.min(...run.map((x) => (x.availability?.divisible ? (x.availability.minDivisible ?? x.size) : x.size))), from)
            : inqCount(size, false, null, from, runSizes(run)),
          deals: run.reduce((s, x) => s + activeDeals(x.availability?.deals).length, 0),
          divisible: run.length > 1 || !!run[0].availability?.divisible,
          contiguous: run.length > 1,
        });
      }
      run = [];
    };
    for (const s of f.segments) {
      if (s.kind === 'forsale') {
        // A unit for sale is not lease space: it ends the run like a leased neighbour and is never offered.
        flush();
        continue;
      }
      if (s.kind === 'available') {
        // adjacent availabilities form one run; a run's date is its latest available-from
        run.push(s);
      } else flush();
      if (s.kind === 'sublease' && s.availability && s.size >= req) {
        options.push({
          floorId: f.floor.id,
          floorName: f.floor.name,
          size: s.size,
          keys: [s.key],
          from: s.availability.availableFrom,
          type: 'Sublease',
          inquiries: inqCount(s.size, s.availability.divisible, s.availability.minDivisible, s.availability.availableFrom),
          deals: activeDeals(s.availability.deals).length,
        });
      }
      if (s.kind === 'projected' && s.size >= req) {
        options.push({
          floorId: f.floor.id,
          floorName: f.floor.name,
          size: s.size,
          keys: [s.key],
          from: null,
          type: 'Direct',
          inquiries: inqCount(s.size, false, null, null),
          deals: 0,
          notMarketed: true,
        });
      }
      const m = s.marketed;
      // Taking the whole space always satisfies a smaller requirement; minDivisible only matters for splits.
      // A suite marketed for sale is never a lease option.
      if (m && m.kind !== 'Sale' && m.size >= req) {
        // Space marketed for later — direct (tenant leaving) or a sublease that starts later.
        options.push({
          floorId: f.floor.id,
          floorName: f.floor.name,
          size: m.size,
          keys: [s.key],
          from: m.availableFrom,
          type: m.sublease ? 'Sublease' : 'Direct',
          inquiries: inqCount(m.size, m.divisible, m.minDivisible, m.availableFrom),
          deals: activeDeals(m.deals).length,
        });
      }
    }
    flush();
  }
  // Multi-floor: pair vertically adjacent floors' largest runs (HQ-size requirements); ranked after single floors.
  {
    const byFloor = floors.map((f) => ({
      f,
      // only each floor's largest contiguous run — scattered suites are not one block
      segs: f.segments.filter((s) => f.bestRun.includes(s.key)),
    }));
    for (let i = 0; i < byFloor.length - 1; i++) {
      const a = byFloor[i];
      const b = byFloor[i + 1];
      const size = [...a.segs, ...b.segs].reduce((t, s) => t + s.size, 0);
      if (!a.segs.length || !b.segs.length || size < req) continue;
      options.push({
        floorId: a.f.floor.id,
        floorName: `Floors ${b.f.floor.sequence}–${a.f.floor.sequence}`,
        size,
        keys: [...a.segs, ...b.segs].map((s) => s.key),
        from: null,
        type: 'Direct',
        inquiries: anyDivisible([...a.segs, ...b.segs])
          ? inqCount(size, true, Math.min(...[...a.segs, ...b.segs].map((s) => s.size)), null)
          : inqCount(size, false, null, null, [...runSizes(a.segs), ...runSizes(b.segs), size]),
        deals: [...a.segs, ...b.segs].reduce((t, s) => t + activeDeals(s.availability?.deals).length, 0),
        multiFloor: true,
      });
    }
  }
  const segs = segmentIndex(floors);
  for (const o of options)
    o.dealList = o.keys.flatMap((k) => {
      const sg = segs.get(k);
      return activeDeals([...(sg?.availability?.deals ?? []), ...(sg?.marketed?.deals ?? [])]);
    });
  if (neededBy) for (const o of options) o.late = !!o.from && o.from > neededBy;
  if (maxSize) {
    // Too big: keep only if a divisible space in it can be split down to the maximum.
    for (let i = options.length - 1; i >= 0; i--) {
      const o = options[i];
      if (o.size <= maxSize) continue;
      if (o.contiguous) {
        options.splice(i, 1); // its single suites are already offered
        continue;
      }
      const canSplit = o.keys.some((k) => {
        const seg = segs.get(k);
        const a = seg?.availability ?? seg?.marketed;
        return !!a?.divisible && (a.minDivisible ?? 0) <= maxSize;
      });
      if (canSplit) o.splitTo = maxSize;
      else options.splice(i, 1);
    }
  }
  // Best first: on time, available sooner, closest to the requirement.
  const miss = (o: FitOption) => (o.splitTo ? 0 : maxSize && o.size > maxSize ? o.size - maxSize : o.size - req);
  options.sort(
    (a, b) =>
      Number(!!a.late) - Number(!!b.late) ||
      Number(!!a.multiFloor) - Number(!!b.multiFloor) ||
      (a.from ?? '').localeCompare(b.from ?? '') ||
      miss(a) - miss(b),
  );
  const keys = new Set(options.flatMap((o) => o.keys));
  return { options, keys, largestNow };
}

export interface NearMiss {
  kind: 'short' | 'stack';
  floorName: string;
  size: number;
  /** SF short of the requirement (0 for a stack that meets it). */
  shortfall: number;
  keys: string[];
  from: ISODate | null;
  type: 'Direct' | 'Sublease' | 'Direct + sublease';
}

/** One space a tenant could take: a vacant or sublet suite, or an occupied one marketed for later. */
interface Space {
  key: string;
  size: number;
  from: ISODate | null;
  type: 'Direct' | 'Sublease';
}

/** Lease space on a floor, left to right. Units offered for sale are never lease space. */
function spacesOn(f: FloorView): Space[] {
  return f.segments.flatMap((s): Space[] => {
    if (s.kind === 'available') return [{ key: s.key, size: s.size, from: s.availableFrom ?? null, type: 'Direct' }];
    if (s.kind === 'sublease') return [{ key: s.key, size: s.size, from: s.availability?.availableFrom ?? null, type: 'Sublease' }];
    if (s.marketed && s.marketed.kind === 'Lease') return [{ key: s.key, size: s.marketed.size, from: s.marketed.availableFrom, type: s.marketed.sublease ? 'Sublease' : 'Direct' }];
    return [];
  });
}

const mixOf = (spaces: Space[]): NearMiss['type'] => (spaces.every((x) => x.type === 'Direct') ? 'Direct' : spaces.every((x) => x.type === 'Sublease') ? 'Sublease' : 'Direct + sublease');
const latest = (spaces: Space[]): ISODate | null => spaces.map((x) => x.from).filter(Boolean).sort().at(-1) ?? null;

/**
 * When the finder has few exact options: the closest single spaces that fall short of the
 * requirement, and vertically adjacent floors whose available space would meet it. `type` is the
 * requirement's space type and is applied before anything is combined or counted, so a sublease-only
 * search is offered sublease space only (never a direct or mixed alternative) and the `limit` is
 * spent on rows the tenant can use. Never offers for-sale units. Sorted by smallest shortfall first.
 */
export function nearMisses(floors: FloorView[], req: number, asOf: ISODate, type: FitType = 'any', limit = 4): NearMiss[] {
  const want = type === 'any' ? null : type === 'direct' ? 'Direct' : 'Sublease';
  const spaces = (f: FloorView) => spacesOn(f).filter((x) => !want || x.type === want);
  const out: NearMiss[] = [];
  for (const f of floors) {
    const sp = spaces(f);
    // whole-floor available total as one candidate when several suites exist
    const total = sp.reduce((s, x) => s + x.size, 0);
    if (sp.length > 1 && total < req) out.push({ kind: 'short', floorName: f.floor.name, size: total, shortfall: req - total, keys: sp.map((x) => x.key), from: latest(sp), type: mixOf(sp) });
    for (const x of sp) if (x.size < req) out.push({ kind: 'short', floorName: f.floor.name, size: x.size, shortfall: req - x.size, keys: [x.key], from: x.from, type: x.type });
  }
  for (let i = 0; i < floors.length - 1; i++) {
    const a = spaces(floors[i]);
    const b = spaces(floors[i + 1]);
    if (!a.length || !b.length) continue;
    const all = [...a, ...b];
    const size = all.reduce((s, x) => s + x.size, 0);
    if (size < req) continue;
    out.push({ kind: 'stack', floorName: `Floors ${floors[i + 1].floor.sequence}–${floors[i].floor.sequence}`, size, shortfall: 0, keys: all.map((x) => x.key), from: latest(all), type: mixOf(all) });
  }
  const seen = new Set<string>();
  return out
    .filter((m) => {
      const k = m.keys.join('+');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.shortfall - y.shortfall || (x.from ?? '').localeCompare(y.from ?? '') || y.size - x.size)
    .slice(0, limit)
    .map((m) => ({ ...m, from: m.from && m.from > asOf ? m.from : null }));
}

/** One suite of a finder option, as the option summary lists it. */
export interface OptionSuite extends Space {
  floorId: string;
  floorName: string;
  suite: string | null;
}

/**
 * The suites that make up a finder option or alternative, top floor first and left to right, each
 * with the SF, type and date it contributes. Keys that are no longer lease space are left out, so the
 * summary never lists a suite the plan does not offer. A date on or before `asOf` reads as now (null).
 */
export function optionSuites(floors: FloorView[], keys: readonly string[], asOf: ISODate): OptionSuite[] {
  const wanted = new Set(keys);
  return floors.flatMap((f) => {
    const suiteOf = new Map(f.segments.map((s) => [s.key, s.suite]));
    return spacesOn(f)
      .filter((x) => wanted.has(x.key))
      .map((x) => ({ ...x, from: x.from && x.from > asOf ? x.from : null, floorId: f.floor.id, floorName: f.floor.name, suite: suiteOf.get(x.key) ?? null }));
  });
}

/**
 * The option a click on a finder row keeps: every suite in it, its total and when all of it is free.
 * `title` is the row's own name ("Floors 7–8", "Floor 12").
 */
export interface ChosenOption {
  title: string;
  keys: string[];
  size: number;
  type: NearMiss['type'];
  from: ISODate | null;
  /** SF short of the requirement, for an alternative that does not meet it; 0 otherwise. */
  shortfall: number;
}

/** A finder row (an exact option or an alternative) as the option to keep when it is clicked. */
export function chosenOption(row: Pick<FitOption | NearMiss, 'floorName' | 'keys' | 'size' | 'type' | 'from'> & { shortfall?: number }): ChosenOption {
  return { title: row.floorName, keys: [...row.keys], size: row.size, type: row.type, from: row.from, shortfall: row.shortfall ?? 0 };
}

/**
 * A "Needed by" date as typed or picked: a whole calendar date (today included) or nothing. Anything
 * else (a half-typed date, a date that does not exist) is no date, never a guess.
 */
export function neededByDate(value: string): ISODate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === value ? value : null;
}
