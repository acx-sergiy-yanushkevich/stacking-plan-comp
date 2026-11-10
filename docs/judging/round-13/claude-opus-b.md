# Round 13 · Judge: Claude Opus 5.5 (B) · Building view (alone and docked), prospect-safe boundary, all earlier views; live build driven with Playwright at 390–1920 px
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 3) · UX 18.5/20 (X1 5, X2 4, X3 3, X4 2.5, X5 4) · Engineering 8.5/10

```
JUDGE: Claude Opus 5.5 (B)
ROUND: round-13
```

## Method

I read BRIEF, DESIGN, COMPETITORS §4–7 and all 44 round-13 shots and the three PDFs. Then I drove http://localhost:4180/ with Playwright (Chrome) using real mouse moves, clicks and key presses. The scripts are in /tmp/r13-judges/b/. I checked:

- **Dock motion.** I sampled the stage's computed transform every 50 ms and listed `document.getAnimations()`.
- **Hover on the model.** I hit-tested each of the 12 floor groups with `elementFromPoint` and moved the mouse onto each one, alone and docked.
- **Keyboard.** I tabbed through the Building view, used the picker arrows, Whole building, Full floor plan, KPI activation, the Stack grid, the Timeline cursor and the As-of popover.
- **Widths and motion.** I opened the view at 390, 768, 820, 1024, 1100, 1280, 1440 and 1920 px, and again under reduced motion.
- **Prospect-safe.** I loaded every view with safe on, every lens, and the switch turned on with a toast and a search in progress. I also moved the as-of date forward with safe on.

I also ran the repo's own read-only checks: `vitest` passed 413/413 tests in 38 files, `leakcheck.mjs` found 0 leaks in 81 checks, and `a11y.mjs` found 0 serious axe violations. I read docs/judging/round-12/ only after scoring.

## What I verified live (credit)

- **Alone.** The six KPIs sit in the left column as rows, the three "Most space" quick starts sit below them, and the turned model takes the rest.
  - The caption line is fixed at 20 px. Hovering all 12 floors changed only its words: the stage top stayed at 364 and the scroll height stayed at 1003.
  - Each floor's tag on the model is drawn at 13 px.
  - Real-mouse clicks on each quick start opened the floor they name at 1024, 1280 and 1440 px, and the buttons moved 0 px under the pointer. This was round-12's main bug, and it is fixed.
- **Dock.**
  - The stage FLIP is a 760 ms WAAPI animation, and the KPI strip, toolbar and main slot run 300 ms animations. The floor column slides in over 520 ms after a 140 ms delay.
  - Under `reducedMotion: 'reduce'` there are no animations, opening or closing.
  - While docked, hovering every floor of the model and every picker row never changed the pane (it stayed on Floor 8). It only lit the floor.
- **Focus.**
  - After "Whole building" (by keyboard), focus is on the Floor 8 picker row. Enter reopens it and ArrowUp moves to Floor 9.
  - After "Full floor plan", focus is on the `H2 Floor 9` of the Floor view.
  - Esc in the As-of popover returns focus to its button.
- **Floor numbers.** The docked model's numbers are 12 px at every width I tried. At 768–820 px only 2 or 3 of 12 are drawn (the rest collide), but the 40 px picker beside it carries all 12.
- **Tablet.** At 768–1099 px the docked model sits beside the plate, with no horizontal overflow at any width.
- **Floor facts by lens.**
  - Status: "3 · 5,500 SF available · holdover".
  - Expiration: "12 · Expires Jun '28".
  - Deals: "3 · 3 live deals · LOI".
  - Rent: "5 · $30–$31/SF/yr FSG · $26.50/SF/yr MG". Floor 11 shows only Anadarko's $31, because Halcyon is confidential.
