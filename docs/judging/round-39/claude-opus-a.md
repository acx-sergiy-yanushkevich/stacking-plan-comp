# Round 39: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `16cdd15` on its own preview (port 4181); `tsc -b` and 1,101 tests on an export of HEAD, `verify`, `leakcheck` (0 leaks), `a11y`, about 75 phrasings through the reader, 35 live searches with the spoken text compared to the visible text. All seven round-38 findings fixed.

Findings:
- [`usePlanState.ts:23`](../../../src/state/usePlanState.ts): `sheetOn` reads `state.mode`, but a requirement, inquiry or window shows its sheet with mode `building` (`deriveMode`): on a phone, Find space, 12000, a result, then Back drops the requirement; or Close, then Back reaches the Timeline and a second Back leaves the app. [`actions.ts:12`](../../../src/components/plan/actions.ts): a result opened from Find or the Worklist replaces the sheet's entry.
- [`query.ts:376`](../../../src/domain/query.ts): "12k ± 10%" offers 2,000–22,000 SF; "12k and 15k" runs a 15,000 minimum; "12k or about 15k" drops the 12k; "12 000 sf" is not read.
- [`FilterBar.tsx:15`](../../../src/components/stack/FilterBar.tsx): the spoken text leaves out "Not used", the past-date notice and the inverted-range fix.
- [`usePlanModel.ts:354`](../../../src/model/usePlanModel.ts): "suite 9999" and "870 on floor 8" get the generic name-search line.
- Three-line blocks in 50 px rows touch their top edge; dimmed blocks drop every label during a search; the phone's first floor card starts about 455 px down.
