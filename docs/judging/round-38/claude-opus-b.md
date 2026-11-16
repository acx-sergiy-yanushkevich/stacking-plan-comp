# Round 38: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `1acfecd` on its own preview (port 4182); 1,084 tests, `leakcheck` (0 leaks), `a11y`, `verify`, about 120 phrases through `readQuery` and `readPlace` and 30 in the live box, a keyboard walk, Back and Forward across views and sheets, 13 Prospect-safe deep links. All round-37 findings fixed and confirmed live.

Findings:
- [`usePlanState.ts:15`](../../../src/state/usePlanState.ts): on a phone or tablet the tool sheets (Find space, Worklist, Data issues, Area) are not history entries: Back closes the sheet and changes the view, or leaves the app when the sheet was opened first (390 and 1024 px).
- [`query.ts:54`](../../../src/domain/query.ts): "sublease floors 7-8" and "available on floors 3-5" are not read (`readState` knows one floor).
- `query.ts:362`: "12k to 15k or 20k" is called impossible.
- "12k approx" runs a minimum while "approx 12k" is a range; "12k ± 1k" drops the ±; "12k/15k" runs 15,000 and lists itself as unused.
- `query.ts:391`: "by 2/30 direct" gets the name-search message.
- "floors 3 to 99" and "860, 870" do not name what is missing.
- [`FilterBar.tsx:37`](../../../src/components/stack/FilterBar.tsx): the live region is created with its first message.
- At 320 px the view tabs and Find space are cramped, and the 36 px tabs sit beside 44 px tools.
- Not scored: the mock contact names are fictional CRM data; worth a deliberate decision against the anonymity rule.
