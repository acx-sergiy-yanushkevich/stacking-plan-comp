# Round 38: Grok 4.7: 96/100

UI 20/20 · UX 19/20 · Engineering 9/10. Judged `1acfecd` on its own preview (port 4184); 1,084 tests, `a11y`, a Prospect-safe scan, the phone row at 320, 360 and 390 px.

Findings:
- [`query.ts:309`](../../../src/domain/query.ts): "maximum of 14k", "max of 14k", "max. 15k", "not to exceed 15k", "shall not exceed", "do not exceed" run as minimums, and Enter runs them.
- "not greater than or equal to 15,000 SF" runs as a minimum; "not less than or equal to 12,000" as up to 12,000.
- `query.ts:318`: "12k +/- 2k" runs a 12,000 SF minimum with nothing listed as unused.
- `query.ts:271`: "between about 12,000 and 15,000 sf" is called impossible (15,000–13,200).
- `query.ts:241`: "5000-8000 max 6000" lists "max, 6000" as unused.
- `query.ts:420`: "31/12/27" lights Suites 1200, 1250 and 120.
- `query.ts:431`: "the 8th floor", "floors 8 and 9", "floors 3, 4 and 5" are not read.
- `query.ts:362`: "12k or 15k or 18k" is an impossible 18,000–15,000.
