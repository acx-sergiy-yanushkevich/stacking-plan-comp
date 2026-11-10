# Round 6 · Judge: Claude Opus 5.5 (B)
UI 17/20 (U1 4.5, U2 4.5, U3 3, U4 2.5, U5 2.5) · UX 19/20 (X1 5, X2 4, X3 3.5, X4 2.5, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Inspector deal-row overlap (parts.tsx:69-76 + inspector.css:51 nowrap) → separate spans, wrapping.
2. Block: badge-reserved width applied to every line → apply only to line 1, `w − 2·PAD` for fact lines (restores rent on BeachBody / Café / Conner); first-word fragment "BeachBody" at 1280 px (Block.tsx:135-139) → tiny whole name or nothing.
3. Phone: Floor 1 tiles keep SF (drop name before SF); phone timeline tagged bar name in free lane; rollover header cells padded from the cursor.
4. Map floor rail: dominant state word or pattern chip; dark expiry ramp one hue (olive 2–3 yr, grey 3–5 / 5+ break lightness order).
5. KPI context clamp ellipsises at 1200–1300 px → shorter copy; lobby label solid chip; Café slice tiny 3-line name.

## Top UX fixes
1. Rent roll sublease row (exportCsv.ts:135-139): head lease commencement/rate replaced by "Now" + asking range → show head lease's own; sublease asking in State or separate column; test.
2. Safe CSV includes "Not placed" rows the safe PDF filters (exportCsv.ts:52-55) → skip when safe; test same row set.
3. physical not scaled for over-allocation while leased is capped → 86.1% − 80.2% ≠ 8,000 + 7,000 (kpis.ts:120-131).
4. aria-labels from text.aria (full name first), not the abbreviation/glyph; map floor rail buttons announce state.
5. Safe Recent changes lists Lease field changes linked to a suite (BuildingPanel.tsx:236) → availability-only or hide.

## Bugs
parts.tsx overlap; exportCsv sublease row; safe CSV unplaced rows; kpis physical scaling; TimelineRows phone holdover name width 0; Block badge width on every line; Block "BeachBody" fragment at 1280; phone aria abbreviations; kpis.css clamp; BuildingPanel safe changes.
