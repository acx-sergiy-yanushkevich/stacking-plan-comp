# Storyline: design specification

Status: approved direction (2026-11-09). Prototype / proof of concept: no backend, mock data shaped like xRE objects, live calls only to free public services behind a `?live=1` flag with cached fallbacks.

## 1. Intent

Turn the Stacking Plan tab from a picture of a building into the place a leasing team runs the building from. One screen answers "where is the space, who leaves when, who is looking, and what is wrong with the data", and the same model renders as a 2D plan, a lease timeline, a 3D building on the real map, and a floor-by-floor drill-down.

Design principles, in order:

1. **The plan is the hero.** At most three bands sit above it (header, KPIs, one toolbar). Everything else lives in the inspector on the right or in a popover.
2. **Exact, labelled numbers.** RSF never rounded. Rates always carry unit and lease type. Months measured from the as-of date.
3. **Colour is never the only cue.** Every state also has a pattern, border or label. Palettes are colour-blind safe and lightness-ordered for sequential lenses.
4. **Nothing invented.** Schematic floor plates and demographics are labelled with their source and their limits.
5. **Native to Lightning.** Tokens mirror SLDS 2 styling hooks; type, radii, borders and focus rings match a record page.

## 2. Screen anatomy (desktop, ≥ 1200 px)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [▣] Stacking plan · Preston Park Financial Center        [As of Nov 9, 2026 ▾]       │
│     Class A Office · 4965 Preston Park Blvd, Plano TX    [Prospect-safe ○] [⚠ 6] [Export ▾] │
│     242,800 RSF leasable · 12 floors · ● Verified Nov 6                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ LEASED 87.0% │ AVAILABLE 33,200 │ LARGEST BLOCK 9,300 │ EXPIRING 12 MO 35,300 │ WALT 3.0 yr │ PIPELINE 9 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Stack] [Timeline] [Map]   Colour by [Status][Expiration][Deals][Rent]  🔍 Find…  [Find space] [Worklist] │
├───────────────────────────────────────────────────────────┬─────────────────────────┤
│ legend: ■ Available ▨ Sublease ▤ Committed ■ Leased …     │ INSPECTOR               │
│ 12 │ 50% ▰▰▱▱ │ ████████████████ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │ Building (default)      │
│ 11 │100% ▰▰▰▰ │ ████████████████ ████████████████████      │  Rollover 8 buckets     │
│ …                                                         │  At risk · Coming supply│
│  1 │ 67% ▰▰▰▱ │ ██ ████ ░░░░░░ lobby ░░░░░░ ▓▓▓▓            │  Pipeline by stage      │
│                                                           │  Data issues · Changes  │
└───────────────────────────────────────────────────────────┴─────────────────────────┘
```

### 2.1 Header
- Object icon tile (SLDS standard-object style, brand blue), title "Stacking plan", property name as the subtitle link, a one-line facts row.
- **As of** button: shows the date; amber "Projected" treatment when not today. Opens a popover with a date field, presets (Today, +6 mo, +12 mo, +24 mo, +5 yr) and a miniature of the lease timeline as a scrubber. Esc closes, focus returns.
- **Prospect-safe** switch: hides tenant names, contacts, rents and deal prospects everywhere, including the inspector, exports and the timeline. A persistent chip in the header says "Prospect-safe on".
- **Issues** button with count: opens the inspector in Issues mode.
- **Export** menu: PDF (print layout), PNG of the current plan, Excel-ready CSV rent roll, Copy link, and in Map view, Record video.

### 2.2 KPI bar
One quiet bar above the toolbar, the same element in the same place in every view and every state (Building with and without a floor open, Stack, Timeline, Map, Floor; with and without the inspector), so the toolbar and the plan never move when the view or the selection changes. One surface, about 55 px tall on a desktop, with hairlines between six figures; no figure is a card of its own. Each figure: label 11 px uppercase and value 18 px semibold tabular on one line, one short muted note under them. A note is shown whole or not at all (never cut); the whole note is in the tooltip and the accessible name. When the as-of date is not today, each figure carries a delta chip against today ("−6,500 SF"): beside the figure from 1600 px, leading the note line under that. The figure in use is marked by a 2 px underline and `aria-pressed`. Under 1200 px the figure stands under its label and the notes are left to the tooltips; on a phone the six are a 3 × 2 grid. Each figure is a button that applies the related view or lens (the table's Context column is the whole note):

| Card | Value | Context | Click |
|---|---|---|---|
| Leased | 87.0 % | 81.0 % physically occupied · 8,000 SF signed, not in | Status lens |
| Available | 33,200 SF | 26,200 direct · 7,000 sublease · +21,400 coming Apr 2027 | Find space |
| Largest block | 9,300 SF | Floor 12 · direct · divisible to 4,500 | Find space, pre-filled |
| Expiring 12 mo | 35,300 SF | 16.7 % of leased · 4 leases | Expiration lens + Worklist 12 mo |
| WALT | 3.0 yr | In-place, SF-weighted · MTM counted as 0 | Timeline |
| Pipeline | 9 deals | 6 on vacancies · 3 renewals · 57,800 SF | Deals lens |

Two figures are made of suites anyone can point to, and the plan shows where they are. Pointing at **Available** or **Largest block** (or focusing it) lights its suites and greys the rest, as a finder match does: on the building model, in the Stack and on the plate of an open floor that holds any of them. Moving away or blurring restores the plan at once; it is a transient highlight (the hover store), never URL state, and the click still opens the finder. The largest block is also marked at rest, in words: a "Largest block" badge on each of its suites in the Stack and on the floor plate, and a "Largest block" tag on its floor's label beside the building model. One rule (`largestBlock`, domain/kpis.ts) gives the KPI its figure and the plan its suites. The mark stays in prospect-safe mode: available space is marketing information.

**Building view, no floor open.** The floors are listed once: a label beside each floor of the model, level with it ("12 · 50.0% leased · 9,300 SF available", then what the active lens adds), with a small bar for the leased share. Each label is a button, so the list is the floor picker: one tab stop, ↑ ↓ between floors, Home and End, Enter or Space to open; pointing at a label lights its floor and puts its numbers on the one caption line above the model. The model takes the height left under that line. Where the list has no room beside a model of a readable width, it stands under it. With a floor open the model docks beside a compact picker, and the floor's heading gives its name and size only: the cards under the plate carry leased and available.

### 2.3 Toolbar
View tabs (Stack, Timeline, Map), lens segmented control, search field ("Find tenant, suite or prospect"), Find space, Worklist. One row. On narrow widths the lens becomes a select and the two buttons collapse into a "Tools" menu.

### 2.4 Stack view (default)
- SVG. One row per floor, top floor first. Left gutter: floor name (15 px semibold), leased % with a 4-step mini bar, leasable RSF. The floor name is a button: opens Floor mode in the inspector; the inspector offers "Open floor plate".
- Row width is proportional to leasable RSF relative to the widest floor (floor of 60 %). Rows left-align so the building's taper reads on the right edge.
- Suite widths are proportional to RSF with a 56 px minimum; when a minimum applies the other suites on that floor shrink proportionally and a footnote under the legend says so.
- Row height 72 px desktop, 56 px mobile. Blocks have 2 px gaps, 4 px radius, 1 px border in the tone's border colour.
- **Text tiers by block width:** ≥ 200 px: tenant · "Ste 600 · 21,400 SF" · expiry line. 120–200 px: tenant (wraps to two lines) · SF. 64–120 px: SF, plus the tenant's first word when it fits. < 64 px: no text. Every block has a native tooltip and an accessible name with the full facts.
- Badges (top right): live-deal count pill; "Holdover", "MTM", "Avail Apr '27", "For sale", lock for confidential, inquiry-match count when Find space is active.
- Selection: 2 px brand outline plus a soft outer ring; dimming: non-matching blocks drop to 35 % and lose their text when a filter (search, find space, worklist window, rollover bucket) is active; a filter summary bar above the plan names the filter with a Clear button.
- Legend lives in the plan card header. Each legend item shows the tone, pattern and the SF and share it currently covers ("Available 26,200 · 10.8 %").

### 2.5 Timeline view
- Horizontal time axis from the earliest commencement in view (or as-of minus 1 yr) to as-of plus 10 yr; year gridlines; month ticks at high zoom. Rows grouped by floor (top floor first), one bar per lease or availability from start to end. Bar colour follows the active lens; sublease bars dotted; committed bars hatched; MTM bars fade out to the right with a "MTM" tag; holdover bars extend past expiry in rose with a "Holdover" tag; availability bars start at available-from and are teal.
- **As-of cursor:** a draggable vertical line with a date handle at the top. Dragging updates the global as-of date, so KPIs, plan and inspector recompute live. Keyboard: arrows move a month, shift-arrows a year, Home returns to today.
- Header band above the rows: rollover totals per 12-month bucket measured from the cursor (SF bars with labels), the same numbers as the Building inspector.
- Today marker (thin grey line, "Today"). Click a bar to select it (inspector shows detail). Hover shows a tooltip with exact dates and months remaining.

### 2.6 Map view
- MapLibre GL with OpenFreeMap vector tiles (free, no key). Light style by default, dark style in dark mode.
- The property footprint (OSM polygon, cached in mock data; `?live=1` fetches from Overpass) is extruded floor by floor as separate fill-extrusion features: base and height from floor index × floor height; colour from the active lens using the floor's dominant state, with a second thin ring showing available share. Surrounding buildings extrude in muted grey from the tiles' building layer.
- Hover highlights a floor and shows a floor tooltip; click selects the floor (inspector Floor mode). The camera starts pitched 55°, bearing −20°, 17.5 zoom.
- Controls (bottom right): zoom, compass, pitch, "Present" (slow orbit plus a time-lapse of the as-of date across the next five years, pausing at each expiration), "Record" (MediaRecorder captures the canvas to WebM; the download appears in a toast). Reduced-motion disables orbit and time-lapse.
- **Area panel** (inspector mode "Area"): demographics rings at 1, 3 and 5 miles (population, households, median household income, median age, bachelor's share, mean commute), source "US Census Bureau ACS 5-year, 2024", plus nearby transit stops and amenity counts from OSM within half a mile. Cached for the demo property; live behind the flag.
- If WebGL or the tile server is unavailable, the view shows a static footprint SVG with the same colouring and a notice.

### 2.7 Floor plate (drill-in)
- Reached from the floor name, the inspector's "Open floor plate" button, or a floor click on the map. Breadcrumb "Stack › Floor 6" with Back; left and right arrows move between floors.
- The plate is the footprint polygon drawn large, with suites as proportional slices along the polygon's long axis, in lens colours with the same text tiers. A caption reads "Schematic: suite positions are proportional to RSF, not surveyed" so nothing is invented. If a floor plan image exists on the Floor record it is shown instead with the schematic as a thumbnail.
- Right of the plate: floor KPIs (leased %, available, largest block, next expiry), then tabbed lists: Suites, Deals, Inquiries that fit, Issues on this floor.

### 2.8 Inspector (right, 360 px, reflow)
Modes, each with a title row and a Close that returns to Building:

- **Building** (default): rollover chart (8 rolling buckets from as-of plus "8+ yr"; click a bucket to highlight those leases in the plan), At risk (holdover and MTM SF), Coming supply (occupied but marketed), Pipeline by stage, Data issues summary with a link, Recent changes (30-day change log from record history).
- **Block**: tenant or availability detail. Lease: term, remaining, rent with unit and type (hidden when confidential), contact, broker owner, last touch, other floors, open renewal deals, marketed-for-later notice. Availability: type (direct, sublease, for sale), available from, asking rent or price, divisible, inquiries that fit, live deals by stage. Footer actions as toast stubs: Open record, New deal, Log call, Create availability, Start renewal.
- **Floor**: floor KPIs, suites list, "Open floor plate".
- **Find space**: Need SF (min, max), by date, direct / sublease / any, match an open Inquiry (pre-fills). Results ranked: on time first, sooner, closest size; each shows floors, SF, type, from date, inquiry fits and live deals; selecting a result highlights its blocks. Shows "Largest block now" and suggests two-floor combinations.
- **Worklist**: window chips (At risk, 90 d, 180 d, 12 mo, 24 mo). Rows: tenant, suite, SF, months left, rent, broker, last touch, open renewal. Sorted by end date. Export CSV. Clicking a row selects the block.
- **Issues**: errors, warnings, info with a fix action and a locate link.
- **Area**: demographics and amenities (Map view).

On < 1100 px the inspector is a bottom sheet with a handle (snap at 45 % and 90 %); on ≥ 1100 px it reflows beside the plan and never overlays it.

## 3. Visual system

### 3.1 Tokens (mirroring SLDS 2 hooks)
Light: page `#F3F3F3`, card `#FFFFFF`, border `#E5E5E5`, strong border `#C9C9C9`, text `#181818`, text weak `#5C5C5C`, brand `#0176D3`, brand strong `#014486`, focus ring `#0176D3`. Dark: page `#16171A`, card `#1F2124`, border `#2E3136`, text `#F3F3F3`, text weak `#AEB4BC`, brand `#57A3FD`.

