# Stacking Plan v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stacking Plan v2 prototype described in `docs/DESIGN.md`: one domain model rendered as a 2D stack, a lease timeline, a 3D building on a real map and a floor plate, with an inspector, finder, worklist, issues, exports and prospect-safe mode, judged to 95/100.

**Architecture:** Pure TypeScript domain in `src/domain/` (no React, fully unit-tested) feeds React components through one URL-synced state hook. Each view is a sibling component reading the same derived model. Styles are plain CSS files on SLDS-named tokens so the LWC port can copy them. Live data (footprint, demographics) sits behind a `DataSource` interface with cached mock defaults.

**Tech Stack:** React 19, TypeScript 5.x/7, Vite 8, vitest 3, Playwright 1.65 (Chrome channel), @axe-core/playwright, maplibre-gl 5.x with OpenFreeMap vector tiles. No other runtime dependencies.

**Spec:** `docs/DESIGN.md` (screens, tones, tiers), `docs/BRIEF.md` (jobs, domain rules, rubric), `docs/PLAN.md` (scope).

## Global Constraints

- Repo: the root of this repository (own git repo; commit after every task).
- Runtime deps: `react`, `react-dom`, `maplibre-gl` only.
- `src/domain/**` must not import React or touch `document`/`window`.
- Dates are ISO `YYYY-MM-DD` strings; "today" is the constant `TODAY = '2026-11-09'` from `src/data/mock/property.ts` so screenshots are reproducible.
- RSF is never rounded or abbreviated in blocks, tables or exports. Rates always render as `$X/SF/yr FSG` style (unit and type).
- Colour tones, text tiers and tokens are the exact values in `docs/DESIGN.md` §3 and §2.4.
- Prospect-safe (`safe=true`) must hide tenant names, tenant contacts, rents, prices and prospect names in every view, tooltip, accessible name, export and `document.title`.
- Base font 13 px, tabular numerals everywhere; focus rings never removed; `prefers-reduced-motion` disables orbit, time-lapse and transitions.
- URL params (all optional): `view=stack|timeline|map|floor`, `lens=status|expiry|deals|rent`, `asOf=YYYY-MM-DD`, `select=<segKey>`, `floor=<floorId>`, `safe=1`, `req=<sf>`, `max=<sf>`, `by=YYYY-MM-DD`, `window=risk|90|180|12|24`, `bucket=<n>`, `inquiry=<id>`, `q=<text>`, `mode=building|block|floor|find|worklist|issues|area`, `live=1`, `census=<key>`, `theme=dark|light`.

## Review Focus

1. A floor whose leases and availabilities exceed its leasable RSF (Floor 7, +500 SF): occupancy caps at 100 %, the excess appears as an error issue and never as leased SF. Test in Task 4.
2. Time travel past a lease end with a signed replacement (Floor 4 suite 450, Floor 6 suite 600): the block becomes committed, then leased, never "vacant"; the vacating tenant's marketed space becomes available on its available-from date. Test in Task 4.
3. Prospect-safe with search active (`q=anadarko&safe=1`): search must not confirm a tenant by highlighting; it searches suites and floors only. Test in Task 19.
4. A block narrower than 56 px (Floor 7 suite 740 at 2,400 SF on a 21,400 SF floor at mobile width): enlarged to the minimum, footnote shown, tooltip carries the full facts. Test in Task 9.
5. Map unavailable (no WebGL or tiles blocked): Map view renders the SVG footprint fallback with a notice, no console error, inspector Area still works. Test in Task 17.

---

### Task 1: Project foundation (tokens, base styles, scripts, shell)

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/print.css`
- Modify: `index.html`, `src/main.tsx`, `src/App.tsx`, `package.json`, `vite.config.ts`, `tsconfig.app.json`, `.gitignore`
- Delete: `src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg`
- Create: `vitest.config.ts`, `README.md`

**Interfaces:**
- Produces: CSS custom properties named `--sp-color-page`, `--sp-color-card`, `--sp-color-border`, `--sp-color-border-strong`, `--sp-color-text`, `--sp-color-text-weak`, `--sp-color-brand`, `--sp-color-brand-strong`, `--sp-color-focus`, `--sp-radius-card: 8px`, `--sp-radius-block: 4px`, `--sp-space-1..6` (4, 8, 12, 16, 24, 32 px), `--sp-font: 'Inter', system-ui, …`, `--sp-text-11/12/13/15/18/22`; tone tokens `--tone-<name>-fill`, `--tone-<name>-text`, `--tone-<name>-edge` for every tone in DESIGN §3.3 (leased, expiring, risk, available, available-later, sublease, committed, forsale, empty, projected, exp-0..exp-5, rent-0..rent-4, rent-net, confidential, deal-0..deal-3, deal-none, muted, neutral). Dark values under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`.
- `package.json` scripts: `dev`, `build` (`tsc -b && vite build`), `preview` (`vite preview --port 4173 --outDir dist-judge`), `test` (`vitest run`), `lint`, `shots`, `a11y`, `verify`, `pdf`.

