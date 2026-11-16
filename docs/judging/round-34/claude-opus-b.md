# Round 34: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `main` at `1d72631` on its own preview (port 4182).

Checked: 1,037 tests, `leakcheck` (0 leaks), `verify`, `a11y`, about 40 phrases through `readQuery` and 17 in the live box (owner and Prospect-safe), a 45-stop Tab trace, a Back/Forward walk with the mode on, the phone at 320 and 390 px.

Findings:
- [`query.ts:273`](../../../src/domain/query.ts): "not more than 15k" and "smaller than 15k" run as a minimum; `:269`: "12k no sublease" runs as sublease only; "between 10k and 15k" runs as a 10,000 SF minimum.
- [`Toolbar.tsx:72`](../../../src/components/shell/Toolbar.tsx), `App.tsx:277`, `App.tsx:364`, `actions.ts:43`: closing Find space leaves `fit=direct` in the address.
- [`usePlanModel.ts:293`](../../../src/model/usePlanModel.ts): "vacant 4th floor" with no hits gets the name-search message.
- Focused SVG plan cells and rollover bars show only a thin stroke ([`stack.css:32`](../../../src/components/stack/stack.css)).
- A prospect's phone suite sheet is mostly empty; phone Back leaves the view; Floor 8 Ste 860 shows its rate without its SF.