Radii 8 px cards, 4 px blocks and chips. Shadows only on popovers and the bottom sheet. Spacing on a 4 px grid: 4, 8, 12, 16, 24.

### 3.2 Type
Inter (Google Fonts) in the prototype; the LWC port uses Salesforce Sans through SLDS. Base 13 px / 1.45. Scale: 11 (labels, uppercase, 0.04 em tracking), 12 (block meta), 13 (body), 15 (floor names, inspector titles), 18 (page title), 22 (KPI values). All numerals tabular (`font-variant-numeric: tabular-nums`). Tenant names weight 600, meta 400 in text-weak.

### 3.3 Status lens tones
| State | Fill | Text | Extra cue |
|---|---|---|---|
| Leased | `#E7EDF3` | `#181818` | — |
| Expires < 12 mo | `#FCE4C4` | `#181818` | 3 px left bar `#C25E00`, badge months |
| Holdover / MTM | `#F8D9E0` | `#181818` | 3 px left bar `#B3113E`, badge |
| Available (direct) | `#0B7A66` | `#FFFFFF` | — |
| Available later | `#D7EFE9` | `#0B5C4E` | dashed border, badge "Avail Apr '27" |
| Sublease | `#CDE8E1` | `#0B5C4E` | dot pattern |
| Committed, not in | `#DCE6F9` | `#1B3B7A` | diagonal hatch, badge "Moves in Feb '27" |
| For sale | `#E9DEF7` | `#4B2C87` | badge "For sale · $X/SF" |
| Vacant / unaccounted | none | `#5C5C5C` | dashed `#9AA5B1` border |
| Projected vacancy | `#EAF6F2` | `#0B5C4E` | dashed teal border, label "Vacates …" |

