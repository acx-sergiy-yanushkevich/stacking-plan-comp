# Round 37: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `99f27d9` on its own preview (port 4181); tests and the type check ran on an exported copy of that commit.

Checked: 1,066 tests, `tsc -b`, `leakcheck` (0 leaks), `a11y`, `verify` (88 of 88), about 90 phrasings through `readQuery` and `search`, 24 queries in the live bar (Stack, Map, Timeline, owner and Prospect-safe), phone sheet history at 390 px. All four round-36 findings fixed.

Findings:
- [`query.ts:247`](../../../src/domain/query.ts): "12k max 15k max 14k" is read as at least 15,000 and at most 12,000, and the bar calls it impossible.
- `query.ts:215`: a range returns before a third bound is read ("12k-15k max 14k" lists 14k as unused).
- [`usePlanModel.ts:170`](../../../src/model/usePlanModel.ts): "unit 860", "Suite 860." and "860, 870" find nothing; "floors 3-5" is not read. The floor regex is copied at `:191` and `:332`; the suite and floor vocabulary belongs in `domain/query.ts`.
- A bare ceiling reads "100–14,000 SF": the 100 SF is the finder's own floor.
- Narrow rows mix 11 and 13 px names; the phone stack is about seven screens; floor-index buttons are 22–26 px wide.
