# Round 31: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10.

Checked: 1,027 tests, `tsc -b`, `leakcheck` (0 leaks), a fit probe over 4 buildings × 4 lenses × owner and Prospect-safe at 10 window sizes that `verify` does not visit, a Back history trace, 17 search phrasings.

Findings:
- [`usePlanState.ts:36`](../../../src/state/usePlanState.ts): Back with Prospect-safe on writes the address with `pushState` (the popped view differs from the last state), so Back needs two presses and Forward is lost. No leak.
- [`Block.tsx:267`](../../../src/components/stack/Block.tsx): the 10 px wrapped name is offered only when `tier >= 2 || suite`. Legacy Coffee Roasters loses its name at 1920×1080, 1600×900 and 1536×864 and keeps it at 99 px; two Preston Park names are lost at 1180×800. `verify` samples five sizes only.
- [`query.ts:151`](../../../src/domain/query.ts): "12k-15k" is read as a range and also listed as "Not used". Bare numbers are never listed ("12k sf for 5 years" drops the 5).
- [`usePlanModel.ts:166`](../../../src/model/usePlanModel.ts): "largest block" repeats a rule instead of using the KPI's own block.
- Short rows mix 13/11/10 px lines.
