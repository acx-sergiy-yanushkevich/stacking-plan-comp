JUDGE: GPT-6.1 Sol
ROUND: round-26

UI SCORE
U1 Visual hierarchy & layout: 5/5: Building, KPIs, toolbar and plan have clear priority. The 1280 px toolbar wraps cleanly; Prospect-safe preserves the building-card height and toolbar position.
U2 Color & data encoding: 5/5: Patterns, borders, words and amenity shapes supplement color. Expiration order is coherent across themes; map-key highlighting restores folded categories correctly.
U3 Typography & density: 4/4: Exact suite areas, complete tenant names and rate units remain readable in the reviewed states. Narrow blocks wrap names; phone layouts use full-width suite rows.
U4 Polish & platform fit: 3/3: Light and dark glass treatments feel consistent. Selection, focus, inspector transitions and read-only KPI details communicate their purpose clearly.
U5 Mobile & print visual quality: 2.5/3: Owner and prospect PDFs are presentation-ready, with readable tables and explanatory totals. On the 390 px, 5-mile map, the building label obscures the folded half-mile place-count label.
UI TOTAL: 19.5/20

UX SCORE
X1 Persona job coverage: 5/5: Availability, expirations, record inspection, data issues, time travel, renewal sweeps and exports are covered. Live testing confirmed size/date search and Legacy West’s 60,000 SF requirement returning Floors 18–20, totaling 78,000 SF.
X2 Interaction & IA: 4/4: Search-to-finder handoff is direct and deterministic for valid inputs. Map suite links open Area; ring state survives in the address; category highlighting and named nearby places connect map and panel effectively.
X3 Trust & domain correctness: 3.5/4: Over-allocation is disclosed, confidential rents are withheld, and the Cedar Springs privacy sweep reported zero leaks. Recorded OSM data is clearly dated, and sub-tenth-mile distances read correctly. However, search accepts an impossible ISO date and then silently removes its deadline when Find space opens ([src/domain/query.ts:69](../../../src/domain/query.ts#L69)).
X4 Accessibility of interaction: 3/3: The accessibility script reported zero violations across its desktop and phone states. KPI previews are focusable, legend figures accompany their names, and Area rows provide keyboard access without dozens of marker tab stops.
X5 CRM workflows & differentiation: 4/4: Inquiry matching, competing deals, renewal activity, change history and actionable data issues give this substantial value beyond a static stacking plan. Intended Salesforce toast stubs incur no deduction. Wes would praise the prospect-safe handoff and fix the phone-map collision before a client demo. Todd would praise exact, deterministic space matching and ask why an invalid deadline can disappear without an explanation.
UX TOTAL: 19.5/20

ENGINEERING: 9/10: E1 3.5/4, E2 3/3, E3 2.5/3. All 956 tests across 68 files passed, and TypeScript checking passed without emitting files. Pure domain functions, centralized privacy policy and shared model/state support consistent views. The date-validation discrepancy is a remaining correctness gap. The host adapter provides a credible LWC boundary, although global `:root` tokens and imported MapLibre CSS still need shadow-root adaptation ([src/lib/host.ts:12](../../../src/lib/host.ts#L12), [src/styles/tokens.css:3](../../../src/styles/tokens.css#L3), [src/components/map/MapView.tsx:4](../../../src/components/map/MapView.tsx#L4)). Lint could not execute because the installed Oxlint native binding is missing. Combined score: **96/100**.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Add collision handling between the walk and building labels in MapView. When their projected bounds intersect, offset the walk label above the building pill with at least 8 px clearance; recompute after map movement and resize. Verify at 390 px with both 3- and 5-mile rings. Expected UI gain: 0.5.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Apply the existing calendar-date validator to search dates before offering Find space. Preserve an invalid deadline as a visible error and require correction instead of silently searching without it. FindPanel should also show invalid incoming dates immediately, without waiting for blur. Add regression cases for February 30 and invalid leap days. Expected UX gain: 0.5.

BUGS (with file:line):
- **Phone map hides the folded place count.** At 390 × 844 with `?view=map&ring=5&live=1`, the walk label occupied approximately y=662–688 and the building label y=667–693, obscuring nearly the entire walk label. Geographic anchors and fixed margins provide no label-collision resolution ([src/components/map/MapView.tsx:312](../../../src/components/map/MapView.tsx#L312), [src/components/map/map.css:217](../../../src/components/map/map.css#L217)).
- **Invalid search deadline is advertised, then silently discarded.** Type `12k by 2027-02-30`: the offer says “by Feb 30, 2027.” Press Enter: Needed by becomes blank, the search runs without a deadline, and no error appears. `readBy` accepts the ISO-shaped string; the finder rejects it, while the incomplete-date explanation requires a blur ([src/domain/query.ts:69](../../../src/domain/query.ts#L69), [src/model/usePlanModel.ts:221](../../../src/model/usePlanModel.ts#L221), [src/components/inspector/FindPanel.tsx:73](../../../src/components/inspector/FindPanel.tsx#L73)).
