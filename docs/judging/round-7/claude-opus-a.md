# Round 7 · Judge: Claude Opus 5.5 (A)
UI 17/20 (U1 4.5, U2 4, U3 3.5, U4 2.5, U5 2.5) · UX 19/20 (X1 5, X2 3.5, X3 4, X4 2.5, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Phone Floor 1 tiles: keep SF in place of the name ("2,400 SF / Feb '27", "4,000 SF / Available"); never "Avail"; Floor 7 sublease tile needs "Sublease".
2. FloorPlate: lens fact for a nameless slice is added then dropped by the chord-fit filter (Café = colour-only) → guarantee "2,400 SF" + "Feb '27" at tiny font, plus the 3 px edge bar; plate floor rail ≥ 11 px with the leased bar not over the numbers.
3. Header at 1000–1199 px: facts wrap into a vertical list with trailing "·" → wrapping flex row, separators as ::before, nowrap per fact.
4. Dark expiry ramp: one orange-brown hue stepping in lightness (olive 2–3 yr, greys 3–5 / 5+ break order).
5. Rent lens Café: tiny name so the 4-line budget holds name / SF / rate / type; print block line-height ≥ 1.2.

## Top UX fixes
1. FindPanel inquiry select: prospect name only; range + needed-by as helper text.
2. Sheet hides the selected block below 1100 px → snap to 45 % and scrollIntoView with scroll-margin-bottom.
3. Map floor rail aria/title with dominant state + visible pattern/word; plate aria from text.aria only (no visible-fragment prefix).
4. Changes rows name the Deal/Inquiry record (BlockPanel ~177); safe "Record created" → "New listing" (BuildingPanel:238).
5. Pipeline-by-stage caption: "SF counts each space once, at its most advanced stage".

## Bugs
FloorPlate.tsx:133/:151-154 lens fact dropped; FindPanel.tsx:96-99 truncation; BuildingPanel.tsx:238 "Record created changed"; BlockPanel Changes rows omit recordLabel; phone Floor 1 SF + "Avail"; TimelineRows phone Argosy label clipped behind the Holdover tag; header 1000 px wrap; dark expiry tokens; plate floor rail 9 px overlap.
