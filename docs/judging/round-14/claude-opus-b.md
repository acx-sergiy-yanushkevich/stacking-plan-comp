# Round 14 · Judge: Claude Opus 5.5 (B) · Ascendix palette default, Building dock/keyboard, prospect-safe across every tab, finder, phone/tablet/print; live build at :4180 driven with Playwright
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 3) · UX 18.5/20 (X1 5, X2 3.5, X3 3.5, X4 2.5, X5 4) · Engineering 8.5/10

```
JUDGE: Claude Opus 5.5 (B)
ROUND: round-14
```

Method. I read BRIEF, DESIGN, COMPETITORS §4–7 and JUDGE_PROMPT, and looked at the round-14 shots and the three PDFs. Most of the evidence comes from driving http://localhost:4180/ with Playwright (Chrome channel, scratch files in /tmp/r14b only):
- real mouse hover and click on the 3D model, with frames captured every ~180 ms through the dock;
- Tab, arrow, Enter and Esc paths through the floor picker, the Stack grid, the KPI cards, the as-of popover and the timeline cursor;
- 29 prospect-safe URLs scanned (every view, every lens, select, worklist, issues, inquiry, q, asOf, bucket, find, print, floor). Each scan covered DOM text, title, aria-label and SVG titles, checked against every tenant, contact, prospect and broker name and every lease date in four formats. A hover sweep followed (875 hover targets over Stack, Timeline, Building and a docked floor);
- owner and safe CSV downloads;
- axe (wcag2a/aa/21aa) on 10 states;
- 1024×768 tablet, 390×844 phone (touch), prefers-reduced-motion.

`npx vitest run`: 40 files, 504 tests, all pass, and the working tree stayed clean.

## UI SCORE

**U1 Visual hierarchy & layout: 4.5/5**
- **What works.** The default Building view is a strong hero: the property title, then the toolbar, the legend with SF and share, and the model with its per-floor fact column (33). Opening a floor docks the model left and puts the plate, the four floor KPIs, the actions and the tabbed lists on the right. The plate is now drawn full size after a real click: about 870 px wide at 1440 (live F7 and F8), so the round-13 640×213 bug is fixed. In Stack, the plan still leads and the inspector reflows beside it (00, 04).
- **−0.5: the page reflows when a floor opens or closes.**
  - With no floor open, the KPIs sit in a left column inside the plan card and the toolbar is at y≈141.
  - With a floor open, the KPI strip moves to the top and the toolbar drops to y≈265. The six cards change from a column to a strip (live 03-esc vs 02-enter, and shots 33 vs 34).
  - So the control the user just used jumps 124 px, and "header, KPIs, controls" are ordered differently in the two states (`src/App.tsx:236` `kpisOnTop`, `src/components/building/BuildingView.tsx:226`).
- **Also seen.** In Map view the floor-list overlay covers about 390 px of the canvas and the building's left face at 1440 (live 51-map-hover). This is minor.

**U2 Color & data encoding: 4.5/5**
- **What works.**
  - The Ascendix palette is restrained: navy surfaces, #00AFF0 for accents, orange only for warnings and highlights.
  - Each state has a second cue: dots for sublease, hatch for committed, a dashed outline for vacant/unaccounted, a left bar plus a badge for expiring and holdover, and badges for For sale and Confidential.
  - The legend lists SF and % per state and sums to the recorded 245,900 SF, with the 500 SF over-allocation footnoted.
  - The round-13 daytime collision is fixed: 2–3 yr is now lavender, against the pink of holdover (live 60, 61).
- **−0.5: the dark rent lens's lowest FSG step does not read as a rent.** "< $28" is `--tone-rent-0-fill: #1b3a5c` (`src/styles/ascendix.css:65`), almost the card navy. Argosy ($27) looks like Halcyon's confidential grey at a glance, and only the edge and the text tell them apart (03).
- **Two smaller points.**
  - "Asking rent (vacancy) 33,200" is the only legend item without a share.
  - The expiration ramp runs in opposite directions by theme: at night the palest step is the soonest (yellow, <6 mo), by day the darkest is (red, <6 mo). So night and day screens of the same plan read differently.

