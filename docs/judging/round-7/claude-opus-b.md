# Round 7 · Judge: Claude Opus 5.5 (B)
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 19.5/20 (X1 5, X2 4, X3 3.5, X4 3, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Halo every label drawn on a pattern (sublease dots, committed/lobby hatch, timeline bars); timeline labels need a chip so the cursor line never cuts a name ("Argosy Par|tners").
2. Phone narrow tiles: drop the name before the SF, never the SF ("2,400 SF / Feb '27"); "Avail" → "Available" on two lines or SF + fill.
3. Dark exp-3 #6a5420 is olive → same-hue brown (#6e4524, text #ffe9d2); map floor rail needs a state word or pattern chip.
4. Timeline short bars: whole "Name · Ste · SF" in the free lane to the right (Cirrus, Argosy, phone holdover bar).
5. Print page-3 worklist RENEWAL column overflows the right rule (print.css:24 nowrap on --tight); Café plate slice should keep its lens fact (try lensShort alone).

## Top UX fixes
1. KpiStrip Leased context lists "500 over-allocated" as an additive part (sums to 86.6%) → write as subtraction "−500 over-allocated (capped)"; hide in safe; test physical + committed + sublet − overAlloc = occupancy.
2. Safe Pipeline KPI is a dead button (App coerces deals→status) → non-interactive card in safe.
3. Find-space inquiry option = prospect name only (range in helper text) → no truncation.
4. Safe Recent changes: "Record created changed", raw "Rent High changed" → plain-language sentences.
5. Announce block selection via the live region (or focus the inspector heading) on Enter.

## Bugs
KpiStrip.tsx:34 additive over-allocation + shown in safe; safe Pipeline KPI dead control; FindPanel inquiry option overflow; BuildingPanel safe change wording; tokens dark exp-3 olive; Block "Avail" + phone Floor 1 SF; FloorPlate Café slice SF-only; print.css:24 page-3 overflow; TimelineRows short bars lose suite/SF, phone holdover chip without name, cursor crosses labels.
