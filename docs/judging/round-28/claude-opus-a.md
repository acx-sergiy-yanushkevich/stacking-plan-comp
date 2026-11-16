# Claude Opus A, round 28

**UI 18.5/20 · UX 18.5/20 · Engineering 9/10 · total 92**

Note: `node_modules` disappeared mid-review; `a11y`, `verify` and its own Playwright scripts could not run afterwards. Unit tests (1,010) and `leakcheck` (0 leaks) ran clean first.

## Scores
- U1 5/5, U2 4.5/5 (Rent bands told apart by color alone once the rent line is dropped; the two darkest bands hard to tell apart in dark, `ascendix.css:77-78`), U3 3/4 (Preston Park Café shows no name at 1470×830 and 1366×768 in every lens while keeping its deal pill; Rent lens drops the rent first; "Asking" prefix inconsistent), U4 3/3, U5 3/3.
- X1 5/5, X2 3.5/4 ("whats the biggest block" finds nothing), X3 3/4 (`asOf=2027-02-30` accepted; "12k by February 15, 2028" becomes Feb 28, 2027; name-based transit dedup), X4 3/3, X5 4/4.
- Engineering 9/10: round 27's agreed findings were not fixed; NFR-12 needs a browser check.

## Top UI fixes
1. Never drop a tenant name to keep the deal pill (`Block.tsx:300-303`); add a `verify` check at 1280×720, 1366×768, 1470×830.
2. Keep the lens fact before the suite number in Rent and Pipeline (`Block.tsx:161-200`).
3. One asking form ("Asking $31–$33/SF/yr FSG") on every availability block.

## Top UX fixes
1. Validate `asOf` as a real calendar day (`planState.ts:119-121`).
2. Read a day after a month in the search box (`query.ts:31`); an impossible day sets `badBy`.
3. Answer "largest/biggest block" and "vacancy/what's available" in the search box.
4. Dedupe transit stops by OSM id or coordinates (`OverpassSource.ts:50-52`).

## Bugs
- `Block.tsx:281-303` (café name dropped), `Block.tsx:161-200` (rent dropped in Rent lens).
- `planState.ts:74,119-121,308` (`asOf=2027-02-30`); `query.ts:31,88` (silent date rewrite); `OverpassSource.ts:50-52` (transit dedup). All carried over from round 27.
- `WorklistPanel.tsx:86` ("Rent hidden" instead of "Not on record"); `map.css:199-200` (lit pin over building label). Carried over from round 27.