- [ ] **Step 1:** Replace the Vite template: delete the listed files; write `index.html` with `<title>Stacking plan</title>`, viewport meta, Inter from Google Fonts (`wght@400;500;600;700`), `<div id="root">`.
- [ ] **Step 2:** Write `tokens.css` with every token above, light and dark. Write `base.css`: reset, `html { font-size: 13px }`, body font and colours, `font-variant-numeric: tabular-nums`, `:focus-visible` ring (2 px `--sp-color-focus`, 2 px offset), `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important } }`, visually-hidden utility `.sp-sr-only`.
- [ ] **Step 3:** `App.tsx` renders `<div className="sp-app">Stacking plan</div>`; `main.tsx` imports the three stylesheets.
- [ ] **Step 4:** `vitest.config.ts` with `test.environment = 'node'`, include `src/**/*.test.ts`. Add scripts to `package.json`.
- [ ] **Step 5:** Run `npm run build` → exits 0; `npm test` → "no test files" exits 0 (use `--passWithNoTests`).
- [ ] **Step 6:** Commit `chore: project foundation with SLDS-style tokens`.

### Task 2: Domain types and mock building

**Files:**
- Create: `src/domain/types.ts`, `src/data/mock/property.ts`, `src/data/mock/footprint.ts`, `src/data/mock/area.ts`, `src/data/mock/property.test.ts`

**Interfaces:**
- Produces `types.ts`: `ISODate`, `LeaseType`, `RateUnit`, `DealStage = 'Tour'|'Proposal'|'LOI'|'Lease Out'`, `Deal`, `Unit`, `Lease` (as v1 plus `verifiedAt: ISODate`), `Availability` (v1 plus `kind: 'Lease'|'Sale'`, `askingPrice?: number`, `verifiedAt: ISODate`), `Inquiry`, `Floor`, `Change { id; at: ISODate; by: string; recordType: 'Lease'|'Availability'|'Deal'|'Floor'; recordLabel: string; field: string; from: string|null; to: string|null; floorId?: string; segKey?: string }`, `AreaRing { miles: 1|3|5; population: number; households: number; medianIncome: number; medianAge: number; bachelorsPct: number; meanCommuteMin: number }`, `Area { source: string; asOf: string; sample: boolean; rings: AreaRing[]; transit: Array<{ name: string; type: 'Rail'|'Bus'; distanceMi: number }>; amenities: Array<{ category: string; count: number }> }`, `GeoPolygon = { type: 'Polygon'; coordinates: number[][][] }`, `SaleListing { price: number; capRate: number|null; broker: string; status: 'Active'|'Under Contract' }`, `Property` (v1 plus `footprint: GeoPolygon`, `footprintSource: 'osm'|'demo'`, `floorHeightFt: number`, `saleListing: SaleListing|null`, `history: Change[]`, `area: Area`).
- Produces `property.ts`: `export const property: Property`, `export const TODAY = '2026-11-09'`. Building: Preston Park Financial Center, 12 floors, same leases/availabilities/inquiries as v1 (`redesign/src/data/mock.ts` in the main repo) with: F1 `nonLeasable` 8,000 and a new Sale availability `A10` suite 130, 2,600 SF, `askingPrice` 1,027,000, order 4; `saleListing` { price 68,500,000, capRate 0.064, broker 'Lakeside Realty Partners', status 'Active' }; `floorHeightFt` 13.5; `history` with 9 changes dated 2026-10-12 to 2026-11-06 (lease expiration updated, availability closed, deal stage moved, new availability, rent changed, holdover flagged, unit SF corrected, termination recorded, inquiry linked); every Lease and Availability has `verifiedAt` (most 2026-10-28 to 2026-11-06; Bowline Consulting 2026-06-02 so one record is stale).
- Produces `footprint.ts`: `export const footprint: GeoPolygon` (OSM polygon if the Overpass probe in `/tmp/overpass-ok.json` succeeded, else a demo polygon ~62 m × 38 m centred on 33.0228, −96.7943) and `export const footprintSource`.
- Produces `area.ts`: `export const area: Area` with `sample: true`, `source: 'Sample figures for the demo. Live mode uses US Census Bureau ACS 5-year via api.census.gov (free key required).'`, three rings, 4 transit entries, 6 amenity categories.

