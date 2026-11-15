# Claude Opus B, round 30

**UI 18.5/20 · UX 19/20 · Engineering 9/10 · total 93**

Checks: 1,023 tests, tsc, verify, leakcheck (0), a11y; probes of Back, 21 search phrasings, KPI names, fitted rows at 7 sizes with no exemptions.

- U2 4.5/5: the Rent legend leaves "For sale" alone on a second line at 1440 px; Rent steps 0 and 1 (`ascendix.css:77-78`) differ only in lightness.
- U3 3/4: Legacy West "Legacy Coffee Roasters" (131×43) shows "Ste 100 · 2,200 SF / Exp Feb 2028" with no name at 1470–1920 px (`Block.tsx:261`; the 10 px name is offered only to `tier >= 2 || suite`); verify skips it (`scripts/verify.mjs`, 140×48 exemption). At 1280 px Bowline loses its name to its stale-touch badge; at 1180×800, 42 names or rates are lost.
- X2/X3: **Back un-hides Prospect-safe**: `safe` is a navigation (`usePlanState.ts:37-38`), so one Back from `?view=stack&safe=1` shows every tenant name. "12k by 1/6/27" drops its date (`query.ts:31`); "largest block", "biggest block", "available by June" and "12 floor" find nothing; "15k nnn under $35" drops the lease type and ceiling; the bad date is lowercased and a test expects it.
- Engineering 9/10: verify exempts the known failure; `rateOnly` adds to the solver; AreaPanel key `${name}-${distanceMi}` collides for same-name stops at one distance (`AreaPanel.tsx:192`).

## Fixes asked
Never drop a name for suite/date (10 px name for 120–139 px blocks; verify every block ≥110 px at 1280×800, 1470×830, 1536×864, 1920×1080); risk badge to the bottom corner on 43 px rows; `safe` replaces rather than pushes, with a verify step; two-digit years; superlative queries; capitalized bad dates; "Not used" words in the bar.
