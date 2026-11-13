# Motion and Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Changes ease and views arrive across Stax (Part A), then a pair of buttons turns the building model a quarter at a time (Part B).

**Architecture:** CSS first. Keyframes and transitions live in each component's stylesheet on new motion tokens; three small pure helpers (`enterShift`, `markKeyframes`, `riseExpr`/`riseAt`) carry what CSS cannot do, each with a Node test. Part B adds one URL field, `turn`, and drives the model's existing `angle` tween from it.

**Tech Stack:** React 19, TypeScript, plain CSS on tokens, Web Animations API (`Element.animate`, `pseudoElement`), MapLibre paint properties, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-motion-design.md` (Part A); `docs/superpowers/specs/2026-11-13-turn-building-design.md` (Part B, written in Task B1).

## Global Constraints

- Numbers never animate: KPI values (`.sp-kpi__figure`, `.sp-kpi__delta`), the as-of cursor (`.sp-cursor`) and every figure change at once.
- No CSS animation or transition is longer than 450 ms, except the two existing loops (`sp-rec-pulse`, `sp-skel-shimmer`).
- Reduced motion: the global rule in `src/styles/base.css` turns CSS motion off; script-driven motion checks `usePrefersReducedMotion()` and jumps.
- Every entrance (keyframes named `sp-enter-*`) runs only on the live page: its selector is under `.sp-stage`, `.sp-kpis`, `.sp-inspector` or `.sp-sheet`, never in the print layout or the export stage.
- Host boundary: frames through `requestFrame`/`cancelFrame`, sizes through `sizeObserver` (`src/lib/host.ts`). `performance.now()` is already used in components and is allowed.
- SVG elements placed by a `transform` attribute are animated with the individual `translate`/`scale` properties, never CSS `transform`.
- Plain CSS, a stylesheet per component folder; UI text in American English, plain words.
- Each part is its own branch and PR (`feat/motion`, then `feat/turn-building` from `main` after Part A merges), merged with a merge commit once `npx tsc -b`, `npm test`, `npm run verify`, `npm run a11y`, `npm run leakcheck` and `npm run exportcheck` pass.

## Review Focus

1. The web fonts arrive after first paint and the stage remounts (`fontTick`): the entrance must continue, not restart. Pinned by `enterShift` tests (A1).
2. Export a PNG right after a lens change, or from a phone (off-screen stack): the image shows the final colors at full opacity. Pinned by the motion CSS test's scoping rule (A1) and `finishMotion` in `standaloneSvg` (A2).
3. Scrub the as-of date quickly in the timeline: colors follow without the cursor or the figures easing. Pinned by the CSS test's "no motion on figures and cursor" rule (A1).
4. Turn right from the last quarter (turn 3 → 0): the model turns 90°, not 270° back. Pinned by `nearestTurn` tests (B2).
5. Turn while the floor labels are shown: the leaders re-measure to the new anchors and are hidden mid-turn. Pinned by the `verify.mjs` turn step (B3).

---

## Part A: Motion (`feat/motion`)

### Task A1: Motion tokens, the entrance clock and the motion CSS test

**Files:**
- Modify: `src/styles/tokens.css:9`, `src/styles/base.css` (shared keyframes), `src/App.tsx:83-104,333` (Stage)
- Create: `src/lib/enterClock.ts`, `src/lib/enterClock.test.ts`, `src/styles/motion.test.ts`

**Interfaces:**
- Produces: tokens `--sp-ease-move: 240ms cubic-bezier(0.2, 0.8, 0.2, 1)`, `--sp-enter-ms: 280ms`, `--sp-enter-curve: cubic-bezier(0.2, 0.8, 0.2, 1)`; keyframes `sp-enter-rise` (from `opacity: 0; translate: 0 10px`), `sp-enter-drop` (from `opacity: 0; translate: 0 -18px`), `sp-enter-fade` (from `opacity: 0`), `sp-enter-wipe` (from `clip-path: inset(0 100% 0 0)` to `clip-path: inset(0 0 0 0)`), `sp-enter-settle` (from `opacity: 0; scale: 0.98`), `sp-enter-grow` (from `scale: 0 1`); the CSS variable `--sp-enter-shift` on `.sp-stage` (a negative `ms` value, `0ms` on a fresh view).
- Produces: `enterShift(prev: EnterClock | null, enter: string, epoch: string, now: number): EnterClock` with `interface EnterClock { enter: string; epoch: string; at: number; shift: number }`.

- [ ] **Step 1: Write the failing tests**

`src/lib/enterClock.test.ts`:
- `it('starts a fresh entrance on a view switch')`: `enterShift(null, 'stack:pp', 'e1', 100)` → `{ enter: 'stack:pp', epoch: 'e1', at: 100, shift: 0 }`; then `enterShift(that, 'timeline:pp', 'e1', 900).shift === 0` and `.at === 900`.
- `it('continues the entrance when the stage remounts for fonts')`: from `{ enter: 'stack:pp', epoch: 'e1', at: 100, shift: 0 }`, `enterShift(c, 'stack:pp', 'e2', 250)` → `shift === 150`, `epoch === 'e2'`, `at === 100`.
- `it('keeps the clock when nothing changed')`: same inputs return an equal object (`toEqual(c)`).

`src/styles/motion.test.ts` (reads every `.css` under `src/` with `readFileSync`, like `paletteChecks.ts`):
- `it('keeps every animation and transition at 450 ms or less, loops aside')`: every `ms`/`s` duration token inside `animation:`/`animation-duration:`/`transition:`/`transition-duration:` declarations (first time value of each comma part) is ≤ 450 ms, except in rules naming `sp-rec-pulse` or `sp-skel-shimmer`.
- `it('never animates a figure or the as-of cursor')`: no rule whose selector contains `.sp-kpi__figure`, `.sp-kpi__delta`, `.sp-kpi__value` or `.sp-cursor` declares a `transition` or `animation` other than `none`.
- `it('runs entrances only on the live page')`: every selector of a rule whose `animation` names `sp-enter-*` contains `.sp-stage`, `.sp-kpis`, `.sp-inspector` or `.sp-sheet`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/enterClock.test.ts src/styles/motion.test.ts`
Expected: enterClock FAILS (module missing); motion.test passes its first two rules or names today's offenders (fix those, they are real) and passes the third vacuously.