**U3 Typography & density: 3.5/4**
- **What works.**
  - Tabular figures throughout.
  - Text tiers by width hold: narrow suites wrap ("Conner CPA / Group", "BeachBody / Workouts") rather than truncate.
  - The tablet plate moves Ste 860's label to a numbered callout under the plate instead of clipping it (live 11-tablet-f8).
  - Docked model labels are now only the open and the hovered floor ("7" and "3", live 07), so the round-13 digit columns are gone.
- **−0.5: a truncated fact in a judged state.** On the focused floor the Stack gutter prints "21,400 SF marketed f…": the string runs under the first block because the gutter is 116 px. It is visible in the judged shot 04 and live at 1024 (12-tablet-stack-sel). Location: `src/components/stack/StackView.tsx:309-312` (`availabilityFact` drawn at x=8 with no width fit).

**U4 Polish & platform fit: 2.5/3**
- **What works.**
  - The glass skin is coherent in night, day and Vice.
  - Hover, selected and focus states are clear: a cyan outline with a soft ring, and an orange focus ring on the picker.
  - Translucency never costs legibility: axe found no contrast violations on any of the 10 states.
  - Model labels hide while the model moves.
- **−0.5: the dock is still not clean mid-motion.**
  - At ~290 ms after the click (live frame 05-anim-1), the moving model draws over the floor picker: the picker's "100.0", "65.4" and "74.3" are cut off under the model's left face.
  - The incoming plate, KPI row and "Over-allocated" chip fade in underneath, overlapping the model's lower floors.
  - Round 13 reported the same kind of overlap. The labels are fixed, but the slabs still cross the picker.

**U5 Mobile & print visual quality: 3/3**
- **Phone (390 px).** A readable card list per floor, each with a to-scale bar, the leased %, exact SF and badges (23). The legend is collapsed. The map starts at about 49% of the screen height (25b). There is no horizontal scroll on stack or timeline (scrollWidth 390). The timeline has a 3×3 rollover grid.
- **PDFs.** Presentation-grade landscape Letter: cover, KPIs and plan; a rent roll with totals and the cap footnote; then rollover, rent by type, coming supply and the worklist. The safe PDF is consistently blanked.
- **Small issue.** On the phone, the bottom sheet covers half of the selected row (its "Call 40 d" badge sits under the sheet edge, live 14).

**UI TOTAL: 18/20**

## UX SCORE

**X1 Persona job coverage: 5/5**

All ten jobs finish quickly:
- **Occupancy by floor:** picker and gutter.
- **Rollover from as-of:** Building inspector chart, timeline band, PDF page 3. I checked every bucket by hand against the mock and all match: <12 mo = Café + Cirrus + BeachBody + NAAH = 35,300; 3–4 yr = Anadarko 52,000 + Infinity 19,500 = 71,500.
- **Trust:** the "1 record stale" chip, Data issues 8, the over-allocation cap stated everywhere, the phantom lease traced from F2-gap.
- **Blocks by size and date:** the finder now opens all three suites of "Floors 7–8" (live 20-find-78). Direct and Sublease apply to alternatives (sublease 12,000 gives 0 options plus "Floor 7 · Sublease · 5,000 SF short"; direct gives direct-only alternatives with a note). Needed-by accepts today exactly (by=2026-11-09).
- **Identify and open the record:** the inspector, plus a toast stub.
- **Owner and prospect-safe exports:** print, CSV, PNG.
- **Direct / sublease / later / committed:** each is told apart.
- **Time travel:** "+12 mo" sets asOf=2027-11-09. The live region announces "leased 71.7%, down 14.4 points…".
- **Data gaps:** shown.
- **Deal pipeline:** Deals lens and stage badges.

**X2 Interaction & IA: 3.5/4**
- **What works.**
  - A single URL holds all state.
  - Esc now closes a docked floor and returns focus to its picker row (live t2).
  - KPI cards open what they name, and focus moves to the panel heading (Find space, Renewal worklist) or to the timeline band.
  - The filter bar always names the filter and offers Clear.
  - The empty finder suggests "Try 12 months later" and lists near misses.
