# Round 8 · Judge: Grok 4.7
UI 18.5/20 (U1 4.5, U2 4.5, U3 4, U4 3, U5 2.5) · UX 18/20 (X1 5, X2 3.5, X3 3.5, X4 2.5, X5 3.5) · Engineering 8.5/10

## Top UI fixes
1. Phone: keep one visible "+500 SF over" line (StackView.tsx:228-241 `!phone`, stack.css:45 hides the legend note).
2. Map floor rail state word visible (already in source; the judged build predates it).
3. For-sale price on its own line or in the Building panel (Header.tsx:55-70).

## Top UX fixes
1. "90 days" / "180 days" windows compare whole months (usePlanModel.ts:66, :81) → use daysBetween; Preston Park Café (111 days) must leave the 90-day list.
2. One "inside 12 months" test: KPI `m < 12` (kpis.ts:80), worklist `months <= 12` (usePlanModel.ts:81), rollover `floor(months/12)` (rollover.ts:26) → `<`.
3. Area panel has no entry point (only `?mode=area`) → add a control.

## Bugs
usePlanModel.ts:66/:81 day windows; 12-month predicates disagree; Area unreachable from the UI; phone hides Floor 7 over-allocation; served map chunk behind source (unpromoted build).

## Round-8 council average (three judges)
UI (17 + 17.5 + 18.5)/3 = 17.7 · UX (19.5 + 19 + 18)/3 = 18.8 (round 7, two judges: 17.25 / 19.25)