- [ ] **Step 3: Implement**

`enterShift` per the interface (pure). Tokens and keyframes as listed. `Stage` gets a prop `enter: string` (`${view}:${property.id}`), keeps an `EnterClock` on the instance, updates it in `render` with `performance.now()`, and renders `style={{ '--sp-enter-shift': `${-Math.round(clock.shift)}ms` }}` on the keyed `div`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/enterClock.test.ts src/styles/motion.test.ts && npx tsc -b`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit** — `feat: motion tokens, an entrance clock that survives the font remount, and a test that keeps motion in bounds`

### Task A2: Changes ease (suites, bars, slices, the model, the legend) and the export finishes motion

**Files:**
- Modify: `src/components/plan/plan.css`, `src/components/hero/hero.css`, `src/components/plan/legend` styles (wherever `.sp-legend__item` is styled), `src/lib/exportPng.ts`, `src/styles/print.css`
- Test: `src/lib/exportPng.test.ts`

**Interfaces:**
- Produces: `finishMotion(root: { getAnimations?: (o?: { subtree?: boolean }) => Array<{ finish(): void }> }): void` exported from `src/lib/exportPng.ts`, called first in `standaloneSvg`.

- [ ] **Step 1: Write the failing test** — `it('finishes running animations before the plan is copied, and skips a loop it cannot finish')`: a fake root whose `getAnimations({ subtree: true })` returns one animation with a `finish` spy and one whose `finish` throws; `finishMotion(fake)` calls the first and does not throw; `finishMotion({})` does not throw.
- [ ] **Step 2: Run** `npx vitest run src/lib/exportPng.test.ts` — FAIL (`finishMotion` not exported).
- [ ] **Step 3: Implement** `finishMotion` (try/catch per animation) and call it in `standaloneSvg`. CSS:
  - `.sp-seg` transitions `opacity var(--sp-ease-move)`; `.sp-seg__rect`, `.sp-seg__backing`, `.sp-seg__accent` add `fill var(--sp-ease-move), stroke var(--sp-ease-move)` to their transitions.
  - `.sp-seg.is-selected .sp-seg__ring` animates `sp-ring-in 200ms` (from `stroke-width: 0; stroke-opacity: 0`).
  - `.sp-stage .sp-seg__pattern, .sp-stage .sp-seg__overlay` fade in with `sp-enter-fade var(--sp-ease-move) backwards`.
  - `.sp-hero__face` transitions `fill var(--sp-ease-move)`; `.sp-hero__slice` transitions `opacity var(--sp-ease-move)`.
  - `.sp-stage .sp-legend__item` fades in on mount (`sp-enter-fade 200ms backwards`).
  - `print.css`: `@media print { *, *::before, *::after { transition: none !important; animation: none !important; } }`.
- [ ] **Step 4: Run** `npx vitest run src/lib/exportPng.test.ts src/styles/motion.test.ts` — PASS.
- [ ] **Step 5: Commit** — `feat: lens, date and filter changes crossfade; selection rings draw in; exports finish any motion first`

### Task A3: Marks that slide (the View switch pill, the lens underline)

**Files:**
- Create: `src/components/ui/slideMark.ts`, `src/components/ui/slideMark.test.ts`
- Modify: `src/components/ui/Segmented.tsx`, `src/components/ui/ui.css:46-55`, `src/styles/glass.css:161-163`, `src/styles/vice.css:158`, `src/styles/ascendix.css:230,232`, `src/components/kpis/KpiStrip.tsx`, `src/components/kpis/kpis.css:45-51`

**Interfaces:**
- Produces: `markKeyframes(from: { left: number; width: number }, to: { left: number; width: number }): Keyframe[] | null` (null when the boxes are equal or `to.width <= 0`), returning `[{ transform: 'translateX(<dx>px) scaleX(<s>)', transformOrigin: '0 50%' }, { transform: 'none', transformOrigin: '0 50%' }]` with `dx = from.left - to.left`, `s = from.width / to.width` (rounded to 3 places).
- Produces: `useSlideMark(container: RefObject<HTMLElement | null>, selector: string, activeKey: string | null, pseudoElement: '::before' | '::after'): void` in the same file: on a change of `activeKey`, reads `offsetLeft`/`offsetWidth` of the previous and the new active element (`selector` matches the active one; the previous is remembered), and runs `next.animate(markKeyframes(...), { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement })`; does nothing under reduced motion or without `animate`.

- [ ] **Step 1: Write the failing tests** — `markKeyframes({ left: 10, width: 50 }, { left: 70, width: 100 })` → first frame `transform: 'translateX(-60px) scaleX(0.5)'`; equal boxes → `null`; `to.width === 0` → `null`.
- [ ] **Step 2: Run** `npx vitest run src/components/ui/slideMark.test.ts` — FAIL.
- [ ] **Step 3: Implement.** The checked option's fill moves from the button to `::before` (absolute, `inset: 0`, `border-radius: inherit`, `z-index: -1`; the option gets `position: relative; z-index: 0`) in `ui.css` and in the three skin files (same declarations, selector `…[aria-checked='true']::before`). `Segmented` calls `useSlideMark(ref, '[aria-checked="true"]', value, '::before')`; `KpiStrip`'s lens group calls `useSlideMark(ref, '.sp-kpi.is-active', activeLens, '::after')`.
- [ ] **Step 4: Run** `npm test` — PASS (the Segmented and KpiStrip `renderToString` tests are unchanged).
- [ ] **Step 5: Commit** — `feat: the View switch pill and the Color by underline slide to the new choice`

### Task A4: Views arrive

**Files:**
- Modify: `src/components/stack/StackView.tsx:252-269` (`--n` on the svg, `--i` on each row, counted from the ground floor), `src/components/stack/stack.css`, `src/components/stack/PhoneStack.tsx:57` (`--i` on `.sp-pfloor`, from the top), `src/components/hero/BuildingHero.tsx:306-312` (`--i` = `f.level` on each floor, stage only), `src/components/building/building.css`, `src/components/timeline/timeline.css`, `src/components/floor/floor.css`, `src/components/kpis/kpis.css`, `src/components/inspector/inspector.css`
- Test: `src/components/stack/Block.test.tsx` or a new `src/components/stack/StackView.test.tsx`

**Interfaces:**
- Consumes: A1's keyframes, `--sp-enter-*` tokens and `--sp-enter-shift`.

The stagger, everywhere: `animation-delay: calc(var(--sp-enter-shift, 0ms) + var(--i, 0) * min(30ms, 180ms / var(--n, 1)))`, so the last item starts by 180 ms whatever the count.

- [ ] **Step 1: Write the failing test** — `it('numbers the rows from the ground floor for the entrance')`: `renderToString(<StackView …testModel… />)` contains `--n:<floors>` on the svg, and the top floor's row carries `--i:<floors - 1>` while the ground floor's carries `--i:0`.
- [ ] **Step 2: Run** it — FAIL.
- [ ] **Step 3: Implement** the variables and CSS:
  - Stack: `.sp-stage .sp-stack__row` runs `sp-enter-rise` (opacity and `translate`, never `transform`).
  - Phone: `.sp-stage .sp-pfloor` runs `sp-enter-rise`.
  - Building: `.sp-stage .sp-hero--stage .sp-hero__floor` runs `sp-enter-drop` with `--n: var(--sp-hero-floors)`; `.sp-stage .sp-bview__grid.is-alone .sp-flabels` and `.sp-bview__caption` run `sp-enter-fade` after the floors (delay `calc(var(--sp-enter-shift, 0ms) + 200ms)`).
  - Timeline: `.sp-stage .sp-tl-rows` runs `sp-enter-wipe 420ms` (`backwards`, so no clip is left at rest); the axis fades.
  - Floor: `.sp-stage .sp-floor .sp-plate__svg` runs `sp-enter-settle`; `.sp-stage .sp-floor .sp-flists` fades in after it.
  - KPIs (first load only; the strip never remounts): `.sp-kpis .sp-kpi` runs `sp-enter-rise` with `--i` from `:nth-child` (1–4 per group is enough).
  - Rollover chart: `:is(.sp-inspector, .sp-sheet) .sp-roll__mark` runs `sp-enter-grow` (`transform-box: fill-box; transform-origin: 0 50%`).
- [ ] **Step 4: Run** `npm test && npx tsc -b` — PASS. The motion CSS test keeps every new rule scoped and ≤ 450 ms.
- [ ] **Step 5: Commit** — `feat: views arrive: floors stack up, rows rise, bars unroll, the plate settles`

### Task A5: The building rises on the map

**Files:**
- Modify: `src/components/map/mapStyle.ts`, `src/components/map/MapView.tsx:255` (`threeD`)
- Test: `src/components/map/mapStyle.test.ts`

**Interfaces:**
- Produces: `riseExpr(prop: 'height' | 'base', k: number): unknown[]` → `['get', prop]` when `k >= 1`, else `['*', ['get', prop], k]`; `riseAt(t: number): number` → ease-out cubic of `t` clamped to [0, 1].

- [ ] **Step 1: Write the failing tests** — `riseExpr('height', 1)` equals `['get', 'height']`; `riseExpr('base', 0.5)` equals `['*', ['get', 'base'], 0.5]`; `riseAt(0) === 0`, `riseAt(1) === 1`, `riseAt(2) === 1`, `riseAt(0.5) === 0.875`.
- [ ] **Step 2: Run** `npx vitest run src/components/map/mapStyle.test.ts` — FAIL.
- [ ] **Step 3: Implement.** In `threeD`, when the map is flat (`map.getPitch() <= 5`) and motion is allowed, run a `requestFrame` loop for `duration` (600 ms) setting `fill-extrusion-height` and `fill-extrusion-base` on `LAYER_FLOORS` to `riseExpr(…, riseAt(t))`; it ends on `k = 1`, and an unmount or a second call cancels it and restores `k = 1`.
- [ ] **Step 4: Run** `npm test && npx tsc -b` — PASS.
- [ ] **Step 5: Commit** — `feat: the building rises from the ground as the map tilts into 3D`

### Task A6: Docs, the motion-on browser pass, the checks, the PR

**Files:**
- Modify: `docs/DESIGN.md` §3.5, `docs/PLAN.md` (a row for motion with `src/styles/motion.test.ts`, `src/lib/enterClock.test.ts`)

- [ ] **Step 1:** Rewrite §3.5 as the motion spec (tokens, what eases, what arrives, what never moves).
- [ ] **Step 2:** Build `dist-judge`, run the preview, and take frames with motion on from a scratch Playwright script outside the repo (`reducedMotion: 'no-preference'`): each view at 0, 120 and 600 ms after switching, a lens change mid-crossfade, the View switch mid-slide, the map mid-rise. Look at every frame; the 600 ms frame matches the reduced-motion screenshot.
- [ ] **Step 3:** Run `npx tsc -b && npm test && npm run verify && npm run a11y && npm run leakcheck && npm run exportcheck` — all pass.
- [ ] **Step 4:** Commit, push, open the PR, merge it once green.

---

## Part B: Turn the building (`feat/turn-building`, from `main` after Part A)

### Task B1: `turn` in the address

**Files:**
- Create: `docs/superpowers/specs/2026-11-13-turn-building-design.md` (the design as agreed in conversation)
- Modify: `src/state/planState.ts` (`PlanState.turn: number`, `DEFAULT_STATE.turn = 0`, parse, serialize), `README.md` URL table
- Test: `src/state/planState.test.ts`

- [ ] **Step 1: Write the failing tests** — `parseState('?turn=2', TODAY).turn === 2`; `'?turn=7'`, `'?turn=-1'`, `'?turn=x'` → `0`; `serializeState({ ...DEFAULT, turn: 3 }, TODAY)` contains `turn=3`; the default omits it.
- [ ] **Step 2: Run** `npx vitest run src/state/planState.test.ts` — FAIL.
- [ ] **Step 3: Implement** with the existing helpers (an integer 0–3, else 0); README row: `` | `turn` | `1`–`3` | Quarter turns of the building model in the Building view, from its usual corner view (0 when left out) | ``.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat: the building model's turn is in the address`

