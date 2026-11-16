# Round 36: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `518d7ea` on its own preview (port 4181).

Checked: 1,055 tests, `leakcheck` (0 leaks), `a11y`, `verify`, about 65 phrasings through `readQuery` and 35 in the live bar (owner, Prospect-safe, Map, Timeline), phone sheets and Back at 390 px.

Findings:
- [`FilterBar.tsx:100`](../../../src/components/stack/FilterBar.tsx): the bar decides "nothing matched" by `label.startsWith('No ')`, so the round-36 labels render as "Showing There is no Floor 99 here (Floors 1–12).. Other space is dimmed."; on the Map they offer "Show on the plan" (`:78`). No test covers the wording.
- "ste 860 floor 8" finds nothing; "floor 99" alone gets the name-search message; "1200-1250" finds nothing.
- An inquiry pick keeps a leftover `fit` ([`FindPanel.tsx:164`](../../../src/components/inspector/FindPanel.tsx), `FloorLists.tsx:140`).
- The Clear patch is copied at seven sites instead of one constant.