- [ ] **Step 1:** Write `property.test.ts`: ids unique across floors, leases, units, availabilities, deals, inquiries; every floor's open availabilities + units ≤ leasable except F7 which exceeds by exactly 500; exactly one `kind: 'Sale'` availability; `history.length === 9` and every `at` ≤ TODAY.
- [ ] **Step 2:** Run `npm test` → fails (module missing).
- [ ] **Step 3:** Write `types.ts`, `property.ts`, `footprint.ts`, `area.ts`.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat(domain): types and mock building`.

### Task 3: Dates and formatting

**Files:**
- Create: `src/domain/dates.ts`, `src/domain/format.ts`, `src/domain/dates.test.ts`, `src/domain/format.test.ts`

**Interfaces:**
- `dates.ts`: `monthsBetween(from, to): number` (whole months toward zero), `daysBetween`, `yearsBetween`, `addMonths(d, n): ISODate`, `yearOf`, `fmtDate` ("Sep 30, 2028"), `fmtMonthYear` ("Sep 2028"), `fmtMonthYearShort` ("Sep '28"), `fmtMonths(m: number): string` (0→"0 mo", 4→"4 mo", 14→"1 yr 2 mo", 24→"2 yr", negative → "expired"), `isoToday(): ISODate` (not used by domain; UI only).
- `format.ts`: `sf(n)` "21,400 SF", `num`, `pct(ratio)` "87.0%", `pct0`, `rate(value, unit, type)`, `rateRange`, `compactRate`, `annualRate`, `usd(n)`, `usdCompact(n)` ("$68.5M", "$1.03M", "$395"), `plural(n, one, many?)`.

- [ ] **Step 1:** Tests: `monthsBetween('2026-11-09','2027-03-31') === 4`, `monthsBetween('2026-11-09','2026-08-31') === -2`, `fmtMonths(14) === '1 yr 2 mo'`, `fmtMonths(-3) === 'expired'`, `rate(31.5,'yr','FSG') === '$31.50/SF/yr FSG'`, `rate(3.25,'mo','NNN') === '$3.25/SF/mo NNN'`, `usdCompact(68500000) === '$68.5M'`, `usdCompact(1027000) === '$1.03M'`, `pct(0.87) === '87.0%'`.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement. **Step 4:** PASS. Commit `feat(domain): dates and formatting`.

### Task 4: Segments and floor views (`derive.ts`)

**Files:**
- Create: `src/domain/derive.ts`, `src/domain/derive.test.ts`

**Interfaces:**
- `SegmentKind = 'leased'|'holdover'|'mtm'|'available'|'sublease'|'committed'|'projected'|'unmarketed'|'forsale'`.
- `Segment` as v1 (`key, floorId, kind, size, order, suite, lease?, unit?, availability?, marketed?, next?, endDate, monthsToExpiry, origin?, headMonths?, suspect?, availableFrom?`).
- `FloorView { floor, leasable, segments, leased, available, maxContiguous, bestRun: string[], overAllocatedBy, orphanSubleases }`.
- `deriveFloors(p: Property, asOf: ISODate, today: ISODate): FloorView[]` (top floor first), `leaseEnd(l)`, `isLeaseKind(k)`, `activeDeals(deals)`, `leaseFloors(p, lease): Floor[]`, `segmentIndex(floors): Map<string, Segment>`.
- Rules: port v1 `deriveFloor` (main repo `redesign/src/lib/derive.ts` lines 70–260) and add: a `kind: 'Sale'` open availability with no occupant becomes `forsale`; `forsale` counts as neither leased nor available-for-lease; it is excluded from `maxContiguous`.

- [ ] **Step 1:** Tests (today): L06-U1 holdover; L04-U1 mtm; L09-U1 committed; L13-U1 leased with `marketed.availableFrom === '2027-04-01'`; L14-U2 sublease; `F2-gap` suspect is Delta Dental Plan; A10 is `forsale`; F7 `overAllocatedBy === 500` and `leased === leasable`; F8 `maxContiguous === 7400`. Time travel: at 2027-02-01 L09-U1 leased; at 2027-05-01 key A04 is `available`; at 2027-06-01 L12-U1 is `projected`. Review Focus 1 and 2 are these assertions.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** PASS. Commit `feat(domain): derive floor segments`.

### Task 5: KPIs and rollover

**Files:**
- Create: `src/domain/kpis.ts`, `src/domain/rollover.ts`, tests for both

**Interfaces:**
- `Kpis` as v1 plus `forSale: number`, `leaseCount: number`, `expiring12Leases: number`.
- `computeKpis(p, floors, asOf): Kpis`; `kpiDeltas(now: Kpis, base: Kpis): { leased: number; occupancy: number; availableDirect: number; availableSublease: number; expiring12: number; walt: number; pipelineDeals: number }` (now minus base).
- `rollover(floors, asOf, mode: 'rolling'|'calendar' = 'rolling', periods = 8): { buckets: RolloverBucket[]; atRisk: number; overAllocated: Array<{floor: string; sf: number}> }`, `bucketOf(seg, mode, tailKey?)`. Port v1 exactly (lines 400–560 of the v1 file).

- [ ] **Step 1:** Tests: today `occupancy` ≈ 0.87 (within 0.005), `expiring12 === 35300`, `walt` between 2.9 and 3.1, `pipeline.deals === 9`, `forSale === 2600`, `rentByType[0].type === 'FSG'`; `kpiDeltas(at 2028-01-01, today).leased < 0`; rollover rolling bucket 0 sf === 35300; calendar mode has a `2034+`-style tail label.
- [ ] Steps 2–4 as usual. Commit `feat(domain): kpis and rollover`.

### Task 6: Lenses, tones and legend shares

**Files:**
- Create: `src/domain/lenses.ts`, `src/domain/lenses.test.ts`

**Interfaces:**
- `LensId`, `LENSES`, `Tone` (string token name), `LegendItem { tone; label; pattern?: 'hatch'|'dots'|'dashed'|'topbar'|'asking'; sf: number; share: number }`.
- `toneFor(seg, lens, safe): Tone` as v1 plus `forsale → 'forsale'` in status, `'muted'` in other lenses; `legendFor(lens, safe, floors): LegendItem[]` computes `sf` and `share` (of leasable) per item from the floors; `topDeal`, `dealCount`, `rentValue`, `rentType`, `stageRank`, `isVacantKind`.

- [ ] **Step 1:** Tests: status tones for the seven known segments; `legendFor('status', false, floors).find(i => i.tone === 'available').sf === 26200`; shares sum ≤ 1.001; prospect-safe legend has no `risk` or `expiring` item; rent lens: Halcyon (confidential) → `confidential`; NNN lease → `rent-net`.
- [ ] Steps 2–4. Commit `feat(domain): lenses and legend with shares`.

### Task 7: Space finder and inquiry matching

**Files:**
- Create: `src/domain/finder.ts`, `src/domain/finder.test.ts`

**Interfaces:**
- `FitOption` as v1; `findFits(floors, req, neededBy?, maxSize?, inquiries?, asOf?): { options; keys: Set<string>; largestNow }`; `matchingInquiries(inquiries, space, asOf)`. Port v1 (lines 262–400). `forsale` segments are never options.

- [ ] **Step 1:** Tests: `req 12000` today → first option is Floor 12 9,300? No: 9,300 < 12,000, so first on-time option is multi-floor or Floor 6 marketed 21,400 from 2027-04-01; assert `options.some(o => o.multiFloor)`, every option `size >= 12000`; `req 4000` → Floor 1 suite 120 appears with `inquiries` count from I03; inquiry I02 (15,000–22,000 by 2027-06-30) matches A04.
- [ ] Steps 2–4. Commit `feat(domain): finder`.

### Task 8: Data issues and recent changes

**Files:**
- Create: `src/domain/issues.ts`, `src/domain/issues.test.ts`

**Interfaces:**
- `Issue`, `IssueSeverity`, `findIssues(p, floors, today): Issue[]` (port v1 lines 560–760) plus a new `stale-record` info issue when `verifiedAt` is more than 120 days before today ("Bowline Consulting lease not verified since Jun 2, 2026", fix "Verify lease").
- `recentChanges(p, today, days = 30): Change[]` sorted newest first.
- `staleDays = 120` exported.

- [ ] **Step 1:** Tests: issues include ids `nounits-L05`, `nofloor-L20`, `over-F7`, `conflict-…` absent today, `hold-L06-U1`, `mtm-L04-U1`, `stale-L04` (verifiedAt); `recentChanges` returns 9 and is sorted descending.
- [ ] Steps 2–4. Commit `feat(domain): issues and change log`.

### Task 9: Layout maths, timeline model, geometry

**Files:**
- Create: `src/domain/layout.ts`, `src/domain/timeline.ts`, `src/domain/geometry.ts`, tests for each

**Interfaces:**
- `layout.ts`: `floorWidths(floors: FloorView[], maxPx: number, minShare = 0.6): Map<string, number>` (proportional to leasable, floor at `minShare × maxPx`, widest = maxPx); `blockLayout(segs: Segment[], floorPx: number, minPx = 56, gap = 2): Array<{ key: string; x: number; w: number; enlarged: boolean }>` (proportional, enlarge any block below `minPx` to `minPx`, shrink the rest proportionally so the sum plus gaps equals `floorPx`); `textTier(w: number): 0|1|2|3` (≥200→0, ≥120→1, ≥64→2, else 3).
- `timeline.ts`: `TimelineBar { key; segKey: string; label: string; start: ISODate; end: ISODate|null; kind: SegmentKind; sublease: boolean }`, `TimelineRow { floor: Floor; bars: TimelineBar[] }`, `timelineModel(p, floors, asOf, today): { start: ISODate; end: ISODate; rows: TimelineRow[] }` where `start` = min(commencement, today − 12 mo) and `end` = asOf + 10 yr; `dateToX(d, start, end, width): number`, `xToDate(x, start, end, width): ISODate` (clamped, month resolution).
- `geometry.ts`: `projectPolygon(poly: GeoPolygon, size: { w: number; h: number }, pad = 8): Array<[number, number]>` (equirectangular, fit and centre); `longAxisAngle(points): number`; `slicePolygon(points, shares: number[]): Array<Array<[number, number]>>` (rotate to long axis, cut with vertical lines at cumulative share × bbox width, clip by half-planes, rotate back); `extrusionFeatures(p, floors, toneOf: (f: FloorView) => string, floorHeightFt): GeoJSON FeatureCollection` with one Polygon feature per floor and properties `{ floorId, name, base, height, tone, leasedPct }` (metres, base = (sequence−1) × height).

- [ ] **Step 1:** Tests: `blockLayout` of sizes [12500, 7000, 2400] at 300 px gives the 2,400 block exactly 56 px and `enlarged: true`, widths sum to `300 − 2×2`; `textTier(199) === 1`; `floorWidths` widest floor === maxPx, F12 ≥ 0.6 × maxPx; `timelineModel` start ≤ '2016-09-01', end === '2036-11-09'; `xToDate(dateToX(d))` round-trips to the same month; `slicePolygon` of a rectangle into [0.5, 0.5] gives two polygons each with area ≈ half (±2 %); `extrusionFeatures` has 12 features and floor 12 base ≈ 11 × 13.5 × 0.3048.
- [ ] Steps 2–4. Commit `feat(domain): layout, timeline and geometry`.

### Task 10: Prospect-safe helpers, CSV export, URL state

**Files:**
- Create: `src/domain/safe.ts`, `src/domain/exportCsv.ts`, `src/state/planState.ts`, `src/state/usePlanState.ts`, tests for the three pure modules

**Interfaces:**
- `safe.ts`: `tenantLabel(lease: Lease, safe: boolean): string` → safe ? 'Tenant' : lease.tenant; `prospectLabel(deal, safe)` → 'Prospect'; `rentVisible(lease|availability, safe): boolean` (false when safe or confidential); `SAFE_TITLE = 'Stacking plan (prospect-safe)'`.
- `exportCsv.ts`: `rentRollRows(p, floors, asOf, safe): string[][]` header `['Floor','Suite','Tenant','RSF','State','Commencement','Expiration','Months remaining','Rate','Unit','Lease type','Live deals']`, `toCsv(rows): string` (RFC 4180 quoting).
- `planState.ts`: `View = 'stack'|'timeline'|'map'|'floor'`, `InspectorMode = 'building'|'block'|'floor'|'find'|'worklist'|'issues'|'area'`, `WindowKey = 'risk'|'90'|'180'|'12'|'24'`, `PlanState { view; lens; asOf; select: string|null; floor: string|null; safe: boolean; req: number|null; max: number|null; by: ISODate|null; window: WindowKey|null; bucket: number|null; inquiry: string|null; q: string; mode: InspectorMode; live: boolean; census: string|null; theme: 'light'|'dark'|null }`, `DEFAULT_STATE`, `parseState(search: string, today: ISODate): PlanState`, `serializeState(s: PlanState): string` (omits defaults), `deriveMode(s): InspectorMode` (select → block, floor → floor, req/inquiry → find, window → worklist, explicit mode otherwise).
- `usePlanState.ts`: `usePlanState(): [PlanState, (patch: Partial<PlanState>) => void]` backed by `history.replaceState`, listens to `popstate`.

- [ ] **Step 1:** Tests: `parseState('?lens=expiry&asOf=2028-01-01&safe=1&req=12000')` fields; `serializeState(DEFAULT_STATE) === ''`; round-trip; `rentRollRows(..., true)` contains no tenant name from the mock and no `$`; `toCsv([['a,b','c"d']]) === '"a,b","c""d"'`.
- [ ] Steps 2–4. Commit `feat: prospect-safe helpers, csv, url state`.

### Task 11: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`, `Chip.tsx`, `Segmented.tsx`, `Popover.tsx`, `Menu.tsx`, `Toast.tsx` (+ `useToast`), `Icon.tsx` (inline SVG sprite: building, calendar, search, filter, download, warning, lock, deal, inquiry, phone, external, close, chevron, play, record, map, layers, list, info, check, arrow), `Tooltip.tsx`, `Sheet.tsx` (bottom sheet with handle, snap 45 % / 90 %), `Field.tsx` (label + input), `Switch.tsx`, `VisuallyHidden.tsx`; one `ui.css`.