- **−0.5, from three coherence gaps:**
  - **The Building/KPI reflow (see U1).** Opening a floor or a KPI from the Building view changes where the KPIs and toolbar live.
  - **Needed-by takes a past date without saying so.** In en-GB, typing 11/09/2026 (meant as 9 Nov) becomes by=2026-09-11, before the as-of date. Because `min={asOf}` is not enforced on typed input (`src/components/inspector/FindPanel.tsx:88`, `src/domain/finder.ts` `neededByDate`), every option is then marked late.
  - **The map floor list and the Building labels still differ.** The round-14 note says they state the same fact, but they do not:

    | Floor | Map floor list | Building label |
    |---|---|---|
    | 7 | "7,000 SF sublease available" | "7,000 SF available" |
    | 1 | adds "· 2,600 SF for sale" | (not shown) |
    | 2 | adds "· 5,400 SF unaccounted" | (not shown) |

    Source: `src/components/map/mapStyle.ts:63` vs `building/floorFact.ts`.

**X3 Trust & domain correctness: 3.5/4**
- **What works.**
  - RSF is exact everywhere.
  - Leased (86.1% = 211,200 / 245,400, capped) and occupied (80.2% = 196,700) are stated separately, with "8,000 SF signed, not in".
  - Holdover, MTM, sublease (head-lease remaining used in WALT), committed and confidential ("Rent confidential") are all correct. NNN and MG sit off the gross scale. The café's $3.25/SF/mo is converted when the rent-by-type table averages per year.
  - Data issues surface.
- **Prospect-safe.** My scans of 29 URLs and 875 hover targets found no tenant, contact, broker or prospect name and no lease date. asOf is dropped (asOf=2028-06-01 → today). The quiet A04 listing never appears. The safe CSV blanks the dates. The timeline draws uniform "term not disclosed" bars, so bar geometry gives nothing away.
- **−0.5: the open inquiry is still shown in prospect-safe mode.**
  - `?safe=1&inquiry=I02`, or matching I02 and then switching Prospect-safe on, keeps the inquiry. The filter bar and the Find panel then read "Space for an open inquiry: 15,000–22,000 SF by Jun 30, 2027" (live 41-toggle-inquiry).
  - `safe.ts` lists "open inquiries" as withheld (`canShowInquiries`). The name is hidden, but the size and needed-by of a landlord's demand-side record reach the prospect.
  - Locations: `src/model/usePlanModel.ts:235`, `src/components/inspector/FindPanel.tsx:84`, and `src/state/planState.ts:141` (q is dropped on safe, inquiry is not).
- **Two notes, no further deduction.**
  - A sublease's "thru Sep 30, 2030" is the sublandlord's head-lease end (Infinity, L14). That is standard offer data, but worth knowing.
  - In the safe rent roll the 720 row puts its asking rent in the State column and "Withheld" in Rate.

**X4 Accessibility of interaction: 2.5/3**
- **What works.**
  - A skip link.
  - The picker is a single tab stop with arrow keys. Enter opens the floor and keeps focus on the row; Esc closes it and returns focus to the row.
  - The Stack grid: one tab stop, ←/→ within a floor, ←/→ from the first suite to the rowheader, ↑/↓ across floors, Enter opens with a polite announcement, and Esc returns to the cell.
  - The timeline cursor is a slider with valuetext; →, Shift+→ and Home work.
  - The as-of popover focuses "Today", and Esc returns focus to its button.
  - Reduced motion makes the dock instant.
  - axe: 0 violations on 10 states.
- **−0.5: focus is lost on Esc in the default view.**
  - In Stack view, Esc after a KPI card returns focus to that card.
  - In the Building view, Esc after "Largest block" or "Expiring 12 mo" (keyboard Enter) drops focus to `<main>`. The KPI column remounts when `kpisOnTop` flips, so the opener no longer exists (`src/App.tsx:236`, `src/components/building/BuildingView.tsx:226`).
  - Because this is the default view, keyboard users lose their place after every KPI round trip.

