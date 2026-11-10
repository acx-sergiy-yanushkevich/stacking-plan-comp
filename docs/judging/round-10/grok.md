# Round 10 · Judge: Grok 4.7 · standalone app, glass skin; floor focus, phone cards, building model
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 3) · UX 18.5/20 (X1 5, X2 3.5, X3 3.5, X4 3, X5 3.5) · Engineering 8/10

## Top UI fixes
1. Hovering the model writes the floor's keys into the filter highlight (BuildingHero.tsx:156-158, StackView.tsx:56), so 26 of 28 suites go `.is-dim` and lose their text (plan.css:16) → hover should only set the hot floor (row wash + caption).
2. "No activity" badges crowd 72 px rows (Kinetic, NAAH, WBH, Conner) → show the last-touch pill only when a touch exists.
3. Stack width measured on the padded box (useWidth.ts:10) while the svg is scaled to the content box (stack.css:6-7): scale 0.977, so the 124 minimum paints at 121.1 px.

## Top UX fixes
1. Safe rent lens: `toneFor` returns `confidential` before the prospect-safe mute (lenses.ts:167-168) → legend "Confidential 10,400 · 4.2%" and a different grey single out Halcyon.
2. (= UI fix 1) hover must not erase other suites' labels.
3. Last-touch line opens the activity; listing published/quiet as a fact on every availability.

## Bugs
lenses.ts:167 safe confidential tone; hover dims and unlabels the rest of the plan; useWidth padding mismatch.

## Round-10 council average (three judges)
UI (18 + 18 + 18)/3 = 18.0 · UX (19.5 + 19 + 18.5)/3 = 19.0 (round 9: 17.7 / 19.0)