**Interfaces:** Button `variant: 'brand'|'neutral'|'ghost'|'danger'`, `size: 'sm'|'md'`, `icon?`; Segmented `options: Array<{ id; label; icon? }>`, `value`, `onChange`, `aria-label`; Popover `trigger` render-prop, `open`, `onOpenChange`, focus trap, Esc, returns focus; Menu items with `onSelect`; Toast `push(message, { action? })`; Switch `checked`, `onChange`, label visible.

- [ ] **Step 1:** Implement all with keyboard support (roving focus in Segmented and Menu, Esc in Popover/Sheet/Menu). 44 px minimum touch target on `sm` via padding on touch media.
- [ ] **Step 2:** `npm run build` passes; render each in a temporary `Playground` route (`?dev=ui`) and check with axe in Task 21. Commit `feat(ui): primitives`.

### Task 12: Shell: header, as-of popover, KPI strip, toolbar

**Files:**
- Create: `src/components/shell/Header.tsx`, `AsOfPopover.tsx`, `SaleBanner.tsx`, `shell.css`; `src/components/kpis/KpiStrip.tsx`, `kpis.css`; `src/components/shell/Toolbar.tsx`; `src/App.tsx` (layout grid, derives the model once with `useMemo`: `floors`, `kpis`, `kpisToday`, `rollover`, `issues`, `legend`, `fits`, `changes`)
- Create: `src/model/usePlanModel.ts` exporting `usePlanModel(state): PlanModel` with the derived fields above and `today`.