**X5 CRM workflows & differentiation: 4/4**
- The Deals lens shows stage badges and the prospect in the inspector ("LOI · Vantage Robotics").
- Inquiry matching appears on blocks, in the finder ("1 inquiry fits") and on the floor's Inquiries tab.
- Each block shows last-touch recency ("Call 40 d", "No activity").
- Record actions are pre-filled to their context ("Log call with Argosy Partners (holdover)", "New deal on Floor 3").
- Field History appears as "Changes" (Cirrus expiration Jun→Mar 2027 by Elena Ruiz) and as the header's "Latest change" and stale chip.
- The listing's published/quiet status is shown.
- The prospect-safe mode is a real policy module.

None of the competitors in COMPETITORS §5 combine all of these.

**UX TOTAL: 18.5/20**

## ENGINEERING (informational): 8.5/10

- **Domain.** `src/domain/` is pure TypeScript with focused tests (504 passing, including finder, safe, kpis, rollover and lenses).
- **Prospect-safe policy.** It sits in a single module whose header documents the threat model and lists an accessor per withheld field. `scripts/leakcheck.mjs` covers fresh loads, time travel and toggles.
- **State.** One URL-synced state object (`state/planState.ts`) feeds a single derived model (`usePlanModel`). CSS is per component and token-driven, and `paletteChecks.ts` tests both palettes for contrast. This shape suits an LWC port.
- **Deductions.**
  - Layout ownership is split: the KPI strip is rendered by App in one state and by BuildingView in the other, which causes the focus-loss bug.
  - The inquiry rule bypasses the safe projection (`usePlanModel.ts:235` makes its own safe decision instead of asking `canShowInquiries`).
  - Hand-tuned SVG text placement (StackView gutter) has no fit check, unlike `lib/textFit` used elsewhere.

## TOP UI FIXES (ranked by points gained per effort, max 5)

1. **Fit the focused-floor gutter fact (+0.5 U3).** In `src/components/stack/StackView.tsx:309-312`, run the string through the existing `lib/textFit` against `gutter - 12` px. When it does not fit, split it into two `<tspan>` lines ("21,400 SF" / "from Apr '27") at y=78 and y=92, or use the short form "21,400 SF Apr '27". Add a test that the rendered text width is ≤ 112 px for every floor at both 1440 and 1024.

2. **Keep the dock clear of the picker (+0.5 U4).**
   - Give `.sp-mini` `position: relative; z-index: 2` with an opaque glass background, so the moving model passes under it.
   - Hold the right column's fade-in (`.sp-bview__floor`) until the FLIP has finished, at `DOCK_MS` × 0.6.
   - Add a Playwright frame check at 250 ms after a real click: the picker's bounding box must not intersect any `.sp-hero` slab that is painted above it.

3. **Stop the toolbar from moving (+0.5 U1).** Render the KPI strip in the same place in both Building states. Either:
   - keep the top strip in the alone state too, and use the left column only for "Most space" and the at-risk lines; or
   - keep the column when docked.

   Then the toolbar stays at the same y whether a floor is open or not (`src/App.tsx:236`).

4. **Give the lowest dark rent step a visible fill (+0.5 U2).**
   - Lift `--tone-rent-0-fill` in `src/styles/ascendix.css:65` from #1b3a5c to about #2c5a85, so the five FSG steps stay ordered but "< $28" no longer matches the card.
   - Extend `paletteChecks.ts` with a fill-vs-card test of ≥ 1.4:1 for every non-neutral tone.
   - Add the share % to "Asking rent (vacancy) 33,200".

5. **Optional.** Below 1280 px, collapse the map floor list to its first column (floor number and leased %) with a "Details" toggle, so it no longer covers the building (`src/components/map/MapView.tsx`).

## TOP UX FIXES (ranked by points gained per effort, max 5)

1. **Return focus to the KPI card in the Building view (+0.5 X4).**
   - Store the opener's KPI id in a ref when `onKpi` fires.
   - In BuildingView, add an effect that runs when the KPI column mounts (`kpisOnTop` back to false): if that ref is set, focus `.sp-kpi[data-kpi="<id>"]` and clear the ref.
   - Add a Playwright check: `/`, focus "Largest block", Enter, Esc, and expect `activeElement` to be that card.

