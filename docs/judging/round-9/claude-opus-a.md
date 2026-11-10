# Round 9 · Judge: Claude Opus 5.5 (A) · standalone app, glass skin
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 19.5/20 (X1 5, X2 3.5, X3 4, X4 3, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Leased/neutral tiles at 52% white pick up the backdrop hue → fill ≈ 0.82 (light) / solid underlay (dark); add `prefers-reduced-transparency` / `prefers-contrast: more` fallback with solid cards and no blur.
2. Narrow-suite names: below ~150 px use an 11 px name and "Name / 2,400 SF · Apr '28" on two or three lines, never four.
3. Timeline sublease label: dots run through the letters (TimelineRows.tsx:384) → start dots after the label or back the label; same for the plate lobby text on hatch.
4. Phone: sticky floor column + clamped spill labels on the timeline; collapsed legend; KPI tiles sized with a scroll hint.
5. document.title = `${property.name} · Stacking plan`; print worklist "Floor · Suite" column nowrap.

## Top UX fixes
1. Inquiry match: only the active inquiry's fit chip; suppress generic "1 inquiry fits" elsewhere (segmentText.ts:159).
2. Escape in the grid also closes an open floor summary (StackView.tsx:129-133).
3. Rollover chart as a single tab stop with arrow keys.
4. Safe timeline: holdover/MTM bars carry "Term not disclosed" like the stack.
5. Floor-plate aria must start with the visible text (2 axe label-content-name-mismatch hits, FloorPlate.tsx:309).

## Bugs
StackView Escape vs floor summary; segmentText:159 inquiry chip; TimelineRows:384 dots under label; safe.ts:9 tab title; glass.css no reduced-transparency fallback; PrintLayout.tsx:183 column wrap; FloorPlate.tsx:309 aria mismatch; Building panel opens with a 5-line orange over-allocation paragraph; orphan wraps ("35,300 / SF", "2 / leases", "0 / sublease"); phone sheet top edge is a hard blue line; full-page phone captures show a flat band (capture artefact).

## Two-judge average so far
UI 17.5 · UX 19.25 (Grok pending)