- **Log call.** It goes to F2 "Bowline Consulting (month-to-month)" and F3 "Argosy Partners (holdover)". On F5 it goes to BeachBody (Apr '27), ahead of NAAH (Oct '27).
- **Map.** The map floor list reads "65.4% leased 7,400 SF available".
- **Narrow plate slices.** They get numbered markers at 768–1024 px.
- **Numbers.** I re-added them by hand and they are exact:
  - Leasable 245,400. Leased 211,200 / 245,400 = 86.06 %. Occupied 196,700 / 245,400 = 80.15 %.
  - "<12 mo" 35,300 = 2,400 + 21,400 + 5,000 + 6,500.
  - "1–2 yr" 21,600 = 9,300 + 2,400 + 9,900.
  - "3–5 yr" 84,900 = 52,000 + 12,500 + 7,000 + 13,400.
  - The expiration legend sums to 245,900, which is the 500 SF over-allocation the legend's note declares.
- **Prospect-safe transitions.** With the Log-call toast up and "argosy" typed, turning the switch on cleared both at once. The URL lost `q` and no name remained in the DOM, titles, aria-labels or live regions.
  - The "Expiring 12 mo" and "Pipeline" KPIs stop being buttons.
  - `?safe=1&q=cirrus` loads with an empty search box and drops `q`.
- **Phone (390 px).** The stack, block sheet, timeline and map are readable, with no horizontal overflow. The Building tab is not offered on phone, which falls back to the Stack.

## UI SCORE

**U1 Visual hierarchy & layout: 4.5/5**

The alone layout is clear: the KPI column, then the quick starts, then a large model whose ladder picker lines up with its floors.

−0.5: The floor plate is drawn at a fixed 640 × 213 px whenever a floor is opened by interaction. That covers a click on the model, the picker, a quick start or a KPI, which is the central round-13 path.
- At 1440 × 1000 the plate column is 871 px wide, but the SVG stays 640 × 213. On a fresh `?floor=F8` load the same column gets 870 × 327.
- The plate then floats in dead space, and it never recovers: after Whole building and a reopen, or after a resize, it is still 640 × 213.
- Cause: `usePlateSize` runs its `useLayoutEffect` with `[]` deps (usePlateSize.ts:44–53). It runs when BuildingView mounts, when the plate's `ref` (BuildingView.tsx:259) is not yet in the DOM, so it returns early and never measures or observes. The width stays at the 640 fallback, and BuildingView.tsx:134 then applies the 3:1 tablet height.
- The round's shots 34, 38 and 40 are fresh URL loads, so they do not show this.

**U2 Color & data encoding: 4.5/5**

The legends carry SF and share for every state, and the patterns are consistent across stack, model and plate (dots for sublease, hatch for committed, dashed for vacant). The night palette steps hue and lightness. Daytime "Leased" on the model now matches the legend.

−0.5: In the daytime expiration lens, Holdover/MTM and "2–3 yr" are nearly the same pink: `--tone-risk-fill #f8d9e0` (tokens.css:36) against `--tone-exp-3-fill #ecbfd3` (vice.css:118).
- On the model, holdover carries no pattern, so Floors 2–3 (Bowline MTM, Argosy holdover beside S&P 2–3 yr) read as one pink band. I confirmed this in a live crop of `?view=building&theme=light&lens=expiry`.
- Only the floor tag tells them apart. The fix that made the daytime ramp step in hue created this collision.

**U3 Typography & density: 3.5/5**

The type is tabular throughout. KPI values are 22 px. Plate text is 12–13 px at every width (I measured 768–1440 px). Model tags are 13 px alone and 12 px docked. Names wrap instead of truncating, and narrow slices get numbered markers.

−0.5: Because of the 640 px plate bug, the click path drops what matters from Floor 8 at 1440 px.
- Ste 850 loses its asking rent.
- Ste 860 shows only "Available now · Ste 860", with no SF and no rent.
- A fresh load of the same view shows "Ste 860 · 3,200 SF · $31–$33/SF/yr FSG".

**U4 Polish & platform fit: 2.5/3**

