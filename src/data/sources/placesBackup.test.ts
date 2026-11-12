// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDINGS } from '../mock/buildings';
import { property } from '../mock/property';
import { NO_HOST, setHost } from '../../lib/host';
import type { Area } from '../../domain/types';
import { metres, OverpassSource, toNearby } from './OverpassSource';
import { CensusSource } from './CensusSource';
import { MockSource } from './MockSource';
import { bestBackup, keepBackup, keptBackup, recordedBackup } from './placesBackup';

/** A browser store in memory, behind the host boundary. */
function store() {
  const kept = new Map<string, string>();
  setHost({ ...NO_HOST, readStore: (k) => kept.get(k) ?? null, writeStore: (k, v) => void kept.set(k, v) });
  return kept;
}

afterEach(() => {
  setHost(null);
  vi.unstubAllGlobals();
});

describe('the copies of OpenStreetMap recorded with the app (round 26)', () => {
  it('has one for every building that opens, taken at that building, with only the tags the app reads', async () => {
    for (const { property: p } of BUILDINGS) {
      const copy = await recordedBackup(p.id);
      expect(copy, p.id).not.toBeNull();
      expect(copy!.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const center = (copy as unknown as { center: { lat: number; lng: number } }).center;
      expect(metres(center, p.location), p.id).toBeLessThan(1);
      const near = toNearby(copy!.elements, p.location);
      expect(near?.amenities.length, p.id).toBeGreaterThan(0);
      expect(near?.transit.length, p.id).toBeGreaterThan(0);
      // Contributors' names and ids are never copied.
      expect(JSON.stringify(copy), p.id).not.toMatch(/"(user|uid|changeset)"/);
    }
    expect(await recordedBackup('P999')).toBeNull();
  });
});

describe('the best copy on hand', () => {
  it('is the newer of the one this browser kept and the one recorded with the app', async () => {
    const kept = store();
    const recorded = (await recordedBackup(property.id))!;
    expect(await bestBackup(property.id)).toEqual(recorded);
    keepBackup(property.id, { recordedAt: '2099-01-01', elements: [{ type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'cafe', phone: '555', name: 'Kept' } }] });
    expect((await bestBackup(property.id))?.recordedAt).toBe('2099-01-01');
    // What is kept holds only the tags the app reads.
    expect(keptBackup(property.id)?.elements[0].tags).toEqual({ amenity: 'cafe', name: 'Kept' });
    kept.set(`stax.places.${property.id}`, JSON.stringify({ recordedAt: '2000-01-01', elements: [] }));
    expect(await bestBackup(property.id)).toEqual(recorded);
    kept.set(`stax.places.${property.id}`, 'not json');
    expect(await bestBackup(property.id)).toEqual(recorded);
  });
});

describe('live mode answers at once, then fresher (round 26: a demo waited up to 36 s)', () => {
  const live = () => new OverpassSource(new CensusSource(null), new MockSource(), ['https://overpass.test/api/interpreter']);
  const until = async (seen: Area[], n: number) => {
    for (let i = 0; i < 50 && seen.length < n; i += 1) await new Promise((r) => setTimeout(r, 5));
  };

  it('shows the recorded copy, dated, while the servers do not answer', async () => {
    store();
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    const seen: Area[] = [];
    const stop = live().watchArea(property, {}, (a) => seen.push(a));
    await until(seen, 1);
    stop();
    expect(seen).toHaveLength(1);
    const copy = (await recordedBackup(property.id))!;
    expect(seen[0].placesRecordedAt).toBe(copy.recordedAt);
    expect(seen[0].places!.length).toBeGreaterThan(0);
    // The figures are still the sample's, and say so.
    expect(seen[0].sample).toBe(true);
  });

  it("then OpenStreetMap's own answer, undated, kept for the next visit", async () => {
    const kept = store();
    const answer = { elements: [{ type: 'node', id: 9, lat: property.location.lat + 0.001, lon: property.location.lng, tags: { amenity: 'cafe', name: 'Fresh Café' } }], osm3s: { timestamp_osm_base: '2026-11-20T10:00:00Z' } };
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => answer }));
    const seen: Area[] = [];
    const stop = live().watchArea(property, {}, (a) => seen.push(a));
    await until(seen, 2);
    stop();
    const last = seen.at(-1)!;
    expect(last.placesRecordedAt).toBeUndefined();
    expect(last.places!.map((p) => p.name)).toEqual(['Fresh Café']);
    expect(JSON.parse(kept.get(`stax.places.${property.id}`)!).recordedAt).toBe('2026-11-20');
  });

  it('says nothing more once it is told to stop', async () => {
    store();
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    const seen: Area[] = [];
    live().watchArea(property, {}, (a) => seen.push(a))();
    await new Promise((r) => setTimeout(r, 30));
    expect(seen).toHaveLength(0);
  });
});