**Interfaces:** `Header` props `{ property; state; patch; issuesCount; onExport(kind: 'pdf'|'png'|'csv'|'link'|'video') }`; `AsOfPopover` props `{ asOf; today; onChange; miniTimeline: ReactNode }`, presets Today, +6 mo, +12 mo, +24 mo, +5 yr; `KpiStrip` props `{ kpis; deltas: ReturnType<typeof kpiDeltas>|null; safe; onAction(action: 'status'|'find'|'find-largest'|'expiry-worklist'|'timeline'|'deals') }` renders the six cards from DESIGN §2.2 as `<button>`s; `Toolbar` props `{ state; patch; onFind; onWorklist }`.

- [ ] **Step 1:** Implement; header facts line uses `num(kpis.leasable) + ' RSF leasable'`, verified stamp from the latest `verifiedAt`; "Projected" amber chip when `asOf !== today`; `SaleBanner` renders only when `saleListing` exists: "Listed for sale · $68.5M · 6.4 % cap · Lakeside Realty Partners".
- [ ] **Step 2:** Build; screenshot `?view=stack` at 1440 px and eyeball against DESIGN §2.1–2.3 (three bands only). Commit `feat(shell): header, as-of, kpis, toolbar`.

### Task 13: Stack view

**Files:**
- Create: `src/components/stack/StackView.tsx`, `FloorRow.tsx`, `Block.tsx`, `BlockText.tsx`, `Legend.tsx`, `Patterns.tsx` (SVG `<defs>` for hatch, dots, asking, dashed), `FilterBar.tsx`, `stack.css`; `src/lib/textFit.ts` (`measure(text, font): number` via a shared canvas, memoised; `fitWords(text, maxPx, font): string` returns the longest prefix of whole words that fits, never a partial word).

