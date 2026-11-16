# Round 35: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `537019c` on its own preview (port 4182).

Checked: 1,043 tests, `tsc -b`, `leakcheck` (0 leaks), `verify`, `a11y`, 61 phrases through `readQuery` and 29 in the live box, Back/Forward with the mode on, Find space closed four ways, the phone at 320 and 390 px.

Findings:
- [`query.ts:250`](../../../src/domain/query.ts): "no less than 12k" runs as up to 12,000. "15k max 12k min" drops the minimum; "12k exclude sublease" runs as sublease only; "12k at most" runs as a minimum; "12 to 15 thousand sf" lists "12" as unused.
- [`FilterBar.tsx:112`](../../../src/components/stack/FilterBar.tsx): the bar's Clear leaves `fit` in the address.
- [`usePlanState.ts:15`](../../../src/state/usePlanState.ts): a sheet closed with its Close button leaves a Back press that does nothing.
- "Floor 8 Ste 860" finds nothing; "available on floor 99" says "No available space on Floor 99 now"; a query of only spaces shows the no-match message.
- A Prospect-safe phone sheet is half a screen with one row; the floor index buttons are 26 px wide and the 22-floor row has no scroll hint.
