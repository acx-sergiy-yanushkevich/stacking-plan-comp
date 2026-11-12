JUDGE: gpt-6.1-sol
ROUND: round-21

UI SCORE
U1 Visual hierarchy & layout: 5/5: The building leads clearly, followed by the quiet KPI groups and toolbar. At 1180 and 1280 px, search and tools wrap below the view/lens controls without covering them. Docked floors and inspectors retain useful plan space.
U2 Color & data encoding: 4.5/5: Exact figures, patterns, explicit states and coherent lens palettes communicate well. Stack and Building name their active lens, but Map and Timeline legends still lack that title.
U3 Typography & density: 4/4: Tenant names wrap completely, SF remains exact, and floor-plate keys preserve names and rents that cannot fit inside slices. The light expiration screenshot is particularly readable.
U4 Polish & platform fit: 3/3: The Ascendix glass treatment feels consistent across light and dark themes. Selected, dimmed and focused states are distinct; the shortened actions retain descriptive accessible names.
U5 Mobile & print visual quality: 2.5/3: The phone header, readable stack cards and expanded location sheet work well. All three PDFs have clean pagination and legible tables. On phones, however, collapsed legends reveal state names without a dependable tap path to their figures and explanatory notes.
UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 5/5: The ten principal jobs are represented. The 12,000–15,000 SF requirement identifies Floor 6, its April 2027 availability and divisible option. The renewal worklist reconciles with the KPI at 35,300 SF and four leases. Data issues, sale space, subleases and multi-floor tenants remain actionable.

What Wes would say on the podcast: "The requirement finder and prospect-safe report make a convincing client demonstration. Before handing over the phone, make the legend's hidden details work with a tap."

X2 Interaction & IA: 3.5/4: Tool access, selection, Escape behavior and the Area/Location brief relationship are coherent. Escape from an empty toolbar search closes the finder. The clarity pass remains inconsistent: "Committed" survives in Coming supply and exported state labels, while Data issues still refers to "WALT."
X3 Trust & domain correctness: 3.5/4: Over-allocation is disclosed rather than double-counted in occupancy; asking rents retain units and lease types. No private names, broker names, building sale price or verified stamps surfaced in the tested prospect-safe labels and PDF. One confirmed correctness defect remains: a 5,000 SF minimum with a 3,000 SF maximum produces an alleged fit split to 3,000 SF. src/domain/finder.ts:245 permits the split without validating the requirement range.

What Todd would say on the podcast: "The reconciliation and deterministic results are strong. Why can an impossible size range still produce a confident match?"

X4 Accessibility of interaction: 2.5/3: Floor 1's End key reaches the sale suite; Right Arrow wraps to the first suite without entering the lobby. Tool focus and descriptive slice names are strong. Legend figures, however, live in native titles on non-focusable spans; the focusable information icon has no visible focus-triggered explanation.
X5 CRM workflows & differentiation: 4/4: Inquiry matching, competing deals, renewal outreach, activity recency, record actions and data repair provide meaningful advantages over a static stacking plan. These implement the CRM-specific opportunities described in docs/COMPETITORS.md.
UX TOTAL: 18.5/20

ENGINEERING (informational): 9/10: All 892 tests across 63 files passed with npm test -- --cache=false. Pure domain functions, centralized prospect-safe projections, URL state and the host adapter form a credible foundation for Salesforce integration. The invalid-range result exposes a missing domain invariant, and the legend tests verify markup without proving keyboard or touch behavior. The repository remained unchanged; no build or server operation was performed.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Add the active lens name beside every Map and Timeline legend, including their folded phone summaries. Derive it from LENSES using state.lens. Apply the same explicit identification to the PDF cover legend. Expected gain: +0.5 U2.
2. Give legend figures and ⓘ notes visible popovers that open on hover, focus and tap. Preserve the compact state-name layout and full PDF figures. Expected gain: +0.5 U5.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Reject max < minimum before running the finder. Preserve both entered values, mark Max SF invalid, show "Maximum must be at least 5,000 SF," and suppress options and match highlights until corrected. Enforce the same invariant for URL-loaded requirements. Expected gain: +0.5 X3.
2. Replace remaining display labels "Committed" with "Signed, not yet in" and "WALT" with "Avg term." Update exported labels and the print total's label-dependent classification together; retain internal enum values. Expected gain: +0.5 X2.
3. Make each legend entry keyboard reachable with its SF/share exposed through an accessible description and visible tooltip. Make ⓘ a real disclosure button supporting Enter, Space, tap and Escape. Expected gain: +0.5 X4.

BUGS (with file:line):
- P2 — src/domain/finder.ts:245: ?view=stack&mode=find&req=5000&max=3000&fit=direct returns "1 option," offering Floor 3 suite 350 split to 3,000 SF despite the 5,000 SF minimum. The inputs at src/components/inspector/FindPanel.tsx:96 provide no cross-field validation.
- P2 — src/components/plan/Legend.tsx:73: SF/share figures exist only in native titles on non-focusable spans. Keyboard users cannot focus entries to reveal them. At src/components/plan/Legend.tsx:102, ⓘ is focusable but supplies no visible focus or tap disclosure.
- P3 — src/components/map/MapView.tsx:330 and src/components/timeline/TimelineView.tsx:157: legends omit the active lens title; phone summaries remain "Legend · N states."
- P3 — src/components/inspector/BuildingPanel.tsx:180, src/domain/exportCsv.ts:28 and src/domain/issues.ts:119: "Committed" and "WALT" remain in user-facing content after the round-21 terminology pass.