**Interfaces:** `StackView` props `{ model: PlanModel; state; patch; width: number }`; emits `patch({ select })`, `patch({ floor, mode: 'floor' })`. Blocks are `<g role="gridcell"><rect/>…<title>` inside `<g role="row">`; one `<button>`-like focusable `<g tabindex>` per block with roving tabindex; keys: ← → within a floor, ↑ ↓ between floors (nearest x), Home/End, Enter/Space select, Esc clears selection. Dimming applies when `state.q`, `state.req`, `state.inquiry`, `state.window` or `state.bucket` is set: match predicate from the model (`model.highlight: Set<string>|null`). `FilterBar` shows the active filter sentence ("Showing space that fits 12,000 SF · 4 options") with Clear. Legend shows `label · sf · share` per item plus the footnote "Suites under 56 px are enlarged for legibility" when any block was `enlarged`.

- [ ] **Step 1:** Implement per DESIGN §2.4 (tiers, badges, tones via `--tone-*` CSS vars, selection ring, dimming, filter bar).
- [ ] **Step 2:** Playwright smoke in `scripts/verify.mjs` (Task 21) will check: 12 rows, block count, focus moves with arrows. Build and screenshot. Commit `feat(stack): plan view`.

### Task 14: Inspector: container, Building, Block, Floor modes

Before writing the rollover chart, load the `dataviz` skill.

**Files:**
- Create: `src/components/inspector/Inspector.tsx`, `BuildingPanel.tsx`, `RolloverChart.tsx`, `BlockPanel.tsx`, `FloorPanel.tsx`, `Actions.tsx`, `inspector.css`

**Interfaces:** `Inspector` props `{ model; state; patch; mode: InspectorMode; onClose() }` renders title row + panel; `RolloverChart` props `{ buckets; atRisk; activeBucket: number|null; onBucket(key|null); safe }` as an SVG bar chart with value labels, keyboard-focusable bars (`role="button"`); `BlockPanel` props `{ seg: Segment; model; state; patch }` with sections from DESIGN §2.8 and `Actions` (toast stubs: "Would open Lease L13 in Salesforce"); `FloorPanel` props `{ floor: FloorView; … }` with "Open floor plate" → `patch({ view: 'floor', floor })`.

- [ ] **Step 1:** Implement. Building panel order: Rollover, At risk, Coming supply, Pipeline by stage, Data issues (count + "Review"), Recent changes (first 5, "by · date · what").
- [ ] **Step 2:** Build; screenshots `?select=L13-U1`, `?select=A02`, `?select=F2-gap`. Commit `feat(inspector): building, block, floor panels`.

### Task 15: Inspector: Find space, Worklist, Issues

**Files:**
- Create: `src/components/inspector/FindPanel.tsx`, `WorklistPanel.tsx`, `IssuesPanel.tsx`

**Interfaces:** `FindPanel` fields bound to `state.req`, `state.max`, `state.by`, type filter (`'any'|'direct'|'sublease'`, local), inquiry select (`state.inquiry` pre-fills req/max/by from the Inquiry); result rows call `patch({ select: keys[0] })` and hover highlights keys. `WorklistPanel` chips bind `state.window`; rows from `model.worklist(window)`: leases with months ≤ window (risk = holdover + MTM), columns per DESIGN; "Export CSV" uses `rentRollRows` filtered. `IssuesPanel` groups by severity; "Locate" → `patch({ select: segKey, floor })`.

