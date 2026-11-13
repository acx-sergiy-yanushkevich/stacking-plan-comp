JUDGE: GPT-6.1 Sol
ROUND: round-27

UI SCORE
U1 Visual hierarchy & layout: 5/5: Building identity, KPIs, tools and plan form a clear hierarchy. The inspector supports the plan without dominating it; tablet layouts remain coherent.
U2 Color & data encoding: 5/5: Labels, hatching, dots, dashed outlines and distinct amenity shapes supplement color. Expiration starts with urgent red; map keys match their pins.
U3 Typography & density: 4/4: Exact SF, tabular figures, wrapped tenant names and adaptive block content remain readable. Phone suite rows preserve the essential facts.
U4 Polish & platform fit: 2.5/3: Both glass themes feel consistent and finished. However, resizing an open desktop map to phone width leaves its camera incorrectly framed and clips the outer-ring label.
U5 Mobile & print visual quality: 3/3: Cold phone maps show their places, and the five-mile half-mile label clears the building name by 8 px. The supplied owner and prospect PDFs have clean pagination, readable tables and complete location briefs.
UI TOTAL: 19.5/20

UX SCORE
X1 Persona job coverage: 5/5: Vacancy, largest block, rollover, requirements, suite detail, exports, time travel, issues and pipeline are covered. Live checks returned Legacy West’s 78,000 SF three-floor option and a renewal worklist totaling 35,300 SF across four leases. Wes would say: “I can hand this plan to a tenant; fix consecutive map taps before the client demo.”
X2 Interaction & IA: 3.5/4: Map search correctly opens the plan’s finder with 12,000 SF, Direct and June 30, 2027. Impossible search dates offer nothing to run, and Enter does nothing. Consecutive taps on different amenities in one category incorrectly clear selection instead of naming the second place.
X3 Trust & domain correctness: 3/4: Prospect-safe removed Cirrus’s tenant details, lease terms, rent and quiet listing in the tested transition; the supplied prospect PDF retains asking information without private terms. Two correctness gaps remain: impossible as-of dates reach calculations ([src/state/planState.ts:114](../../../src/state/planState.ts#L114)), and transit deduplication discards distinct stops sharing a display name ([src/data/sources/OverpassSource.ts:191](../../../src/data/sources/OverpassSource.ts#L191)). Todd would say: “The renewal figures reconcile; why can an impossible reporting date enter the model?”
X4 Accessibility of interaction: 3/3: Focusing Available highlights its suites; leaving it restores the plan. Legend focus exposes exact figures. Map controls have accessible names, touch controls receive 44 px targets, and Area rows provide keyboard access without dozens of anonymous marker buttons.
X5 CRM workflows & differentiation: 4/4: Inquiry matching, competing deals, renewal stages, activity recency, field history and contextual record actions make this substantially more useful than a static stacking chart. Intended Salesforce action stubs are appropriate for the prototype.
UX TOTAL: 18.5/20

ENGINEERING: 9/10: E1 3.5/4, E2 3/3, E3 2.5/3. All 961 tests across 69 files passed. Pure domain functions, centralized privacy projection, URL state and the host boundary provide a strong architecture; the projection is applied before views consume suite data ([src/model/usePlanModel.ts:198](../../../src/model/usePlanModel.ts#L198)). Remaining integration defects need behavioral regression coverage. The host abstraction supports an LWC migration, but actual Salesforce shadow-DOM integration remains unproven. Lint could not execute because the installed oxlint native binding is missing; this is an environment limitation, not a demonstrated lint failure. No rebuild or repository changes were made.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Refit the chosen ring after map-container size changes while the map is in its default ring-framing mode. The observer currently only resizes the canvas; the framing effect does not depend on dimensions ([src/components/map/useMapLibre.ts:108](../../../src/components/map/useMapLibre.ts#L108), [src/components/map/MapView.tsx:250](../../../src/components/map/MapView.tsx#L250)). Preserve deliberate user camera changes. Expected gain: 0.5 UI points.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Toggle a pin off only when that same pin is already selected. A different pin in the highlighted category must replace `tapped` and show its own name; category highlighting alone must not trigger deselection. Expected gain: 0.5 UX points.
2. Validate `asOf` as a real calendar day before deriving the plan. For invalid links, use today and announce the rejected date. Preserve the Find panel’s existing invalid-`by` feedback. Expected gain: 0.5 UX points.
3. Preserve a stable source identifier for transit stops through normalization, deduplication, marker IDs and row keys. Deduplicate by source identity rather than the fallback display name. Expected gain: 0.5 UX points.

BUGS (with file:line):
- [src/components/map/MapView.tsx:543](../../../src/components/map/MapView.tsx#L543): On the live Preston map, clicking Mo’ Bettahs names it; clicking CAVA next leaves zero named or highlighted pins. Both share a category key, so `on` wrongly treats the second pin as the selected pin.
- [src/state/planState.ts:296](../../../src/state/planState.ts#L296): `?view=stack&asOf=2027-02-30` displays “Projected · Feb 30, 2027” and recomputes leased occupancy to 85.1% without an error. URL date validation checks shape only.
- [src/data/sources/OverpassSource.ts:191](../../../src/data/sources/OverpassSource.ts#L191): Bluebonnet’s recorded stops “1” through “5” become “Bus stop,” then collapse into one entry. Stops approximately 0.032–0.059 miles away disappear while farther stops populate the nearest-four bus list.
- [src/components/map/MapView.tsx:250](../../../src/components/map/MapView.tsx#L250): Open the one-mile map at 1440 × 1000, then resize to 390 × 844. The outer-ring label sits approximately 101 px above the map’s visible top. Resetting the frame restores it; resizing alone does not.