Sequential lenses use one hue ramp each so order is legible to every viewer. Expiration: `#FFF4DB`, `#FBDCA6`, `#F5B86C`, `#E98C3C`, `#CC5F26`, `#9C3B18` (text switches to white from step 5). Rent (FSG scale): `#E3F1FA`, `#BBDDF3`, `#86C1E8`, `#4F9FD8`, `#1E6FB8`; NNN and MG carry a 3 px top bar and are not placed on the gross scale; asking rents on vacancies use a light diagonal pattern; confidential is grey with a lock. Deals: Tour `#DDE8FD`, Proposal `#AFC8FA`, LOI `#5F8DEE`, Lease out `#2B55C7` with white text.

### 3.4 States
Hover: border darkens, cursor pointer, 120 ms. Selected: 2 px brand outline, 4 px soft ring. Focus-visible: 2 px brand ring, 2 px offset, never removed. Dimmed: 35 % opacity, text hidden. Empty states have an icon, one sentence and one action. Loading (live data) uses skeleton bars, never spinners over the plan.

### 3.5 Motion
120 ms colour and border transitions; 180 ms inspector content swap (fade and 6 px rise); the as-of cursor and KPI deltas update without animation so numbers never read as interpolated. Map orbit 0.6°/frame, disabled under reduced motion.

