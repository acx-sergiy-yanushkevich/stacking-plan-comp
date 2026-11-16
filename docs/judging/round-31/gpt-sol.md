# Round 31: GPT Sol: 88/100

UI 17/20 · UX 18/20 · Engineering 9/10. Sol states it did not validate the full screenshots, the PDFs, `leakcheck` or the `verify` matrix.

Findings:
- [`query.ts:133`](../../../src/domain/query.ts): "before April 1, 2027" is read as on or before that date; only a bare year is made exclusive.
- Phone: the first suite sits low under the controls; Floor 1 takes long scrolling.
- Narrow desktop blocks still use the smallest type.
