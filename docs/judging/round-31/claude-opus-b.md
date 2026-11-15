# Round 31: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10.

Checked: 1,027 tests, `leakcheck` (0 leaks), `verify`, `a11y`, keyboard-only paths, about 60 search phrasings, a Back/Forward walk with Prospect-safe on.

Findings:
- [`usePlanState.ts:36`](../../../src/state/usePlanState.ts): the same duplicate history entry after Back with the mode on; Forward is destroyed.
- [`query.ts:151`](../../../src/domain/query.ts): the range pattern lacks `k?` after the first number ("12k-15k" reported as unused). "12k by end of 2027" drops the year; "12k on floor 8" drops the 8.
- [`query.ts:127`](../../../src/domain/query.ts): "12k by 31/12/27" is called "not a date on the calendar" though it is a day-first date.
- [`usePlanModel.ts:297`](../../../src/model/usePlanModel.ts): the one-match label repeats the floor ("Floor 6 on Floor 6 Ste 600").
- Focus falls to `<main>` after Escape from a worklist opened by the Building panel's Holdover row.
- `?safe=1&q=12k` opens with the search dropped.
- Rent steps 0 and 1 differ mostly in lightness.
