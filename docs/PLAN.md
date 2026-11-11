# Stax: product plan and implementation roadmap

Companion documents: `BRIEF.md` (personas, jobs, rubric), `COMPETITORS.md` (market analysis), `DESIGN.md` (screen-by-screen specification).

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
| Rollover by 12-month bucket from as-of; calendar-year toggle | N | analyst | P0 |
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
| 3D building on the map, extruded per floor, colored by lens, clickable floors | N | landlord rep (presenting), investment sales | P0 |
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

## 3. Prototype scope (this repository)

Everything marked P0 above, on mock data for one building (Preston Park Financial Center, 12 floors, every edge case present at least once), with these honest limits:

- Record actions show a toast describing the Salesforce action they would take.
- Footprint, demographics and amenities are cached JSON; `?live=1` fetches them from Overpass and the Census API.
- Exports: print layout via the browser, PNG via SVG serialisation, CSV via Blob; video via MediaRecorder in Chrome.
- No authentication, no persistence, no multi-building.

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
