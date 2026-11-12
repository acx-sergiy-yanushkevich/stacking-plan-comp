# Stax: product plan and implementation roadmap

Companion documents: `BRIEF.md` (personas, jobs, rubric), `COMPETITORS.md` (market analysis), `DESIGN.md` (screen-by-screen specification), `ARCHITECTURE.md` (how the code is built).

## 1. Vision

The AscendixRE Stacking Plan becomes the operating view of a building: one model of floors, suites, leases, availabilities, deals and inquiries, rendered four ways (2D plan, lease timeline, 3D on the real map, floor plate) and tied to the CRM records brokers already keep. It must beat VTS, Prophia and Yardi on the things brokers complain about (exact numbers, honest future state, presentable exports, data trust) and do the things only a CRM can (deal pipeline, demand matching, activity recency, one-click record actions).

## 2. Feature inventory

Source key: **C** competitor (named), **N** new. Priority: **P0** in this prototype, **P1** first production release (LWC), **P2** later.

### 2.1 Core plan
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Floor-by-floor plan with suite widths proportional to RSF | C: all | all | P0 |
| Floor rows proportional to floor RSF (building taper) | N | all | P0 |
| Minimum block width with legibility footnote; tooltip and accessible name on every block | C: VTS, FUEL | all | P0 |
| Adaptive block text by width (tenant, suite, SF, expiry) | N | all | P0 |
| States: leased, expiring, holdover, MTM, available direct, available later, sublease, committed, for sale, vacant/unaccounted, projected vacancy | N | all | P0 |
| Legend that shows SF and share per state | C: Stevenson patent, VTS | all | P0 |
| Floor gutter with leased %, mini bar and RSF | N | landlord rep, analyst | P0 |
| Selection, dimming, filter summary bar | N | all | P0 |
| Dark theme | N | all | P0 |

### 2.2 Lenses
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Status lens | N | all | P0 |
| Expiration lens in months from as-of (sequential ramp) | C: VTS, Yardi | landlord rep, analyst | P0 |
| Deal-stage lens wired to real Deals | C: VTS | landlord rep | P0 |
| Rent lens with gross scale, net marked separately, asking vs in-place | C: Yardi | analyst | P0 |
| Industry lens | C: Cloud Stacking Plan | landlord rep | P1 |
| Listing-status lens (published vs quiet) | N | coordinator | P1 |
| Color by any field with saved palettes | C: Cloud Stacking Plan | admin | P2 |

### 2.3 Time
| Feature | Source | Persona | Priority |
|---|---|---|---|
| As-of date with KPIs recomputed; deltas vs today | C: Prophia, FUEL | analyst, landlord rep | P0 |
| Lease timeline view (bars per lease, draggable as-of cursor, rollover header) | N (replaces V1 slider) | analyst, landlord rep | P0 |
| Rollover by 12-month bucket from as-of | N | analyst | P0 |
| Calendar-year rollover toggle (the domain logic already computes it) | N | analyst | P1 |
| Projected vacancies shown honestly; committed leases shown as committed, never vacant | C: gap | all | P0 |
| Scenario compare (two as-of dates side by side) | N | analyst | P2 |

### 2.4 Finding space and demand
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Contiguous-block finder: size range, by date, direct/sublease, multi-floor pairs | C: nobody | tenant rep, landlord rep | P0 |
| Match an open Inquiry to space; inquiry-fit badges on blocks | N | landlord rep | P0 |
| Search tenant, suite, prospect, broker | C: VTS | all | P0 |
| Tenant-rep mode: filter to the user's clients | N | tenant rep | P2 |

### 2.5 Renewal and pipeline
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Renewal worklist (at risk, 90 d, 180 d, 12 mo, 24 mo) with last touch and open renewal | N | landlord rep | P0 |
| Pipeline by stage; live-deal badges per block; stale-deal flags | N | landlord rep | P0 |
| Record actions from a block: open record, new deal, log call, create availability, start renewal (toast stubs in POC) | C: Yardi, Rethink | landlord rep | P0 stub, P1 real |
| Schedule tour, create listing, publish to portal | N | landlord rep, coordinator | P1 |

