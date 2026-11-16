# Round 36: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `518d7ea` on its own preview (port 4182).

Checked: 1,055 tests, the type check, `leakcheck` (0 leaks), `verify`, `a11y`, 72 phrases through `readQuery` and about 35 in the live box, phone sheet history, the tablet at 1024 px, the tab order, phones at 320, 360 and 390 px in all four buildings.

Findings:
- [`FilterBar.tsx:99`](../../../src/components/stack/FilterBar.tsx): the same empty-state regression, in Stack, Building, Timeline and Map.
- [`usePlanState.ts:55`](../../../src/state/usePlanState.ts): Back, Forward, then Close over a phone sheet leaves a Back press that does nothing.
- [`query.ts:331`](../../../src/domain/query.ts): "12k excluding direct" runs as direct.
- [`stack.css:99`](../../../src/components/stack/stack.css): at 320 px Legacy West's Floor 16 card cuts "…6,000 subleas".
- "Ste. 860" and "#860" find nothing; "bigger than 12k" lists "bigger, than" as unused.
