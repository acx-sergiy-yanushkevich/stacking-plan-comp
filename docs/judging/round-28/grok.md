# Grok, round 28

**UI 19/20 · UX 19/20 · Engineering 9.5/10 · total 95**

## Scores
- U1 4.5/5 (the stack does not fit a 1470×830 laptop: page stays 963 px, Floor 1 below the fold; the map's 5-mile figure clips), U2 5/5, U3 3.5/5 (short rows drop facts: at 1440×900 the café name, "Ste 110" and the asking rent go), U4 3/3, U5 3/3.
- X1 5/5, X2 3.5/4 (floor glide 760 ms, plate waits 420 ms), X3 4/4, X4 2.5/3 (detail figures are `tabIndex=0` divs with no role), X5 4/4.
- Engineering 9.5/10: the motion test caps CSS animation at 450 ms but misses the 760 ms floor glide (`BuildingView.tsx`) and the 600 ms map camera (`MapView.tsx`).

## Top UI fixes
1. Make a 12-floor stack fit a laptop (`fitRows.ts` ROW_H_MIN 44, `StackView.tsx` FIT_FOOT 48).
2. Keep the narrow suite's name and rate on short rows; step the line down to 11/10 px before dropping it.

## Top UX fixes
1. Finish the floor glide inside the motion cap (DOCK_MS 760; plate delay 420 ms + 320 ms fade); extend `motion.test.ts` to WAAPI durations.
2. Name the focusable detail figures as controls (role, accessible description that focus lights the suites).

## Bugs
- `src/components/stack/fitRows.ts:5`, `src/components/stack/StackView.tsx:40`: stack does not fit 900/830 px windows.
- `src/components/stack/Block.tsx:175`: short rows drop facts on narrow suites.
- `src/components/kpis/KpiStrip.tsx:286`: detail figures are tab stops without a role.
- `src/components/building/BuildingView.tsx:35`, `building.css:125`, `src/styles/motion.test.ts:83`: floor glide and plate delay exceed the cap and the test does not see them.

**Wes:** the prospect screen and PDF are the thing to brag about; fix Floor 1 before a laptop demo.
**Todd:** the motion test claims nothing runs past 450 ms, yet opening a floor is a 760 ms animation it never reads.