The glass skin is coherent in light and dark. Selected, dimmed, hover and focus states are clear. Ghosted upper floors on the docked model are a nice touch, and reduced motion is honoured.

−0.5: During the 760 ms dock, the still-large model's floor labels draw over the incoming floor column.
- In a frame captured 250 ms after the click on Floor 8 at 1440 × 1000, "7" collides with "Schematic: suite positions…" and "1" with "+ New deal on Floor 8".
- After the dock, the plate does not match its column (U1). So what a click shows is less polished than what the shots show.

**U5 Mobile & print visual quality: 3/3**

- At 390 px the stack cards, block sheet, timeline rollover tiles and map are readable, with no horizontal scroll.
- The PDFs are presentation-grade: KPIs, legend with SF, plan, rent roll with labelled rate and type, rollover, renewal worklist, rent by lease type and coming supply.
- At tablet widths the model sits beside the plate as specified.

**UI TOTAL: 18/20**

## UX SCORE

**X1 Persona job coverage: 5/5**

I did all ten jobs live:
- occupancy by floor
- expirations measured from as-of
- data issues, the 500 SF over-allocation and the lease without units
- the finder for 12,000 SF, with inquiry match
- block identity with record actions
- the owner PDF, prospect-safe PDF and CSV
- direct vs sublease vs later vs committed
- time travel with KPI deltas
- data gaps
- the pipeline by stage

Each is one or two clicks from the Building view.

**X2 Interaction & IA: 4/4**

- Hover only lights, and a click opens. I verified that the pinned floor never changes under the pointer.
- The "First floor that matches the filter" note explains a floor opened by a filter.
- The quick starts are stable under the mouse.
- The KPI column has the same clicks as the strip.
- The filter bar has a Clear button, and the inspector modes are consistent.

**X3 Trust & domain correctness: 3/4**

The numbers are exact (see above). Holdover and MTM have their own state, sublease keeps its own end, committed is distinct from vacant, and confidential rents are withheld everywhere, including the rent-lens floor fact. Turning prospect-safe on clears everything already on screen.

−1: Prospect-safe plus time travel shows when leases end and advertises a quiet listing. The As-of control stays live in safe mode. At `?view=stack&safe=1&asOf=2027-04-15`:
- Floor 1 Ste 100 reads "Vacated Feb '27", which is the café's lease end month (segmentText.ts:130; `projected` is not in the term-withheld set).
- Floor 6 Ste 600 flips from "Leased" to "Available now · 21,400 SF · $32–$34/SF/yr FSG". The KPI changes to "Largest block 21,400 SF Floor 6".
- That availability is A04, `published: false` (property.ts:167). That is a quiet listing, which the app's own rule says a prospect must never see (safe.ts:116–119; leakcheck builds "quiet badges" for exactly this).
- Scrubbing month by month therefore dates every lease end in the building. That defeats the round-13 claim that "no lease in place shows when it ends… an at-risk tenant cannot be told apart".
- Cause: `publishedFloors` (safe.ts:130–136) only strips `marketed` from occupied suites. Once the as-of passes the lease end, derive.ts:158–219 builds the quiet availability as a plain `available` segment, and `withoutTerm` never touches `projected` segments.
- leakcheck's `asOf=2028-01-01` state misses it because it searches for names, not for terms or quiet listings that become vacant.

**X4 Accessibility of interaction: 2.5/3**

- Axe found 0 serious violations on 11 states.
- The Stack grid has roving tabindex, arrows, Enter to select, and Esc to clear with focus kept.
- The Timeline cursor slider moves a month on arrows and a year on Shift+arrows, and Home returns to today.
- The picker is one tab stop with arrows. Whole building and Full floor plan restore focus (round-12 fix landed).
- There is a polite live region for KPIs, and reduced motion is honoured.