## 4. Responsive
- ≥ 1200: as drawn. under 1200: KPI notes are left to the tooltips. 760–1100: inspector becomes a bottom sheet; the toolbar wraps to two rows. ≤ 760: header stacks; the KPI bar is a 3 × 2 grid of label and figure; lens becomes a select; floor gutter shows the floor number only; blocks 56 px; the timeline scrolls horizontally with the cursor pinned; the map fills the width and the Area panel is a sheet.

## 5. Print and exports
- Print (landscape Letter): page 1, a cover with property facts, the six KPIs, the plan with legend, the as-of date and "Prospect-safe" when on; page 2, the rent roll table; page 3, the rollover chart and the renewal worklist. Hidden: toolbar, inspector, buttons.
- PNG: the plan SVG serialised with inlined styles and rasterised at 2× for a PowerPoint slide.
- CSV rent roll: floor, suite, tenant, RSF, commencement, expiration, months remaining, rate, unit, type, state, deals. Prospect-safe removes tenants, rents and prospects.
- Video: WebM from the map canvas while Present runs.

## 6. Accessibility
Plan is `role="grid"` with a row per floor and a button per block, roving tabindex, arrow keys across suites and floors, Home/End, Enter to open detail, Esc to close the inspector mode and return focus to the block. Timeline bars and map floors have keyboard equivalents (floor list). Legend items are read with the plan via `aria-describedby`. A polite live region announces KPI changes after the as-of date changes. Contrast ≥ 4.5:1 for all text, ≥ 3:1 for borders and patterns against neighbours. Tooltips open on focus. Reduced motion honoured.

