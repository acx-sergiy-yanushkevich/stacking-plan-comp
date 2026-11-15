# Round 33: Grok 4.7: 96/100

UI 19.5/20 · UX 19/20 · Engineering 9.5/10.

Findings:
- [`query.ts:81`](../../../src/domain/query.ts): "12k before 6/15" gives May 31, 2027 and "before 12/15" gives Nov 30, 2026; "by 6/15" and "before June 15, 2027" are right.
- [`kpis.css:120`](../../../src/components/kpis/kpis.css): at 320 px "Expiration" runs 7 px past its switch.
- [`usePlanModel.ts:166`](../../../src/model/usePlanModel.ts): "largest contiguous block" finds nothing.
