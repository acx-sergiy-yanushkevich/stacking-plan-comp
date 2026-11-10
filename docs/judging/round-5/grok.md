# Round 5 · Judge: Grok 4.7
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 17/20 (X1 4.5, X2 3.5, X3 3, X4 2.5, X5 3.5) · Engineering 8/10

## Top UI fixes
1. Never paint a partial tenant name: Block drop name lines instead of "…" (title/aria carry the full name); FloorPlate drop every name line if any fails ("Café").
2. Dark contrast: deal-count pill white on #8ec0ff (1.89:1, plan.css:31) → dark blue fill; --tone-exp-1-fill #d4582a with white text 4.02:1 → darker; warn pill #c25e00 4.29:1 → darker.
3. Dock the map legend in the card chrome (header or a row under the canvas), not absolute over the building (map.css:29; covers x 740–1040).
4. Phone map legend: stop hiding SF figures (map.css:136); no-ellipsis names at 390px.
5. Print Floor 1 café two-line wrap so lobby label and tenant are not on one crowded band.

## Top UX fixes
1. KpiStrip.tsx:32 Leased context "6,500 SF sublet vacant" vs Available/legend 7,000 → use availableSublease.
2. Safe rent roll holdover/MTM: Expiration/Remaining "—" (exportCsv.ts:142,152).
3. timeline.ts:73-88 Ste 720 drawn twice (head lease + sublease, both 7,000 SF) → one bar + Sublease tag, SF once.
4. Dark deal-pill / exp-1 contrast (X4).
5. Floor 1 plate "Preston Park Café" or no name.

## Bugs
KpiStrip 6,500; safe rent roll holdover row; timeline Ste 720 double bar; Block "Preston…"/"Conner…" at 91–92px; FloorPlate "Café"; dark deal pill 1.89:1; dark exp-1 4.02:1; safe worklist "Confidential" vs "Rent hidden" (WorklistPanel.tsx:83); safe worklist empty state still says "check At risk" (:77).

## Round-5 council average
UI (16.5 + 16 + 17.5)/3 = 16.7 · UX (18 + 18 + 17)/3 = 17.7 (round 4: 16.7 / 17.7)
