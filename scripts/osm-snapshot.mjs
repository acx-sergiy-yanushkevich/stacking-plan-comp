// Records the OpenStreetMap stops and places around each demo building into src/data/snapshots/osm-<id>.json:
// the copy live mode (?live=1) shows at once, before the shared Overpass servers answer (round 26: a demo waited
// up to 36 s on them, and they often refuse outright). Run it again to refresh the copies:
//
//   node scripts/osm-snapshot.mjs            # every building
//   node scripts/osm-snapshot.mjs P005       # one
//
// It reads the main OSM API for the half mile (bus stops, stations, restaurants, cafés, banks, gyms, parking,
// hotels: nodes, as the live query asks for) and Nominatim for rail out to five miles, at most one request a
// second. Only the tags the app reads are kept; contributors' names and ids never are.
import { mkdir, writeFile } from 'node:fs/promises';

// The buildings' centers, as in src/data/mock (sources.test.ts checks each copy against its building).
const BUILDINGS = {
  P001: { lat: 33.023482, lng: -96.79358 },
  P002: { lat: 33.07843, lng: -96.82634 },
  P005: { lat: 32.80152, lng: -96.80447 },
  P007: { lat: 32.99652, lng: -96.74951 },
};
const OUT = 'src/data/snapshots';
const AGENT = 'stax-prototype/1.0 (demo snapshot of OpenStreetMap places)';
const WALK_M = 800;
const RAIL_M = 8047;
const KEEP = ['name', 'amenity', 'tourism', 'highway', 'railway', 'public_transport', 'train', 'light_rail', 'subway', 'tram', 'bus'];
const AMENITIES = new Set(['restaurant', 'cafe', 'bank', 'gym', 'fitness_centre', 'parking']);
const RAIL = new Set(['station', 'halt', 'tram_stop']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const metres = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = dLng * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return 6_371_000 * Math.hypot(x, dLat);
};
const boxAround = (c, m) => {
  const dLat = m / 111_320;
  const dLng = m / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return { w: c.lng - dLng, s: c.lat - dLat, e: c.lng + dLng, n: c.lat + dLat };
};
const slim = (id, lat, lon, tags) => ({
  type: 'node',
  id,
  lat: Math.round(lat * 1e7) / 1e7,
  lon: Math.round(lon * 1e7) / 1e7,
  tags: Object.fromEntries(KEEP.filter((k) => tags[k] !== undefined).map((k) => [k, tags[k]])),
});

/** Every tagged node in a box from the OSM API, split in four when a dense box is over the API's node limit. */
async function nodesIn(box, depth = 0) {
  const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${box.w},${box.s},${box.e},${box.n}`;
  const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
  if (res.status === 400 && depth < 3) {
    const midLng = (box.w + box.e) / 2;
    const midLat = (box.s + box.n) / 2;
    const parts = [
      { w: box.w, s: box.s, e: midLng, n: midLat },
      { w: midLng, s: box.s, e: box.e, n: midLat },
      { w: box.w, s: midLat, e: midLng, n: box.n },
      { w: midLng, s: midLat, e: box.e, n: box.n },
    ];
    const out = [];
    for (const part of parts) out.push(...(await nodesIn(part, depth + 1)));
    return out;
  }
  if (!res.ok) throw new Error(`OSM API ${res.status} for ${url}`);
  const data = await res.json();
  return (data.elements ?? []).filter((el) => el.type === 'node' && el.tags);
}

/** Rail stations, halts and tram stops Nominatim knows within `m` of the center. */
async function railNear(c, m) {
  const out = new Map();
  for (const [q, radius] of [['station', m], ['station', 2400], ['tram stop', 2400]]) {
    const b = boxAround(c, radius);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=50&bounded=1&viewbox=${b.w},${b.n},${b.e},${b.s}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!res.ok) throw new Error(`Nominatim ${res.status} for ${url}`);
    for (const r of await res.json()) {
      if (r.category !== 'railway' || !RAIL.has(r.type) || !r.name) continue;
      const at = { lat: Number(r.lat), lng: Number(r.lon) };
      if (metres(c, at) <= m) out.set(`${r.osm_type}${r.osm_id}`, slim(Number(r.osm_id), at.lat, at.lng, { railway: r.type, name: r.name }));
    }
    await sleep(1100);
  }
  return [...out.values()];
}

const today = new Date().toISOString().slice(0, 10);
await mkdir(OUT, { recursive: true });
for (const [id, c] of Object.entries(BUILDINGS)) {
  if (process.argv[2] && process.argv[2] !== id) continue;
  const near = (await nodesIn(boxAround(c, WALK_M)))
    .filter((el) => {
      const t = el.tags;
      const wanted = AMENITIES.has(t.amenity) || t.tourism === 'hotel' || t.highway === 'bus_stop' || t.public_transport === 'station' || RAIL.has(t.railway);
      return wanted && metres(c, { lat: el.lat, lng: el.lon }) <= WALK_M;
    })
    .map((el) => slim(el.id, el.lat, el.lon, el.tags));
  const rail = await railNear(c, RAIL_M);
  const byId = new Map([...rail, ...near].map((el) => [el.id, el]));
  const elements = [...byId.values()].sort((a, b) => a.id - b.id);
  const copy = { recordedAt: today, source: 'OpenStreetMap contributors (ODbL), read through the OSM API and Nominatim', center: c, elements };
  await writeFile(`${OUT}/osm-${id}.json`, `${JSON.stringify(copy, null, 1)}\n`);
  const count = (f) => elements.filter(f).length;
  console.log(`${id}: ${elements.length} nodes · ${count((e) => e.tags.highway === 'bus_stop')} bus stops · ${count((e) => RAIL.has(e.tags.railway))} rail · ${count((e) => AMENITIES.has(e.tags.amenity) || e.tags.tourism === 'hotel')} places`);
}
