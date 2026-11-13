# Motion: views that arrive, changes that ease

Date: 2026-11-13. Status: draft, for approval.

## Intent

Make Stax look more appealing in motion: for the company-wide Best UI vote, the 1-minute demo video and live demos. Today a few things move (the building glide when a floor opens, the inspector swap, popovers, toasts, the map's Present orbit), but most changes snap: a new lens, filter or as-of date recolors every suite at once, and a view switch is a cut.

## Goals (option C: both kinds of motion, kept short)

- **Changes ease.** Wherever the plan recolors or dims, it crossfades instead of snapping, in every view.
- **Views arrive.** Switching to a view (or to another building) plays a short entrance that says what the view is: floors stack up, bars unroll along time, the plate settles.
- It reads as one motion language: the same few durations and one easing curve, from tokens.

## Non-goals

- Animated numbers. `docs/DESIGN.md` §3.5 holds: KPI values, deltas, the as-of cursor and every figure update at once and never count or tween.
- New interactions, layouts or states. The resting state of every screen is unchanged; motion only gets there.
- Motion in print, the PDF, the PNG export or the CSV.

## Anti-goals (a failure even if it works)

- Slower to use. No entrance runs past about 450 ms, nothing waits on an animation, and a click or key press mid-animation works.
- Motion that hides data in a demo, flashes, or loops (the existing record pulse and loading shimmer stay the only loops).
- An entrance that stutters or replays without a view switch.
- Any change under reduced motion: everything stays exactly as it is today.

## Constraints

- Reduced motion turns all of it off. CSS is already covered by the global rule in `src/styles/base.css`; anything driven from script checks `usePrefersReducedMotion`.
- The judge screenshots and every browser check run with reduced motion on, so they stay deterministic and unchanged. Motion is checked separately, with motion on.
- Host boundary: timing and frames go through `src/lib/host.ts` (`requestFrame`, `sizeObserver`).
- Plain CSS on tokens, a stylesheet per component folder.
- SVG rows are placed with the `transform` attribute; a CSS `transform` animation would override it. Entrances on SVG use opacity and the individual `translate`/`scale` properties, which compose with it.
- The stage remounts when web fonts arrive (`fontTick`, `App.tsx`). An entrance must not restart then.

## Approaches

1. **CSS first (chosen).** Keyframes and transitions in the existing stylesheets on shared tokens, plus two small hooks for what CSS cannot do (the sliding switch thumb, the map building rising). No dependency, fits the plain-CSS convention, reduced motion already handled.
2. View Transitions API for view switches, CSS for the rest. Rejected: it needs `document` outside the host boundary, React 19 has no stable support, and Salesforce's sandbox may block it.
3. A motion library (Motion). Rejected: about 30 KB, animation moves into components against the plain-CSS rule, and every animated element becomes a library component.

## The design

**Tokens** (`tokens.css`): `--sp-ease-move` (about 240 ms, an ease-out curve) for crossfades and slides; `--sp-enter` duration and curve for entrances. Existing `--sp-ease` and `--sp-ease-slow` stay.

**Changes ease (everywhere `.sp-seg` draws: Stack suites, Timeline bars, Floor plate slices):**
- Fill and edge color crossfade on lens, as-of date and palette changes.
- Dimming and undimming (filters, the Find results, a lit KPI) ease, as one opacity on the suite.
- The selection ring draws in: it grows from the suite's edge and fades up.
- Patterns cannot blend between each other; a pattern layer fades in when it appears.

**Changes ease (elsewhere):**
- The building model's faces crossfade with the lens and date; its dimmed slices ease.
- The legend's swatches crossfade, and new legend entries fade in, when the lens changes.
- The View and Color lens switches get a thumb that slides to the chosen option.
- The rollover chart's bars grow from the baseline when the Building panel opens.

**Views arrive (on a view or building switch):**
- Building: floors rise into place from the ground, the lowest first; the floor labels fade in after.
- Stack: rows rise and fade in from the ground floor up.
- Timeline: bars unroll left to right; the axis and floor names fade in.
- Floor: the plate settles (a slight scale and fade); the lists fade in.
- Map: when the map tilts into 3D, the building rises from the ground with the camera.
- First load only: the KPI cards rise in one after another (the strip never remounts after that).
- Staggers shrink with the floor count, so a 40-floor building arrives as fast as a 6-floor one.
- Phone: the suite list's floors rise in the same way (builder's call).
- Opening a floor inside the Building view is not a view switch: the existing glide runs and no entrance replays (builder's call).

**Font-load remount:** the stage is told when its view last switched, and a remount within the entrance continues it (a negative delay) instead of restarting it; a remount after it shows the view at rest.

**Checks:**
- A unit test reads the stylesheets: every animation and transition is 450 ms or shorter (the existing loops excepted), and the KPI values and the as-of cursor have none.
- A scratch Playwright pass with motion on: frames taken mid-entrance for each view, and the rested page compared with today's.
- `npx tsc -b`, `npm test`, `npm run verify`, `npm run a11y`, `npm run leakcheck` all pass.

**Docs:** `docs/DESIGN.md` §3.5 rewritten as the motion spec above; `docs/PLAN.md` gets a row for it with its test.

## Left to the builder

The exact curves, stagger steps and whether a palette or theme switch crossfades the page (decide from how it looks). The map rise's duration, matched to the camera's.