−0.5: Activating a Building-view KPI row by keyboard drops focus to `<body>` for three of the six rows:
- "Largest block" goes to `?req=9300&mode=find`.
- "Expiring 12 mo" goes to `?lens=expiry&window=12&mode=worklist`.
- "WALT" goes to the Timeline.

These actions dock a floor or switch the view, so the KPI column unmounts (BuildingView.tsx:184–186, `{!docked && <KpiStrip variant="column">}`). `refocus` covers only `pick` and `wholeBuilding`, so a keyboard user lands at the top of the document. The also-docking "Available" and "Pipeline" rows keep focus.

**X5 CRM workflows & differentiation: 4/4**

- The deals lens shows the furthest stage per floor.
- Inquiries are matched to vacancies.
- Log call goes to the tenant most at risk, holdover first.
- Record actions (Open availability, Create listing, New deal) and "Verified" stamps are present.
- The change log and stale-record flag are there, and the worklist shows last-touch age and renewal deal stage.
- None of VTS, CoStar, Yardi or Prophia combine demand-side inquiries, activity recency and pipeline on the plan.

**UX TOTAL: 18.5/20**

## ENGINEERING (informational): 8.5/10

- **Strong.** Domain logic is pure TypeScript with 413 passing tests. Prospect-safe policy is centralised in `safe.ts` (`safeFloors`, `termHidden`, `canShow*`), so views cannot forget to withhold. The 81-case leakcheck, axe sweep and container-query layout are disciplined. The FLIP dock reads the "from" rect during render, which is precise.
- **Two structural defects show where the abstractions are thin:**
  - `usePlateSize`'s empty-deps effect assumes the ref exists at mount. The fix is a callback ref, or depending on `docked`.
  - `publishedFloors` models "quiet" as a property of the marketed-for-later link instead of the availability itself, so time travel bypasses it.
- **Portability.** It is reasonable: tokens are CSS variables and there is no CSS-in-JS. The SVG hero and WAAPI animation will need work in LWC.

## TOP UI FIXES (ranked by points gained per effort, max 5)

1. **Measure the plate when it mounts, not when the view mounts.** In `usePlateSize.ts`, replace the `useRef` plus `useLayoutEffect(..., [])` with a callback ref that measures and attaches the ResizeObserver whenever the node changes (store the node in state and depend on it). Or add the node to the effect's deps.
   - Then the plate opened by click, picker, quick start or KPI gets the same size as a fresh load (870 × 327 at 1440, not 640 × 213), and Ste 850/860 keep SF and asking rent.
   - Add a Playwright check: from `?view=building`, click the F8 picker row, wait 1 s, and assert the plate SVG width ≥ the `.sp-plate` width − 2.
   - Expected gain: +0.5 U1, +0.5 U3.
2. **Separate holdover from 2–3 yr in the daytime expiration lens.** Either move `--tone-exp-3-fill` (vice.css:118) off pink, for example to a muted violet `#d9c6ef` (and shift exp-4 bluer to keep the order), or give the `risk` tone a pattern on the model and plate the way sublease and committed have one.
   - Check that the new fill reaches ≥ 3:1 against `#f8d9e0` in a CVD simulation.
   - Expected gain: +0.5 U2.
3. **Keep the incoming floor column clear of the model during the dock.** Delay `.sp-bview__floor`'s `sp-bview-in` until about 60 % of `DOCK_MS` (start it at about 450 ms, not 140 ms), or put `overflow: clip` on `.sp-bview__model` while `stageRef.current.getAnimations().length > 0`, and fade `.sp-hero__tags` to 0 for the first 400 ms of the FLIP.
   - Then the labels "7" and "1" no longer collide with the caption and the New-deal button mid-motion.
   - Expected gain: +0.5 U4.

## TOP UX FIXES (ranked by points gained per effort, max 5)

