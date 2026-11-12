import { readStore, writeStore } from '../../lib/host';
import type { OverpassElement } from './OverpassSource';

/**
 * A copy of OpenStreetMap's stops and places around one building: what live mode shows at once, before the shared
 * Overpass servers answer, and keeps showing when they do not (round 26: a demo waited up to 36 s on them, and they
 * often refuse outright). Read with `toNearby`, as a live answer is.
 */
export interface PlacesBackup {
  /** The day the copy was taken (ISO): the Area panel and the brief say it. */
  recordedAt: string;
  /** OpenStreetMap's nodes, in Overpass's shape, with only the tags the app reads. */
  elements: OverpassElement[];
}

/** The tags `toNearby` reads; a kept copy holds nothing else. */
const TAGS = ['name', 'amenity', 'tourism', 'highway', 'railway', 'public_transport', 'train', 'light_rail', 'subway', 'tram', 'bus'];

export const slimElements = (elements: OverpassElement[]): OverpassElement[] =>
  elements
    .filter((el) => el.lat !== undefined && el.lon !== undefined && el.tags)
    .map((el) => ({ type: el.type, id: el.id, lat: el.lat, lon: el.lon, tags: Object.fromEntries(TAGS.filter((t) => el.tags![t] !== undefined).map((t) => [t, el.tags![t]])) }));

const isBackup = (x: unknown): x is PlacesBackup => !!x && typeof x === 'object' && typeof (x as PlacesBackup).recordedAt === 'string' && Array.isArray((x as PlacesBackup).elements);

/** The copies recorded with the app (`scripts/osm-snapshot.mjs`): a chunk of their own, loaded only in live mode. */
const RECORDED = import.meta.glob<PlacesBackup>('../snapshots/osm-*.json', { import: 'default' });

export async function recordedBackup(id: string): Promise<PlacesBackup | null> {
  const load = RECORDED[`../snapshots/osm-${id}.json`];
  if (!load) return null;
  try {
    const copy = await load();
    return isBackup(copy) ? copy : null;
  } catch {
    return null;
  }
}

const keyOf = (id: string) => `stax.places.${id}`;

/** The last live answer this browser kept for the building. */
export function keptBackup(id: string): PlacesBackup | null {
  const raw = readStore(keyOf(id));
  if (!raw) return null;
  try {
    const copy: unknown = JSON.parse(raw);
    return isBackup(copy) ? copy : null;
  } catch {
    return null;
  }
}

/** Keep a live answer for the next visit. */
export function keepBackup(id: string, copy: PlacesBackup): void {
  writeStore(keyOf(id), JSON.stringify({ recordedAt: copy.recordedAt, elements: slimElements(copy.elements) }));
}

/** The newer of the copy this browser kept and the one recorded with the app; null when there is neither. */
export async function bestBackup(id: string): Promise<PlacesBackup | null> {
  const kept = keptBackup(id);
  const recorded = await recordedBackup(id);
  if (!kept || !recorded) return kept ?? recorded;
  return kept.recordedAt >= recorded.recordedAt ? kept : recorded;
}
