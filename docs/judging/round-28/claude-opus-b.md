# Claude Opus B, round 28

**UI 18/20 · UX 19/20 · Engineering 9.5/10 · total 93**

Note: `node_modules` disappeared mid-review (about 10:03); `a11y` and `verify` could not run afterwards. Findings are from checks made before that.

## Scores
- U1 5/5, U2 4.5/5 (Rent's two lowest bands "Gross < $28" and "$28–30.99" are almost the same slate), U3 3/4 (fitted rows drop the rent or the tenant name at 1440×1000 and 1470×830; contradicts NFR-12), U4 2.5/3 (Map strip keeps "COLOR BY" circles that do nothing; turned-model leaders end at the far back corner), U5 3/3.
- X1 5/5, X2 3.5/4, X3 4/4, X4 2.5/3 (Details cards lack semantics), X5 4/4.
- Engineering 9.5/10: `Block.tsx` text fitting is a 480-line cascade; NFR-12 tests check chosen widths, not the requirement.

## Top UI fixes
1. Keep the lens fact on fitted two-line rows (`Block.tsx:179-188`): try SF + rate before "Ste · SF".
2. Never drop a tenant name on a fitted row (`Block.tsx:236-239`).
3. Map: render the Color by strip without its radio circles, or make a click switch to Building in that lens (`KpiStrip.tsx:290-294`).
4. Separate the two lowest Rent bands (`src/domain/lenses.ts:288`, tokens).
5. Anchor turned-model leaders to the visible front/side corner (`FloorLeaders.tsx`).

## Top UX fixes
1. Fix the inert Map strip.
2. Give the focusable Details cards semantics (`KpiStrip.tsx:286`).
3. Make NFR-12 a `verify` check at 1470×830 and 1440×1000, all lenses and prospect-safe.
4. Check every "Available now" block shows its asking rent at 1470×830 in prospect-safe.
5. Show the Find space "Needed by" date in US form regardless of OS region.

## Bugs
- `Block.tsx:179-188`, `Block.tsx:236-239`, `KpiStrip.tsx:290-294`, `KpiStrip.tsx:286`, `FloorLeaders.tsx` (as above).
