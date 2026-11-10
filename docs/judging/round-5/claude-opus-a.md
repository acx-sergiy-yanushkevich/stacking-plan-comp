# Round 5 · Judge: Claude Opus 5.5 (A)
UI 16/20 (U1 4.5, U2 4, U3 3, U4 2.5, U5 2) · UX 18/20 (X1 4.5, X2 4, X3 3.5, X4 2.5, X5 3.5) · Engineering 8.5/10

## Top UI fixes
1. Stop truncating names: Block.tsx compact 4th line is added then trimmed by the 15px maxLines loop → allow maxLines+1 (compute at 13px when h ≥ 66); port 4-line fallback to tier ≤1 (BeachBody keeps expiry + rent); phone: FONT_TINY 2–3 line whole name before "…"; FloorPlate whole-name-or-initials (no bare "Café").
2. Short rate must carry "/SF": segmentText.ts:178 → `$30/SF/yr FSG`; own line if it does not fit.
3. Print plan blocks carry the lens fact (expiry date / rate); three-line rows where the name wraps so Conner and Café keep SF.
4. Timeline: legend above axis; marketed availability bars in available-later tone, not the lease's expiry tone; trailing Holdover tag must not overlay the next bar's label (TimelineRows.tsx:383-389).
5. Collisions: phone map controls anchored to the canvas (below the static legend); worklist marketed pill own line; dark expiry ramp 6–12 mo vs 1–2 yr ≥15 L*; FloorPanel "·" separators attached to next part.

## Top UX fixes
1. Safe risk leases uniform & truthful: exportCsv.ts:111,152-154 Expiration "—", Remaining "—"; safe timeline bars labelled "Tenant · Ste 300 · 11,000 SF" like every other bar (currently just "Tenant").
2. Safe PDF rollover header "Share of leased" is share of 194,500 → "Share of listed SF" or add "Not shown 17,200" row (PrintLayout.tsx:112). Ship "/SF" fix.
3. KPI active state only when its own click produced the state (bucket 1–2 yr lights "Expiring 12 mo"; Timeline lights "WALT"); inspector deal/inquiry titles wrap (inspector.css:48).
4. Listing status cue ("Published"/"Quiet") on availabilities; standing "N looking" pill on available/marketed blocks in every lens.
5. Floor-plate slices roving-grid keyboard model like the stack; opaque label backing behind lobby hatch and dimmed-block text.

## Bugs
segmentText.ts:178 no "/SF"; Block.tsx:100-112 4th line trimmed; Block.tsx:68-85 tier ≤1 no 4-line fallback; FloorPlate "Café"; exportCsv safe holdover row; PrintLayout.tsx:112 header; TimelineRows Holdover tag overlay; timeline marketed bar tone; map.css:139 phone controls over legend; WorklistPanel.tsx:97 pill collision; inspector.css:48 ellipsis; phone stack fragments, blank lobby, Floor 1 suites without SF; expiry PDF plan without dates.