### Task B2: The turn buttons

**Files:**
- Create: `src/components/building/turn.ts`, `src/components/building/turn.test.ts`
- Modify: `src/components/building/BuildingView.tsx:35,356-366`, `src/components/building/building.css`, `src/components/ui/Icon.tsx` (`turn-left`, `turn-right`), `src/components/hero/BuildingHero.tsx` (`is-turning` on the root while `turning`), `src/components/hero/hero.css`, `src/components/building/FloorLabels.tsx` and `FloorLeaders.tsx` (a `turn` prop in the measuring effect's dependencies)
- Test: `src/components/building/BuildingView.test.tsx`

**Interfaces:**
- Produces: `ALONE_ANGLE = -34` moves to `turn.ts`; `turnAngle(turn: number): number` → `ALONE_ANGLE + 90 * turn` (sign chosen so that "Turn right" looks like the building turning right; check on screen); `nearestTurn(from: number, to: number): number` → `to + 360k` closest to `from`.

- [ ] **Step 1: Write the failing tests** — `nearestTurn(236, -34) === 326`; `nearestTurn(-34, 236) === -124`; `nearestTurn(326, 0) === 360`; `turnAngle(0) === -34`. BuildingView: alone, `renderToString` has buttons named "Turn the building left" and "Turn the building right"; with a floor open (`floor=F8`), it has neither.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** BuildingView keeps the unwrapped target in state (`[aim, setAim]`, updated during render with `nearestTurn` when its residue differs from the wanted angle: `docked ? 0 : turnAngle(state.turn)`), passes `angle={aim}`. The two `Button variant="ghost" size="sm" iconOnly` sit on the caption line while the model stands alone; each patches `turn: (state.turn ± 1 + 4) % 4`. `.sp-hero.is-turning .sp-fleaders { opacity: 0; transition: none; }`. If the turning drawing reaches over the labels, hold its centre instead of its left edge while alone (decide on screen).
- [ ] **Step 4: Run** `npm test && npx tsc -b` — PASS.
- [ ] **Step 5: Commit** — `feat: turn the building model a quarter at a time`

### Task B3: Browser check, docs, the PR

- [ ] **Step 1:** `scripts/verify.mjs`: open `?view=building`, press "Turn the building right": the address has `turn=1`, the leaders count equals the floors, no console errors; press "Turn the building left": `turn` is gone. Add `['33b-building-turned', '?view=building&turn=1']` to `STATES` in `scripts/shots.mjs`.
- [ ] **Step 2:** `docs/DESIGN.md` Building view paragraph and `docs/PLAN.md` FR row name the turn and its check.
- [ ] **Step 3:** Frames with motion on of a turn (scratch script). Run `npx tsc -b && npm test && npm run verify && npm run a11y && npm run leakcheck`.
- [ ] **Step 4:** Commit, push, open the PR, merge it once green.
