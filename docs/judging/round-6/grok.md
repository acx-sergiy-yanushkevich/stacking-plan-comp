# Round 6 · Judge: Grok 4.7
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 3, U5 2.5) · UX 17.5/20 (X1 4.5, X2 3.5, X3 3.5, X4 2.5, X5 3.5) · Engineering 8/10

## Top UI fixes
1. Block.tsx:123-132: no initials at 390 px (IIS, CCG, NAA, SE) → SF line + state word; full name in tooltip/aria.
2. lenses.ts:152: safe holdover/MTM must not share the 5+ yr fill → own dashed "Term withheld" swatch, 17,200 SF out of the 5+ total.
3. Header: stale note onto the Data issues button, not a third line.

## Top UX fixes
1. Same lenses.ts:152 + BlockPanel.tsx:104 ("Sep 1, 2016 – —" marks the suite) + TimelineRows.tsx:228-230 (bars end on the cursor): a separate "Term withheld" treatment of 17,200 SF.
2. timeline.ts:80-90: one bar for Ste 720 when the sublease ends on the head-lease date; dotted, "Infinity Info Systems · Ste 720 · sublease".
3. tokens.css:44 --tone-muted-text #6b7280 on #f1f3f5 = 4.35:1 → ≥ 4.5:1 (≈ #5c6370).
4. (= fix 1) phone initials.
5. "Quiet" / "Published" badge on availability blocks (only in the inspector today).

## Bugs
lenses.ts:152; timeline.ts:66-90 double Ste 720; Block.tsx:123-132 initials; tokens.css:44 contrast; BlockPanel.tsx:104 safe term; TimelineRows.tsx:228-230 safe bars on cursor.

## Round-6 council average
UI (17 + 17 + 18)/3 = 17.3 · UX (18.5 + 19 + 17.5)/3 = 18.3 (round 5: 16.7 / 17.7)