### 2.6 Trust and data quality
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Data issues: lease without units or floor, over-allocation, unaccounted area, vacant-flag conflicts, orphan subleases, holdover, MTM, stale deals | N | coordinator | P0 |
| Recent changes (30-day change log) and per-record "Verified" stamps | N, C: Prophia provenance | coordinator, landlord rep | P0 (mock history), P1 (Field History) |
| Exact RSF everywhere; rates with unit and type | N | all | P0 |
| Confidential leases hide rent; prospect-safe mode hides names, contacts, rents, prospects on screen and in exports | C: Yardi | landlord rep | P0 |

### 2.7 Building, map, 3D, floors, area
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Map placement on OpenStreetMap (MapLibre + OpenFreeMap tiles) | N (V1 had a basic map) | all | P0 |
| The building's surroundings on the map: transit stops and amenities pinned, the half-mile and one-mile rings, linked to the Area panel; the building in 3D among its neighbours | N | landlord rep (presenting), tenant rep, investment sales | P0 |
| Present mode (orbit + time-lapse) and WebM recording | N | landlord rep | P0 |
| Floor plate drill-in: schematic from the real footprint, suites proportional, floor lists | N (user ask) | all | P0 |
| Floor plan image when attached to the Floor record | N | all | P1 |
| Demographics rings 1/3/5 mi (ACS), transit and amenities (OSM) | N (user ask) | landlord rep, investment sales | P0 cached, P1 live |
| Sale availabilities and property sale listing banner | N (user ask) | investment sales, seller rep | P0 |
| Multi-building campus view | C: VTS complaint | landlord rep | P2 |
| Satellite or street-level imagery | N | all | P2 (needs a keyed or paid source) |

### 2.8 Output
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Print/PDF: cover, plan, rent roll, rollover and worklist, prospect-safe aware | C: Rethink | landlord rep | P0 |
| PNG of plan at 2× for PowerPoint | N, C: gap | landlord rep | P0 |
| CSV rent roll (Excel-ready) | N | analyst | P0 |
| True .xlsx with formatting | N | analyst | P1 |
| Copy link to exact state | N | all | P0 |

### 2.9 Platform
| Feature | Source | Persona | Priority |
|---|---|---|---|
| Keyboard grid, screen-reader names, live region, reduced motion | N | all | P0 |
| Mobile layout with bottom-sheet inspector | N | landlord rep | P0 |
| LWC port with SLDS styling hooks | — | all | P1 |
| Edit on the canvas (split, merge, reorder floors) | C: patent only | coordinator | P2 |

## 3. Requirements and prototype scope

### 3.1 Scope of the prototype

This repository builds everything marked P0 above, on mock data for four buildings: Preston Park Financial Center (12 floors, with every edge case present at least once), Legacy West Tower II (22 floors), Cedar Springs Exchange (8 floors, under contract) and Bluebonnet Office Park (4 floors, L-shaped). Its limits:

- Record actions show a message describing the Salesforce action they would take.
- Footprint, demographics and amenities are cached with the mock data; `?live=1` fetches them from Overpass and the Census API.
- Exports: the print layout through the browser, PNG by serializing the plan's SVG, CSV as a file download; video through MediaRecorder in Chrome.
- No sign-in, no saving of changes, no campus view across buildings.

### 3.2 Functional requirements

The requirements say what the product must do, whatever it runs on: they hold for this prototype and for the production release in §4. Each lists the top jobs it serves (`BRIEF.md`, "Top jobs, ranked") and what checks it. Unit tests are named by their path under `src/`; the `npm run` checks drive a real browser against the built app (README, "Browser checks"). A production port keeps the checks: the domain tests move to Jest (§4.1), and the browser checks run against the new host.

