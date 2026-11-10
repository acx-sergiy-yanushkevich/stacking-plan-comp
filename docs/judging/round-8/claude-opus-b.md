# Round 8 · Judge: Claude Opus 5.5 (B)
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 19/20 (X1 5, X2 4, X3 3.5, X4 2.5, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Map floor rail: visible state word or pattern chip after the % (state is aria-only today).
2. Phone stack/plate: never drop the state word on available / for-sale tiles ("4,000 SF / Available" at tiny font); 6 px left padding past the 3 px state bar; phone plate slices ≥ 24 px draw the lens fact.
3. Mini floor rail (floor.css:24-34, 96, 101): padding-left 8 px so the fill never sits under the number; pct 11 px; phone rows wider or number only.
4. Timeline labels: chip behind every label and Today/as-of lines beneath the label layer; short bars write "Name · Ste · SF" in the free lane; phone clamps labels to the viewport edge.
5. Block text budget: no duplicate date line (North American: "6,500 SF · Oct '27" then "Exp Oct 2027 · 11 mo"); rent lens Café must show "$3.25/SF/mo NNN" (tiny name).

## Top UX fixes
1. Remove the "Label: …" duplicate from gridcell aria-labels (facts read twice on all 56 cells); visible SVG text aria-hidden.
2. Announce selection on Enter/click via the live region (or focus the inspector h2).
3. Safe Leased context: parts sum to 86.3% vs 86.1% headline once the over-allocation clause is hidden → no figures, or neutral "(Floor 7 capped)"; test both modes.
4. One pipeline SF definition: KPI 57,800 (deal size capped) vs Deals-lens legend 58,600 (space SF); say whether Lease out counts.
5. `?select=` deep link on ≤ 1100 px should scroll the block clear of the sheet.

## Bugs
floor.css:33-34 mini fill under number; floor.css:96 phone row 36 px clips "100.0%"; floor.css:101 9 px; TimelineRows 237-247/293 phone Holdover tag without name; TimelineRows spill drops SF/suite with free lane (Café, BeachBody, NAAH); Today line above labels; kpis.ts:106 vs lens legend pipeline SF; KpiStrip safe context sum; aria facts twice; rent lens Café no rate; NAAH date repeated; Area panel "24.1 / min" wraps; phone ?select= no scroll.