1. **Close the time-travel hole in prospect-safe.**
   - In `publishedFloors` (safe.ts:130), also drop any `available` segment whose availability has `published === false`. Treat that space as "Leased" with no term, exactly like an in-place lease.
   - Add `'projected'` to the set `withoutTerm` handles, mapping it to `leased` with no end, so "Vacated Feb '27" cannot render.
   - Simplest and strongest alternative: in safe mode, pin `asOf` to today, disable the As-of button with the title "Time travel is off in prospect-safe mode", and drop `asOf` from a `safe=1` link the way `q` is dropped.
   - Extend leakcheck: for safe loads at `asOf` 2027-02-01, 2027-04-15 and 2028-08-01, fail on /Vacated|Projected vacancy/ and on any segment `data-key` that belongs to a `published:false` availability.
   - Expected gain: +1 X3.
2. **Keep keyboard focus when a KPI row docks the view.** In BuildingView.tsx, wrap `onKpi` so it also sets `refocus.current`. When the action opens an inspector mode (find, worklist), focus that inspector's heading (give it `tabIndex={-1}`). When it docks a floor without a mode, focus the opened floor's picker row. When it switches to the Timeline, focus the cursor slider.
   - Expected gain: +0.5 X4.
3. **Make Esc close the open floor in the docked Building view** when focus is inside `.sp-bview__floor` or the picker and no inspector mode is open, the same as "Whole building", with focus returned to the picker row. This matches the "Esc closes" key hint printed under the Stack.
   - Expected gain: polish, keeps X2 at 4.

## BUGS (with file:line)

- **Floor plate stuck at 640 × 213 after any interactive open.** src/components/floor/usePlateSize.ts:44–53 (`useLayoutEffect(..., [])`) with src/components/building/BuildingView.tsx:130, 134 and 259.
  - The ref is null when BuildingView mounts alone, so the plate never measures.
  - At 1440 × 1000, opening F8 by click gives an SVG of 640 × 213 in an 871 px column, against 870 × 327 on a fresh load. It persists across reopen and resize.
  - Ste 850 loses its asking rent, and Ste 860 loses its SF and asking rent.
- **Prospect-safe plus as-of reveals lease ends and a quiet listing.** src/domain/safe.ts:130–136 (`publishedFloors` only strips `marketed`), src/domain/derive.ts:158–219 (the quiet A04 becomes `available` after the lease ends), and src/components/plan/segmentText.ts:130 ("Vacated Feb '27" for `projected`; not covered by `withoutTerm`).
  - Repro: `?view=stack&safe=1&asOf=2027-04-15`. Floor 1 Ste 100 reads "Vacated Feb '27", and Floor 6 Ste 600 reads "Available now · $32–$34/SF/yr FSG" (A04 is `published: false`, property.ts:167).
- **Focus falls to `<body>` after keyboard activation of the "Largest block", "Expiring 12 mo" and "WALT" KPI rows** in the Building view alone. Location: src/components/building/BuildingView.tsx:184–186 (the column unmounts on dock or view switch; `refocus` covers only `pick` and `wholeBuilding`).
- **Daytime expiration: holdover/MTM fill and 2–3 yr fill are near-identical pinks**, `#f8d9e0` (src/styles/tokens.css:36) against `#ecbfd3` (src/styles/vice.css:118). There is no pattern on the model to separate them.
- **Transient overlap during the 760 ms dock.** The model's floor labels draw over the floor column's caption and action row. Location: src/components/building/building.css (`.sp-bview__floor` animation starts at 140 ms) with BuildingView.tsx (FLIP at the full stage scale).

Round-12 fixes, checked after scoring:
- **Landed:**
  - quick-start jump
  - pane flipping to the hovered floor after a pin
  - focus after Whole building and Full floor plan
  - docked floor numbers ≥ 11 px (12 px measured)
  - `safe=1&q=` dropped
  - toasts and announcements cleared on the safe switch
  - Log call holdover/MTM first
  - safe CSV sublease asking rent (leakcheck passes)
  - daytime expiry ramp steps in hue
- **Introduced:** the holdover/2–3 yr collision above.
