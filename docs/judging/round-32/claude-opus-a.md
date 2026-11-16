# Round 32: Claude Opus A: 95/100

UI 19/20 · UX 19.5/20 · Engineering 9/10. Judged commit `04dd94b`.

Checked: 1,029 tests, `leakcheck` (0 leaks, with the Back/Forward entry count), `a11y`, `verify` (nine sizes), a name-fit probe at eight more sizes, a 13-step history trace, 30 search phrasings, search "largest block" against the KPI in four buildings at three dates.

Findings:
- [`query.ts:31`](../../../src/domain/query.ts) and `:150`: "12k before end of 2027" reads as by Dec 31, 2026, a year early.
- "12k before Nov 9" with an as-of date of Nov 9 is offered as the past date Nov 8 with no warning in the bar.
- [`usePlanModel.ts:166`](../../../src/model/usePlanModel.ts): "largest block" keeps its own rule beside the KPI's `largestBlock` (`kpis.ts:101`); they agree on today's data only.
- [`Block.tsx:267`](../../../src/components/stack/Block.tsx): at 1100×800 two Floor 1 blocks of Legacy West (65×43) lose their names; `verify` does not visit it.
- Rows still mix 13, 11 and 10 px lines. The phone stack has no floor index; header touch areas are 42 px.
- "12 k sf" lists "12" as unused; the "2 of 4" stop ordinal has no test.
