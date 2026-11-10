# Round 10 · Judge: Claude Opus 5.5 (A) · standalone app, glass skin; floor focus, phone cards, building model
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 3) · UX 19.5/20 (X1 5, X2 3.5, X3 4, X4 3, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Focused-floor extras repeat a drawn fact (status: "$30–$32/SF/yr FSG" then "Asking $30–$32/SF/yr FSG"; expiry: "3 yr 10 mo left · Sep '30" then "Exp Sep 2030 · 3 yr 10 mo"; sublease "Sublease thru Sep 2030") → typed extras (rent only when the meta is not already a rate; deal line only when a deal exists) (StackView.tsx:317-321, Block.tsx:209-213, segmentText.ts:97/:155).
2. Tablet header 761–1180 px: facts clipped ("· 6", "1 record sta"); at 800 px the h1 wraps one word per line under the As-of button → header wraps, actions on their own row; drop `overflow: hidden` on facts (shell.css:10, :18).
3. Focused tiles 120–199 px drop "Ste NNN" while adding extras → tier − 1 in a focused row, or always place text.sub first.
4. Building model hover/focus stroke 0.9 px is nearly invisible → 2 px + brand tint; floor-number tag beside the hot slab.
5. Empty focused rows (single suite, safe mode) double in height for nothing → FOCUS_H only when a block gains a line.

## Top UX fixes
1. Second click on the model lands on the floor above: lifted floors' walls still catch clicks (hero.css:22 passes only top faces) → raise LIFT or pointer-events none on every face of `.is-above`.
2. Phone finder sheet covers the stack → collapse to peek height after a change, summary in the peek.
3. Tablet (761–1099 px): inspector hidden, so no building model → right drawer.
4. Single-suite / safe focus: gutter line and panel without the height change.
5. Tests for extras selection, PhoneStack, hero, wrapWordsVar.

## Bugs
Duplicate extras; tier by width only in focused rows; header clipping 761–1180 px and overlap at 800 px; hero.css:22 second-click target; focused floor at share = 1 contradicts the footer's width rule (disclosed in the legend note); inspector hidden 761–1099 px; no tests for the round-10 code; light expiry ramp first three steps close.
