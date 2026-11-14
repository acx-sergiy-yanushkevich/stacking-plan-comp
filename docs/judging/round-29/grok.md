# Grok, round 29

**UI 19.5/20 · UX 19/20 · Engineering 9.5/10 · total 96**

Fixed and confirmed: names survive at all three sizes in every lens, owner and safe; four numbered bus stops stay four pins on Bluebonnet live; date fixes; "Not on record"; Map strip read-only.

- U3 3.5/4: at 1366×768 in Rent, First Plano Bank (133×50), Ste 850 (150×50), Ste 860 (138×50) and the café (136×50) paint the suite and drop the rate. Live rows are 50 px; the unit test draws 43 px, which the fitter never emits (ROW_H_MIN 44).
- X2 3.5/4: Back does not restore the previous view; every change is `replaceState` (`src/lib/host.ts:187`) while `usePlanState.ts:8-9` says Back restores the plan.
- X4 2.5/3: focusable details are named from their `title`.
- The stack still scrolls 133 px at 1470×830, the specified trade for keeping names.

## Fixes asked
1. Paint the rate and drop the suite on 50 px rows; test the real 50 px case.
2. Push history for view/building/floor/mode/ring/select changes; keep replace for typing and normalizing.
3. `aria-label` on the two lighting details ("Available, 33,200 SF", "Largest block, 9,300 SF").