2. **Withhold the inquiry in prospect-safe mode (+0.5 X3).**
   - In `src/state/planState.ts:141`, drop `inquiry` when `safe` (as q is dropped), converting it to plain `req`/`max`/`by` so a broker can still send the requirement.
   - In `src/model/usePlanModel.ts:235` and `FindPanel.tsx:84`, label it "Requirement: 15,000–22,000 SF by Jun 30, 2027" and never "open inquiry".
   - Add `?safe=1&inquiry=I02`, and the toggle-on path with an inquiry selected, to `leakcheck.mjs`, failing on /inquir/i.

3. **Reject needed-by dates before as-of (+0.25 X2).** In `src/domain/finder.ts` `neededByDate`, take `asOf` and return `asOf` for an earlier date. In `FindPanel.tsx:88`, show "Before the as-of date; using Nov 9, 2026" under the field.

4. **Give the map floor list the Building view's wording (+0.25 X2).** In `src/components/map/mapStyle.ts:63`, print `floorFact()` verbatim first, then put any extras (for sale, unaccounted) after a separator labelled "also", so Floor 7 reads "7,000 SF available" in both places.

## BUGS (with file:line)

- **`src/components/stack/StackView.tsx:309-312`: the focused-floor gutter text is truncated.** It reads "21,400 SF marketed f…" under the first block on Floor 6 (shot 04; live at 1440 and 1024).
- **`src/App.tsx:236` with `src/components/building/BuildingView.tsx:226`: focus is lost after a KPI round trip.** In the Building view, Esc after opening Find space or the Worklist from a KPI card drops focus to `<main>`, because the KPI column remounts. The same path in Stack view returns focus correctly.
- **`src/model/usePlanModel.ts:235`, `src/components/inspector/FindPanel.tsx:84`, `src/state/planState.ts:141`: the inquiry survives prospect-safe mode.** `?safe=1&inquiry=I02`, and the toggle-on path, show "Space for an open inquiry: 15,000–22,000 SF by Jun 30, 2027" (an inquiry record's terms) to a prospect.
- **`src/components/inspector/FindPanel.tsx:88` / `src/domain/finder.ts` (`neededByDate`): a typed needed-by before the as-of date is accepted silently.** The input's `min` is not enforced on keyboard entry: in en-GB, 11/09/2026 becomes by=2026-09-11.
- **Building dock (`src/components/building/building.css`, FLIP in `BuildingView.tsx`): the model crosses the picker mid-dock.** At ~290 ms the moving model overlaps the floor picker column, and the picker's percentages are cut off (live frame).
- **`src/components/map/mapStyle.ts:63`: the map floor list's wording differs from the Building view's labels** for Floors 7, 2 and 1.
- **`src/styles/ascendix.css:65`: the dark rent step "< $28" fill (#1b3a5c) is nearly the card colour**, so a $27 suite reads like a no-rent or confidential block.

## Round-13 fixes, checked after scoring

**Landed:**
- the plate is full size after an interactive open (≈870 px at 1440);
- prospect-safe plus as-of (asOf is dropped, the control is disabled with a note, no "Vacated", A04 never shown);
- rollover counts and the "4 leases" note are withheld in safe mode;
- safe commencement dates are blank in the CSV and the PDF;
- Esc closes a docked floor;
- focus after a KPI opens a panel goes to its heading;
- docked labels show only the open and hovered floors;
- the daytime 2–3 yr step is now lavender, apart from holdover pink;
- multi-floor alternatives select every suite;
- Direct/Sublease apply to alternatives;
- needed-by takes an exact date including today;
- the phone map legend is collapsed;
- at 1024×768 the floor's first KPI row is on the first screen;
- the map floor list mentions MTM and unaccounted space.

**Partly landed:**
- dock overlap: the labels are fixed, but the model still crosses the picker;
- the map facts are not identical to the Building view's;
- KPI focus works on open but not on the return trip in the Building view.
