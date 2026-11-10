# Round 8 · Judge: Claude Opus 5.5 (A)
UI 17/20 (U1 4.5, U2 4, U3 3.5, U4 2.5, U5 2.5) · UX 19.5/20 (X1 5, X2 3.5, X3 4, X4 3, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Plate floor rail (floor.css:24,26,33,101): row width auto/min 64, flex-start, padding-left 8 px; pct 11 px (fill sits on the first digit of 10/11/12).
2. Narrow tiles never colour-only (Block.tsx ~95-110, 155): state word as a micro line above SF ("Available / 4,000 SF"); "Gap" → "Unaccounted"; inset text 3 px past the risk bar.
3. Keep the lens fact: tiny name before dropping lensShort (Café "$3.25/SF/mo NNN"); Conner: no "FSG" fifth line; FloorPlate.tsx:133 lensShort under SF when no name ("2,400 SF / Feb '27").
4. Trim the LEASED context to "80.2% occupied · 8,000 SF signed, not in"; reconciliation into tooltip; no duplicate date line (NAAH).
5. Timeline in a card with a title row; Today/as-of lines below labels; find/search/worklist dimming keeps name + SF on highlighted alternatives; halo on dotted sublease text in the Deals lens.

## Top UX fixes
1. Find alternatives on the plan: "match-partial" tone with name and SF, not dimmed and textless.
2. One vocabulary: "Unaccounted" (canvas, inspector, legend), "Not available" only in safe; worklist subtitle "Leases ending within 12 months · 4 leases · 35,300 SF".
3. Safe rent roll total 211,200 vs rows 211,700 with no note (PrintLayout.tsx:89) → neutral cap note.
4. Trim the "Label: …" echo from accessible names; deal pill "1 live deal".
5. Safe-mode sale listing in the header: hidden by default or without cap rate (judgment call).

## Bugs
floor.css:26/:33/:101; FloorPlate.tsx:133 Café slice; Block.tsx:100-110 Café rate / Conner fifth line; Block.tsx:155/:40 state word + "Gap"; PrintLayout.tsx:89; timeline Today line over labels; shot 24 is a fullPage capture artefact (use a 390×844 viewport shot); dark 6–12 mo vs 1–2 yr nearly the same; Area "24.1 / min" wraps.
