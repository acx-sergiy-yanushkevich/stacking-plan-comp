# Round 33: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged HEAD `5a4c711`.

Checked: 1,033 tests, `leakcheck` (0 leaks), `a11y`, `verify`, about 70 requirement phrases, 27 Prospect-safe searches, a 45-stop Tab trace, a Back/Forward walk with the mode on, the phone at 320 and 390 px.

Findings:
- [`query.ts:81`](../../../src/domain/query.ts): "before 6/15" gives May 31.
- `query.ts:209`: "0-15k" becomes a minimum of 15,000 SF without a word. `:260`: "12k sublease direct" drops "sublease" unnamed.
- [`usePlanModel.ts:299`](../../../src/model/usePlanModel.ts): the owner's match label says "tenant name", not the tenant.
- [`usePlanState.ts:8`](../../../src/state/usePlanState.ts): choosing a suite replaces the entry, so a phone's system Back leaves the view instead of closing the sheet.
- Floor 8 Ste 860 at 1440×1000 shows a rate and no SF. "vacant 4th floor" finds nothing. A Prospect-safe suite sheet on a phone is mostly empty. Rent steps 0 and 1 still alike.