## 7. Domain model additions (over v1)
- `Availability.kind: 'Lease' | 'Sale'`; sale availabilities carry `askingPrice` and `pricePerSF`.
- `Property.saleListing?` with price, cap rate, broker and status: shown as a banner strip under the header when present.
- `Property.footprint` (GeoJSON polygon), `floorHeightFt`, `heightFt`.
- `Property.history: Change[]` (record, field, from, to, by, at) for Recent changes and per-record "Verified" stamps.
- `Property.area` cached demographics and amenities with source and as-of.

## 8. Engineering shape
- `src/domain/`: pure TypeScript (types, dates, format, derive, lenses, rollover, finder, issues, timeline, geometry) with vitest tests. No React imports.
- `src/state/`: one URL-synced state hook (view, lens, asOf, select, floor, safe, req, window, bucket, inquiry, q, mode).
- `src/data/`: `mock/` property, footprint, area; `sources/` with a `DataSource` interface and `MockSource`, `OverpassSource`, `CensusSource`.
- `src/components/`: `shell/`, `kpis/`, `stack/`, `timeline/`, `map/`, `floor/`, `inspector/`, `ui/` primitives. One CSS file per component using the tokens; no CSS-in-JS so the LWC port can copy styles.
- Dependencies: react, react-dom, maplibre-gl. Dev: vite, vitest, playwright, @axe-core/playwright.
- `scripts/`: `shots.mjs` (every judged state), `pdf.mjs`, `a11y.mjs` (axe on each view), `verify.mjs` (smoke checks and prospect-safe leak check).

## 9. Non-goals for the prototype
Real Salesforce writes, authentication, persisting edits, drag-to-resize suites, multi-building campus view, satellite imagery, street-level photos. Each is in `docs/PLAN.md` as a later phase.
