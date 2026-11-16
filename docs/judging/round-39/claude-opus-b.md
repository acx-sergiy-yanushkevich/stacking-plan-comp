# Round 39: Claude Opus B: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `16cdd15` on its own preview (port 4182); 1,101 tests, `leakcheck` (0 leaks), `a11y`, `verify` (98 checks), `pdfcheck`, about 120 phrases through the reader, phone and tablet history at 390 and 1024 px, 36 Prospect-safe deep links scanned for 47 names. Every round-38 finding fixed and confirmed live; X2 4/4.

Findings:
- [`query.ts:376`](../../../src/domain/query.ts): "12k +/- 10%" reads 2,000–22,000 SF (the 10 taken as 10k, the % ignored).
- `query.ts:22`: "10k thru 12k" and "10k through 12k" drop the 10k; "10k..12k" is unread.
- [`FilterBar.tsx:15`](../../../src/components/stack/FilterBar.tsx): the spoken requirement leaves out "Not used" and the past-date notice that the bar shows.
- [`Menu.tsx:43`](../../../src/components/ui/Menu.tsx): no Home or End, and Tab cycles inside the open menu.
- [`usePlanState.ts:9`](../../../src/state/usePlanState.ts): with a tool sheet open, a view change and then Close leave a Back that reopens the sheet on the old view.
- A deep-linked suite opens with the sheet handle's keyboard ring (screenshot 24); near misses that gain an inquiry badge drop to 10 px names; "12 000 sf" is not read.