**The plan**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-1 | The plan draws the building floor by floor, top floor first. A suite's width is proportional to its RSF and a floor's length to its leasable RSF, so the building's taper shows. A suite too narrow to read is drawn at a minimum width, and a note under the plan says so. Every suite has a tooltip and an accessible name with its full facts. | 1, 5 | `domain/layout.test.ts`, `components/stack/Block.test.tsx`, `npm run verify` |
| FR-2 | Every part of a floor is in exactly one state on the as-of date: leased; holdover (past its expiration with no termination date); month-to-month (no expiration date); available; sublease; signed, not yet in (never shown as vacant); projected vacancy (a lease that will have ended, with nothing after it); for sale; or no lease or listing. Occupied space marketed for a later date stays occupied and shows when it becomes available: availability is not vacancy. | 1, 7 | `domain/derive.test.ts` |
| FR-3 | Nothing is counted twice. A floor's leased SF is capped at its leasable area; the excess is reported as an over-allocation (FR-17) and never added to a total. | 3 | `domain/derive.test.ts`, `domain/kpis.test.ts`, `domain/issues.test.ts` |
| FR-4 | Four color lenses: Leasing (the states of FR-2), Expiration (months from the as-of date to each lease's end, on an ordered ramp), Pipeline (the most advanced deal on each space) and Rent (in-place or asking $/SF/yr on a full-service gross scale, with NNN and modified gross marked apart). Every state also has a pattern, border or label, so color is never the only cue. | 1, 2, 7, 10 | `domain/lenses.test.ts`, `styles/ascendix.test.ts`, `styles/vice.test.ts` |
| FR-5 | Each lens has a legend naming its states. An entry's SF and share of the building show on hover and keyboard focus, and a screen reader reads them with its name. Shares are rounded once each, as the KPI bar rounds them; where the shares shown do not add up to 100%, the legend's note says why. | 1 | `components/plan/Legend.test.tsx`, `domain/lenses.test.ts` |
| FR-6 | Figures are exact: RSF is never rounded or abbreviated, and every rate carries its unit and lease type ("$31.50/SF/yr FSG"). A confidential lease never shows its rent. | 5 | `domain/format.test.ts`, `domain/safe.test.ts` |

**Figures and time**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-7 | Six figures sit above every view, always in the same place: leased %, available SF, the largest contiguous block, SF expiring in 12 months, the average lease term weighted by SF (WALT) and the deal pipeline. Each opens the lens, view or tool that explains it, and pointing at Available or Largest block lights those suites on the plan. A figure and the suites it lights come from the same calculation. | 1, 2, 4, 10 | `domain/kpis.test.ts`, `components/kpis/KpiStrip.test.tsx`, `npm run verify` |
| FR-8 | Moving the as-of date recomputes the plan, the figures (each with its change since today), the rollover and the timeline. A lease that will have ended is drawn as a projected vacancy, and a signed lease as signed, not yet in. | 2, 8 | `domain/derive.test.ts`, `domain/kpis.test.ts`, `npm run verify` |
| FR-9 | The lease timeline draws every lease and availability as a bar against time, grouped by floor, with an as-of cursor that can be dragged or moved from the keyboard (an arrow key moves it a month, Shift and an arrow a year, Home back to today). | 2, 8 | `domain/timeline.test.ts`, `components/timeline/Timeline.test.tsx` |
| FR-10 | The rollover shows the SF and leases ending in each 12-month period from the as-of date, from "under 12 months" to "8+ years". Choosing a period highlights its leases on the plan. | 2 | `domain/rollover.test.ts` |

**Finding space**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-11 | Find space takes a size or a size range, a needed-by date and direct, sublease or either, and lists what fits: single suites, runs of adjacent suites and stacks of adjacent floors. Options are ranked on time first, single floors before stacks of floors, then by the sooner availability, then by the closest size, and their suites light up on the plan. When few options fit, near misses are listed. A maximum below the minimum runs no search, and a needed-by date before the as-of date is not applied; the panel says why. | 4 | `domain/finder.test.ts`, `components/inspector/Inspector.test.tsx` |
| FR-12 | An open inquiry can be matched to space: its size range and date become the requirement. While Find space is open, each space that fits shows how many open inquiries it fits. | 4, 10 | `domain/finder.test.ts` |
| FR-13 | One search box finds tenants, suites, floors, contacts, brokers and prospects, and says why each suite matched. A size typed into it ("12k direct by Jun 2027", "12-15k") is read as a requirement and offered to Find space; a state word ("sublease", "signed", "holdover") lights that state. | 4, 5 | `domain/query.test.ts` |

**Leases, deals and records**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-14 | Selecting a suite opens its details. A lease shows its tenant, term and time left, rent with unit and type, contact, accountable broker, last activity, other floors and open renewal deals. An availability shows its type, available-from date, asking rent or price, divisibility, the inquiries it fits and its deals by stage. | 5, 10 | `components/inspector/Inspector.test.tsx` |
| FR-15 | The renewal worklist lists leases at risk (holdover and month-to-month) or ending within 90 days, 180 days, 12 months or 24 months, with the last activity and any open renewal. A lease is one row per floor holding all its suites there, and the 12-month list agrees with the Expiring figure. | 2 | `model/worklist.test.ts` |
| FR-16 | The deal pipeline shows on the plan (the Pipeline lens and a deal count on each suite) and by stage in the Building panel. Suites and floors offer record actions: open the lease, availability, deal, inquiry or account; new deal; log a call; create availability; start renewal; add unit. In the prototype each shows a message describing the CRM action (§3.1). | 5, 10 | `domain/lenses.test.ts`, `components/inspector/Inspector.test.tsx`, `components/floor/floorData.test.ts` |

**Trust**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-17 | Data issues are listed by severity, each with a link that finds it on the plan: a lease with no units or no floor, an availability with no floor, an over-allocated floor, area with no lease or listing, a sublease with no lease to sublet from, a suite marked vacant or for sale while a lease still holds it, holdover and month-to-month leases, deals not updated in 30 days, and records not verified in 120 days. The toolbar's Issues button carries the count. | 3, 9 | `domain/issues.test.ts` |
| FR-18 | The Building panel lists the last 30 days of changes from record history, and the header says when the plan's records last changed and how many have gone unverified. | 3 | `domain/issues.test.ts`, `components/shell/Header.test.tsx` |

**Showing it to a prospect**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-19 | Prospect-safe mode is one switch. It withholds tenant names, contacts and industries; in-place rents; brokers; deals and inquiries; data issues; every lease date and a sublease's end date; the rollover by period, the Expiring figure and WALT; quiet (unpublished) listings; and record actions. It applies on screen, in tooltips and accessible names, in the address, in the printed report and in every export. Asking rents and prices stay, because they are marketing information. | 6 | `domain/safe.test.ts`, `npm run leakcheck`, `npm run exportcheck` |
| FR-20 | A prospect-safe plan is drawn as of today only, and a link opened with the mode on carries nothing the mode withholds. Turning the mode off gives the broker back the date, lens, search, worklist and matched inquiry they had. | 6 | `state/planState.test.ts`, `domain/safe.test.ts`, `npm run leakcheck` |

**Views of the building**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-21 | The Building view draws a model of the building colored by the lens, with one label per floor (leased %, available SF and what the lens adds) that is also the floor picker. Opening a floor docks the model beside that floor's plan, figures, suites, deals, inquiries and issues. On a phone the Stack view stands in for it. | 1, 4 | `components/building/BuildingView.test.tsx`, `components/building/FloorLabels.test.tsx`, `components/building/floorFact.test.ts` |
| FR-22 | The floor plate is a schematic drawn from the building's footprint, with suites as slices proportional to their RSF and a caption saying it is schematic, not surveyed. | 1, 5 | `domain/geometry.test.ts`, `components/floor/Floor.test.tsx`, `components/floor/FloorPlate.test.ts` |
| FR-23 | The Map view shows the building's surroundings on an OpenStreetMap basemap: top-down by default, framed on the one-mile ring with the half-mile walk shaded; transit stops and amenities pinned (live sources only where they record a position; sample positions flagged as sample); the Area panel beside it, whose rows light their pins and are the keyboard way to them. The building is one color, in 3D among its neighbours on request; its floors are the Building tab's. Present orbits it and can be recorded as a video. Without WebGL or map tiles the view falls back to a drawing of the footprint. | 1 | `domain/places.test.ts`, `state/planState.test.ts`, `components/map/mapStyle.test.ts`, `domain/geometry.test.ts`, `npm run a11y` |
| FR-24 | The area around the building is one click from every view: population and households at 1, 3 and 5 miles, one ring compared with the US (household income, education, age, commute), amenities within half a mile and transit stops. The location brief widens it to a full page and ends the PDF report. Sample figures say so; `?live=1` fetches public data and falls back to the cached figures on any failure. | — | `domain/areaBrief.test.ts`, `components/map/AreaPanel.test.tsx`, `components/area/LocationBrief.test.tsx`, `data/sources/sources.test.ts` |
| FR-25 | The header's switcher opens every building with data behind it (four in the prototype). Switching drops the selection, search and panel of the building left, and keeps the view, lens, as-of date and prospect-safe mode. Entries with no data are marked as samples and do not open. | — | `data/mock/buildings/buildings.test.ts`, `data/mock/portfolio.test.ts` |
| FR-26 | A unit offered for sale is a state of its own, with its asking price, and a building's sale listing shows in the header; a prospect sees only "Listed for sale". | — | `domain/derive.test.ts`, `domain/finder.test.ts`, `components/shell/Header.test.tsx` |

**Output**

| ID | Requirement | Jobs | Checked by |
|---|---|---|---|
| FR-27 | The printed report (landscape Letter) has two versions. The owner report has a cover with the plan, legend and figures, the rent roll, the rollover with the 12-month worklist, and the location brief. The prospect-safe report has the cover, the rent roll beside the space on offer, and the location brief. Its pages are the same whatever the width of the window it is printed from. | 6 | `components/print/PrintLayout.test.tsx`, `components/print/pageFit.test.ts`, `npm run pdfcheck` |
| FR-28 | Exports: a PNG of the plan at twice its size for slides, keeping its patterns, and a CSV rent roll with exact RSF and rates as plain numbers beside a unit column. Both follow prospect-safe mode. | 6 | `lib/exportPng.test.ts`, `domain/exportCsv.test.ts`, `npm run exportcheck` |
| FR-29 | Every view is a link. The whole state is in the address, defaults are left out, unknown values fall back to the defaults, and Copy link copies the address. | 6 | `state/planState.test.ts` |

### 3.3 Non-functional requirements

| ID | Requirement | Checked by |
|---|---|---|
| NFR-1 | **Keyboard and screen reader.** Every job can be done from the keyboard. The plan is a grid (arrow keys between suites and floors, Home and End, Enter to open, Escape to go back), and closing a panel returns focus to what opened it. Every suite, bar, slice and floor has an accessible name with its facts, a polite live region announces date changes and selections, and reduced motion is honored. No serious or critical axe-core violations in any checked desktop or phone state. | `npm run a11y`, `npm run verify`, `state/useAnnouncement.test.tsx` |
| NFR-2 | **Color.** Text has 4.5:1 contrast with what is behind it; each tone separates from the card by its fill or its edge at 3:1; ramps are ordered by lightness and their steps stay distinct, including for deuteranopia. Checked in both themes of both palettes. | `styles/ascendix.test.ts`, `styles/vice.test.ts` |
| NFR-3 | **Screens.** Desktop from 1200 px, tablet at 1024 px and phone at 390 px. Below 1100 px the side panel is a bottom sheet that keeps the selected suite in view; on a phone each floor is a card with every suite on a full-width row. | `components/stack/PhoneStack.test.tsx`, `components/stack/aboveSheet.test.ts`, `components/ui/sheetHeight.test.ts`, `npm run a11y` |
| NFR-4 | **Determinism.** "Today" is fixed at November 9, 2026, and the building data ships with the app, so the same address gives the same page and screenshots repeat. Live public data is opt-in (`?live=1`) and falls back to the cached copy on any failure. | `data/sources/sources.test.ts`, `state/planState.test.ts` |
| NFR-5 | **Portability to Salesforce.** Domain logic is TypeScript with no React or browser dependency; record types mirror the AscendixRE objects field by field, with their API names; everything the app asks of the page goes through one host adapter; styles are plain CSS on tokens named after SLDS styling hooks. | `lib/host.boundary.test.ts`, `lib/host.test.ts` |
| NFR-6 | **Demo reliability.** No console errors in the smoke run. The map falls back to a drawing of the footprint when WebGL or the tiles are unavailable. | `npm run verify` |
| NFR-7 | **First load.** The first screen loads without the map library; the Map view and the Area panel load when first opened. | `npm run build` (chunk sizes) |
| NFR-8 | **Words.** American English in everything a user, judge or voter reads. One name for each thing on screen, in the PDF and in the CSV ("Signed, not yet in", "No lease or listing", "Lease drafted" for the CRM's Lease Out stage). | Review in each judging round |
| NFR-9 | **Data.** Only mock data written for the prototype and public data (OpenStreetMap, US Census), with the assumptions stated in the README. Nothing is shown that AscendixRE does not store, such as lease options or notice dates. No personal names in the app, the README or the documents. | Review |
| NFR-10 | **Browser.** Desktop Chrome is the reference browser; every browser check runs in it. Video recording needs Chrome or Edge. | `npm run verify` |

### 3.4 Not yet checked automatically

- Switching buildings (FR-25): each building's data is checked, but the switch itself is checked by hand.
- The domain's independence from React and the browser (NFR-5): `lib/host.boundary.test.ts` catches page globals anywhere, but no test fails if `src/domain` imports React.
- First-load size, wording and data (NFR-7 to NFR-9): checked in review.
- Record actions (FR-16) are messages until phase 1 (§4.4) wires them to Salesforce.

## 4. Future implementation plan (Salesforce)

This section describes a full port to Lightning Web Components. The alternative, the current app hosted on a CDN and shown in an iframe on the Property page, is described with its running cost in `INFRASTRUCTURE.md`.

### 4.1 Architecture
```
Property record page
└─ LWC: c-stacking-plan (container; URL-state in page state / local storage)
   ├─ c-sp-header, c-sp-kpis, c-sp-toolbar
   ├─ c-sp-stack (SVG, lwc:dom="manual" only for the SVG patterns)
   ├─ c-sp-timeline
   ├─ c-sp-map (MapLibre from a static resource, lwc:dom="manual")
   ├─ c-sp-floor-plate
   └─ c-sp-inspector (modes as child components)
Apex
├─ StackingPlanController.getPlan(propertyId)   → PlanDTO (the TypeScript types in src/domain/types.ts, 1:1)
├─ StackingPlanController.getHistory(propertyId, days) → Field History rows for Recent changes and Verified stamps
├─ StackingPlanActions (new Deal, Availability, Task, renewal Deal; respects FLS/CRUD)
└─ AreaService (callouts via Named Credentials: Overpass, Census ACS; Platform Cache 24 h)
```
Domain logic (`src/domain/*`) ports unchanged to the LWC as ES modules: it has no React or DOM dependencies, and its vitest suite becomes Jest tests under `@salesforce/sfdx-lwc-jest`.

### 4.2 Data
| DTO field | SOQL source |
|---|---|
| floors | `Floor__c` (Name, Sequence__c, Size__c, NonLeasableArea__c) |
| leases, units | `Lease__c` with child `Unit__c` (TermCommencementDate__c, TermExpirationDate__c, TerminationDate__c, LeaseRatePerUOM__c, LeaseRateType__c, LeaseType__c, Confidential__c, Tenant__c, TenantContact__c, OwnerId) |
| availabilities | `Availability__c` Lease and Sale record types (Status__c, IsVacant__c, AvailableFrom__c, Sublease__c, SubleaseExpirationDate__c, RentLow__c, RentHigh__c, Divisible__c, MinDivisibleArea__c, price fields for Sale) |
| deals | `Deal__c` Landlord Representation and Renewal record types, linked by Availability or Lease |
| inquiries | `Inquiry__c` open records with AreaMinimum__c, AreaMaximum__c, DateNeeded__c |
| lastTouch | latest `Task` / `Event` on the tenant Account or Deal |
| history | `Lease__History`, `Availability__History` (Field History Tracking enabled on the key fields) |
| footprint, area | `AreaService` callouts, cached in Platform Cache; footprint stored on Property after first fetch |

Governor limits: one SOQL per object with the Property filter; a 60-floor tower with 800 units stays well under 50,000 rows. The plan derives everything client-side from one DTO, as the prototype does.

### 4.3 External services
| Need | Service | Cost and limits | Salesforce setup |
|---|---|---|---|
| Map tiles | OpenFreeMap vector tiles | free, no key, fair use | CSP Trusted Site for `tiles.openfreemap.org`; MapLibre GL as a static resource |
| Building footprint | OSM via Overpass API | free, rate-limited, best cached once per property | Named Credential, Apex callout, store the polygon on Property |
| Demographics | US Census Bureau ACS 5-year API | free; key recommended above 500 requests/day | Named Credential; Platform Cache 24 h; TIGERweb for tracts within a radius |
| Transit and amenities | OSM via Overpass | free | as footprint |
| Satellite imagery | Esri World Imagery or Mapbox | terms apply; Mapbox needs a token | decision needed later |
| Street-level photos | Mapillary | free token | decision needed later |

### 4.4 Phases
| Phase | Scope | Estimate |
|---|---|---|
| 0 (this) | Prototype on mock data, judged to 95/100 | now |
| 1 | LWC port of Stack, Timeline, Inspector, KPIs, exports; Apex `getPlan`; prospect-safe as a permission set; Field History provenance; real record actions via quick actions | 6–8 weeks |
| 2 | Map and 3D (static resource MapLibre), floor plate, AreaService with cache; mobile tuning in Salesforce Mobile | 4–6 weeks |
| 3 | Industry and listing lenses, .xlsx export, floor plan images, scheduled "owner report" PDF via Visualforce renderAs | 4 weeks |
| 4 | Campus view, tenant-rep mode, scenario compare, canvas editing | later |

### 4.5 Risks
- Third-party WebGL inside LWC needs `lwc:dom="manual"` and a static resource; Lightning Locker and Web Security are compatible with MapLibre, but the map must be tested under Lightning Web Security early in phase 2.
- Overpass is a shared community server; footprints must be cached after the first fetch and the UI must degrade to the SVG footprint.
- Census radius aggregation needs tract geometries (TIGERweb); if that call is unreliable, fall back to the containing tract plus a county figure, clearly labeled.
- Video recording relies on `MediaRecorder` and `canvas.captureStream`, available in Chrome and Edge; Safari is partial. Offer PNG as the fallback.

## 5. What is needed from the user, and when
- Nothing for the prototype.
- Phase 1: confirm the org's Availability Sale record type fields, and whether Field History Tracking is on for Lease and Availability.
- Phase 2: a free Census API key; a decision on satellite and street imagery.
