# Round 35: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `537019c` on its own preview (port 4181).

Checked: `leakcheck` (0 leaks), `a11y`, `verify`, about 60 phrasings through `readQuery` and 13 in the live bar, phones at 320, 360 and 390 px (Legacy West's 22 floors), tablet Back at 761, 800 and 1024 px.

Findings:
- [`query.ts:231`](../../../src/domain/query.ts): the word after a size outranks the one before it: "min 12k max 15k", "at least 12k max 15k" and "12k sf max 15k sf" run as 100–12,000 SF.
- `query.ts:248`: "no less than 12k", "not less than 12k" and "not under 12k" run as up to 12,000. `:300`: "12k not a sublease" runs as sublease only.
- "12 to 15 thousand sf" lists "12" as unused; "12k—15k" and "5000-8000" are not read.
- [`usePlanState.ts:15`](../../../src/state/usePlanState.ts): the sheet is a history entry only up to 760 px, but it shows up to 1099 px; on a tablet Back leaves the plan.
- [`stack.css:81`](../../../src/components/stack/stack.css): at 360 px the floor index needs 361 px and cuts off "1"; the 22-floor index overflows with no hint.
- At 320 px the Rent switch shows a bare "$30.71". "No for sale space on Floor 5" is ungrammatical.
