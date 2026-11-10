# Round 10 · Judge: Claude Opus 5.5 (B) · standalone app, glass skin; floor focus, phone cards, building model
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 3) · UX 19/20 (X1 5, X2 3.5, X3 4, X4 2.5, X5 4) · Engineering 8/10

## Top UI fixes
1. Mid-width header 761–1180 px: wrap, actions on their own row; whole facts wrap instead of clipping; KPI value + unit nowrap (shell.css:11/19/22/28).
2. Focused-floor extras: dedupe by fact kind (rate / term / deal), and wrap a fact to two lines before dropping it (Block.tsx:212, StackView.tsx:318-320).
3. Building model is colour-only: add dots / hatch overlays for sublease, committed, lobby; dashed stroke for unaccounted; floor-number ticks.
4. Phone legend swatches plain while row swatches are patterned.
5. Focused single-suite floors: height by the lines actually added, not a fixed 132 px; caption facts nowrap (orphan "available").

## Top UX fixes
1. Phone floor-card header: aria-label does not start with the visible text → 12 axe label-content-name-mismatch nodes (PhoneStack.tsx:57).
2. Rows jump under the pointer when focus moves between floors (~62 px) → compensate scroll so the clicked suite stays put.
3. Keep the model (compact) while a suite is selected.
4. Tests: min width, focus layout, extras never repeat, PhoneStack rows / safe / names.
5. Touch: first tap focuses, second opens.

## Bugs
Block.tsx:212 duplicate rate + extras dropped instead of wrapped; PhoneStack.tsx:57 aria; shell.css header clipping/overlap at 761–1180 px; row jump on focus change; model flat colour; Floor 1 suites 106 px at 800 px viewport; phone legend swatches; orphan wraps (model caption, plate "1 yr 7 / mo", KPI "33,200 / SF" at 900 px); phone badge colours are hard-coded hex.

## Two-judge average so far
UI 18.0 · UX 19.25 (Grok pending)