- [ ] **Step 1:** Add to `usePlanModel`: `highlight` (union of finder keys / search matches / worklist keys / bucket keys), `worklist(window)`, `searchMatches(q)` (tenant, suite, prospect, broker; in safe mode suites and floors only, Review Focus 3).
- [ ] **Step 2:** Implement panels. Screenshots `?req=12000`, `?window=12`, `?mode=issues`, `?inquiry=I02`. Commit `feat(inspector): find, worklist, issues`.

### Task 16: Timeline view

**Files:**
- Create: `src/components/timeline/TimelineView.tsx`, `TimelineAxis.tsx`, `TimelineRow.tsx`, `AsOfCursor.tsx`, `MiniTimeline.tsx` (used by the as-of popover), `timeline.css`

**Interfaces:** `TimelineView` props `{ model; state; patch; width }`; renders SVG: header band with rollover totals per 12-month bucket from the cursor, axis with year lines, rows grouped by floor (floor label gutter 72 px), bars via `timelineModel` coloured with `toneFor` of the matching segment, MTM bars fade (gradient) with tag, holdover bars rose past expiry, committed hatched, availability bars teal from available-from. `AsOfCursor` is draggable (pointer events, `setPointerCapture`), keyboard: ← → ±1 month, Shift ±12, Home = today; commits `patch({ asOf })` on every move (model recomputes). Tooltip on bar hover/focus with exact dates and `fmtMonths`.

- [ ] **Step 1:** Implement; `MiniTimeline` is the same component at 280 × 48 px, bars only, no labels.
- [ ] **Step 2:** Build; screenshots `?view=timeline`, `?view=timeline&asOf=2028-01-01&lens=expiry`. Commit `feat(timeline): lease timeline with as-of cursor`.

### Task 17: Map view with 3D floors, Present, Record, Area panel

**Files:**
- Create: `src/components/map/MapView.tsx`, `useMapLibre.ts`, `FootprintFallback.tsx`, `MapControls.tsx`, `usePresent.ts`, `useRecorder.ts`, `map.css`; `src/components/inspector/AreaPanel.tsx`; `src/data/sources/DataSource.ts`, `MockSource.ts`, `OverpassSource.ts`, `CensusSource.ts`
- Install: `npm i maplibre-gl@^5`

**Interfaces:** `DataSource { getFootprint(p): Promise<{ polygon: GeoPolygon; source: 'osm'|'demo' }>; getArea(p): Promise<Area> }`; `MockSource` returns the cached mock; `OverpassSource` POSTs to `https://overpass-api.de/api/interpreter` with a User-Agent-free fetch and falls back to mock on any error; `CensusSource(key)` uses TIGERweb `Tracts_Blocks/MapServer/0/query` with `distance` 1609 × miles to list GEOIDs, then `api.census.gov/data/2023/acs/acs5` for `B01003_001E,B19013_001E,B01002_001E,B11001_001E,B15003_022E,B15003_001E,B08013_001E,B08012_001E` and aggregates (population-weighted medians approximated by weighted mean, labelled "approx."); without a key returns mock with `sample: true`. `MapView` props `{ model; state; patch; dataSource }`: style `https://tiles.openfreemap.org/styles/positron` (light) / `.../dark` (dark); adds source `floors` from `extrusionFeatures` and a `fill-extrusion` layer with `fill-extrusion-base`/`-height` from properties and colour from a tone→hex map (resolved from CSS variables at mount); 3D buildings layer from the style's `building` source-layer in `#CFD4DA` at 0.6 opacity; hover sets `feature-state` hover; click → `patch({ floor, mode: 'floor' })`. `MapControls`: zoom, compass, pitch, Present toggle, Record. `usePresent`: `requestAnimationFrame` loop rotating bearing 0.15°/frame and advancing `asOf` one month every 900 ms over 5 years, paused under reduced motion. `useRecorder`: `canvas.captureStream(30)` → `MediaRecorder` (`video/webm`) → Blob download `stacking-plan.webm`, with a notice when unsupported. `FootprintFallback` renders the projected polygon as SVG with floors as stacked horizontal bands coloured by tone when `maplibregl.supported()` is false or style load fails (Review Focus 5). `AreaPanel` shows rings table, transit list, amenity chips, a "Sample data" badge when `area.sample`, and the source line.

- [ ] **Step 1:** Implement `DataSource`s with tests for `CensusSource.aggregate(rows)` (pure) and `OverpassSource.toPolygon(elements)` (pure, picks the way whose centroid is nearest the property).
- [ ] **Step 2:** Implement the map; verify in Chrome that floors extrude and click selects; screenshot `?view=map`, `?view=map&lens=expiry`, `?view=map&mode=area`. Commit `feat(map): 3D floors on OpenStreetMap, present, record, area`.

### Task 18: Floor plate drill-in

**Files:**
- Create: `src/components/floor/FloorView.tsx`, `FloorPlate.tsx`, `FloorLists.tsx`, `floor.css`

