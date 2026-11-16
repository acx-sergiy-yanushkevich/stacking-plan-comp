# Round 34: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `main` at `1d72631` on its own preview (port 4181).

Checked: 1,037 tests, `tsc -b`, `leakcheck` (0 leaks), `a11y`, `verify`, about 70 phrasings through `readQuery` (15 in the live bar), 320 and 375 px screenshots.

Findings:
- [`query.ts:273`](../../../src/domain/query.ts): a ceiling binds to the first number: "12k no more than 15k" offers 100–12,000 SF and lists 15k as unused. "<15k" and "≤15k" run as a minimum.
- [`usePlanModel.ts:293`](../../../src/model/usePlanModel.ts): an understood state search with no match ("available on floor 4") reads "No tenant, suite or prospect matches".
- `query.ts:20`: "between 12k and 15k" runs as a 12,000 SF minimum; "5000-8000" and "12 to 15 thousand sf" are not read.
- At 320 px the Color-by figures lose their units while Details keeps "SF". Narrow rows mix 10, 11 and 13 px names.
- `query.ts` has grown into regex special cases; a token reader would end the word-order class of bug.
