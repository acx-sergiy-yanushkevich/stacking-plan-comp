# Claude Opus A, round 29

**UI 18/20 · UX 19/20 · Engineering 9/10 · total 92**

Checks run: 1,017 tests, verify, leakcheck (0), a11y (0 serious), pdfcheck, exportcheck, and a stricter name probe over 4 buildings × 10 window sizes × 4 lenses × owner/safe.

- U2 4.5/5: Rent's two lowest bands (`ascendix.css:77-78`) are nearly the same slate in dark.
- U3 3/4: names still lost beyond Preston Park: Legacy West Floor 1 "Legacy Coffee Roasters" at every desktop size up to 1920×1080; Prairie National Bank and the Floor 1 "No lease or listing" block at ≤1366 px; Cedar Springs' Maple Avenue Advisors and Frontier Private Bank at 1180 px; Bowline Consulting at 1280×720 and 1280×800.
- U4 2.5/3: micro and tiny lines are inset 2 and 4 px against 8 px (`Block.tsx:405`); the bad-date sentence starts lowercase (`FilterBar.tsx:36`).
- X2 3.5/4: Back leaves the app (`host.ts:187`); "largest block" / "biggest block" and "12 floor" find nothing.
- X3 3.5/4: "by 06/01/2027" and "by 3/15/2027" are silently ignored (M/D/YYYY not in `query.ts:30-31`); "15k nnn under $35" drops the lease type and ceiling without saying so.
- Engineering 9/10: the verify name check covers only Preston Park and compares 8 characters (`verify.mjs:136-147`); the solver is another special case; a personal name still sits in source comments.

## Fixes asked
Never give up a name for the suite or date (`Block.tsx:256`, final pick); verify across all buildings and sizes with whole names; risk badge to the bottom corner on a short row; one left edge for a block's lines; separate the Rent bands; push history; read M/D/YYYY and name what was not read; answer "largest block"; capitalize the bad date; accept "12 floor".