**Interfaces:** `FloorView` props `{ model; state; patch }`: breadcrumb "Stack › Floor 6" (Back → `patch({ view: 'stack' })`), prev/next floor buttons (and ← → keys), left mini-stack (12 thin rows, current highlighted, clickable), `FloorPlate` draws `projectPolygon(footprint, 560×420)` then `slicePolygon` with segment shares in `order`, each slice a focusable `<path>` with the block text tiers (tier by slice bbox width) and the same tones; caption "Schematic: suite positions are proportional to RSF, not surveyed"; right column floor KPIs and `FloorLists` tabs Suites / Deals / Inquiries that fit / Issues.

- [ ] **Step 1:** Implement. Screenshot `?view=floor&floor=F6`, `?view=floor&floor=F1`. Commit `feat(floor): floor plate drill-in`.

### Task 19: Prospect-safe everywhere and exports

**Files:**
- Modify: every component that prints a tenant, contact, rent, price or prospect to go through `safe.ts`
- Create: `src/lib/exportPng.ts` (`svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob>` inlining computed styles), `src/lib/exportFile.ts` (`download(blob, name)`), `src/components/shell/ExportMenu.tsx`, `src/components/print/PrintLayout.tsx` (cover, plan, rent roll, rollover + worklist; `print.css` landscape Letter)
- Create: `scripts/leakcheck.mjs`: loads every view and inspector mode with `safe=1`, asserts no mock tenant, contact or prospect name and no `$` appears in `document.body.innerText`, `title`, or any `aria-label`/`<title>` attribute.

- [ ] **Step 1:** Write `leakcheck.mjs`; run against a build → fails until all paths are redacted.
- [ ] **Step 2:** Redact; implement exports: PDF = `window.print()` after mounting `PrintLayout`; PNG from the stack SVG; CSV via `toCsv(rentRollRows(...))`; link = `navigator.clipboard.writeText(location.href)`; `document.title` switches to `SAFE_TITLE` when safe.
- [ ] **Step 3:** `node scripts/leakcheck.mjs` → "0 leaks". Commit `feat: prospect-safe everywhere, pdf/png/csv exports`.

### Task 20: Responsive and dark theme pass

**Files:**
- Modify: all `*.css`; `src/components/shell/Layout.tsx` (inspector reflow ≥ 1100 px, `Sheet` below)
- Create: `src/lib/useMedia.ts` (`useMedia(query): boolean`)

- [ ] **Step 1:** Implement breakpoints from DESIGN §4; KPI strip scroll-snap; lens `<select>` under 760 px; floor gutter number-only; timeline horizontal scroll; `data-theme` from `state.theme` else system.
- [ ] **Step 2:** Screenshots at 390 × 844 (`?view=stack`, `?select=A02`, `?view=timeline`, `?view=map`) and 1440 dark. Fix anything clipped. Commit `feat: responsive and dark theme`.

### Task 21: Verification scripts, judge prompt, round 0

**Files:**
- Create: `scripts/shots.mjs` (states: 00 stack status, 01 expiry, 02 deals, 03 rent, 04 select L13-U1, 05 select A02, 06 issues, 07 asOf 2028, 08 req 12000, 09 bucket 1, 10 safe, 11 q=vantage, 12 window 12, 13 F2-gap, 14 inquiry I02, 15 window risk, 16 timeline, 17 timeline 2028 expiry, 18 map, 19 map expiry, 20 map area, 21 floor F6, 22 floor F1, 23 mobile stack, 24 mobile panel, 25 mobile timeline, 26 dark stack, 27 dark map, 28 print emulation, 29 select L17-U1 multi-floor), `scripts/a11y.mjs` (axe on stack, timeline, map, floor, each inspector mode; fail on serious/critical), `scripts/verify.mjs` (row and block counts, keyboard navigation, as-of change updates KPI text, no console errors), `scripts/pdf.mjs` (Chrome `page.pdf` landscape Letter for owner stack, owner timeline, prospect-safe stack → `docs/shots/round-N/pdf/`)
- Create: `docs/JUDGE_PROMPT.md` adapted from the v1 judge brief: repo path, shot index above, URL params, rubric reference, "read-only", output structure, round folder.
- Modify: `package.json` scripts.

- [ ] **Step 1:** Build to `dist-judge`, `npm run preview` on 4173, run `verify`, `a11y`, `leakcheck`, `shots docs/shots/round-0`, `pdf`.
- [ ] **Step 2:** All green. Commit `chore: verification scripts, judge prompt, round 0 shots`.

### Task 22: Judge council loop

- [ ] **Step 1:** Run three judges via `delegate_task` (Muse Wonder on `cursor`; two Claude Opus 5.5 on `claudeAgent`, effort high) with `docs/JUDGE_PROMPT.md` and the round number. Save each report to `docs/judging/round-N/<judge>.md`.
- [ ] **Step 2:** Compute averages; if combined < 38/40 or either dimension < 18.5, implement the top fixes that at least two judges agree on, rebuild to `dist-next`, verify, promote to `dist-judge`, shoot `round-N+1`, repeat.
- [ ] **Step 3:** When the target is met, write `docs/judging/SUMMARY.md` with the score history and commit `docs: judge council results`.
