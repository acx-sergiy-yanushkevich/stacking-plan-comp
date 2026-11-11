# Round 15 · Judge: Claude Opus 5.5 (A) · live build at 1440/1024/390, round-15 shots and PDFs, code, 580 unit tests, axe, exportcheck, prospect-safe sweep
UI 18/20 (U1 4.5, U2 4.5, U3 3.5, U4 3, U5 2.5) · UX 19/20 (X1 5, X2 3.5, X3 3.5, X4 3, X5 4) · Engineering 8.5/10

```
JUDGE: Claude Opus 5.5 (A)
ROUND: round-15
```

How I checked: I read BRIEF, DESIGN and JUDGE_PROMPT and all round-15 screenshots that bear on this round's claims (00, 08, 10, 16, 18, 24, 33, 34, 38, 39, 40, 42), and the three PDFs in `docs/shots/round-15/pdf/`. I drove http://localhost:4180/ with Playwright (Chrome) at 1440×1000, 1024×768, 1024×1366 and 390×844. That covered: KPI and toolbar geometry in 11 states; the floor-list keyboard path; the dock and undock sampled every animation frame (rAF), with opacity; KPI hover and focus highlighting; Esc focus return from every KPI; a prospect-safe sweep (25 URLs, every Stack suite clicked, every floor pane, the timeline and map, the toggle-on path from a loaded owner state); the finder edge cases; and the map palette switch. I also ran axe (wcag2a/aa/21aa) on 11 views and themes, `npx vitest run` (43 files, 580 tests pass) and `node scripts/exportcheck.mjs` (all pass). Nothing in the repository was modified (`git status` clean afterwards).

## UI SCORE

**U1 Visual hierarchy & layout: 4.5/5**
- *What works.* The KPI bar is exactly what the brief asks for. It is 55 px tall at y=114 with the toolbar at y=181 in the Building, Stack, Timeline and Map views, with a floor open, with the inspector open (`select=A02`), in Find, and in the light theme. All measured live, identical to the pixel.
- *What works.* The Building view alone is calm and leads the eye: the model takes the card and the labels form one list beside it (shot 33, live). Docked, the layout is two columns, and the floor heading no longer repeats its cards ("Floor 8 · 21,400 RSF leasable", shot 34).
- *Deduction (−0.5): the selected suite is hidden under the inspector on a tablet.* At 1024×768 and 1024×1366 in the Stack view, clicking Ste 350 (Floor 3) opens the inspector as a bottom sheet. The sheet's top edge sits at y≈400 (768 tall) or y≈710 (1366 tall). The selected block stays at y=409–518 or y=1007–1116, behind the sheet, and the page does not scroll it clear (/tmp/r15a/sel-1024x768.png, /tmp/r15a/sel-1024x1366.png). This is the v1 complaint, "an overlay panel that hid the plan", on the tablet width the brief now scores.
- *Small, not deducted.* Turning prospect-safe on adds the "Fixed to today in prospect-safe" caption to the header, which moves the KPI bar from y=114 to y=127.

**U2 Color & data encoding: 4.5/5**
- *What works.* Every state has a non-colour cue: sublease dots, committed hatch, dashed unaccounted outline, Holdover and MTM tags, and the "Largest block" tag. The legend shows SF and share for each state, and the expiry legend carries the note "Stronger colour = sooner expiry".
- *What works.* The night expiration ramp separates its steps (shot 39). The Vice City palette and the map now re-read colours on a palette switch: the extrusion went from Ascendix slate and green to Vice violet and teal live (/tmp/r15a/map-asc.png → map-vice.png).
- *Deduction (−0.5): an unexplained pattern in the Building view.* The model draws Floor 1's non-leasable lobby as a grey diagonal hatch (`BuildingHero.tsx:189`, `pattern: 'hatch'`). The Building view legend has no "Building use" entry; its only near match, "Vacant / unaccounted", is a dashed square (shots 33, 39). In the Stack view the lobby is labelled in the block, so a reader can decode it there but not in the Building view, which is the default view.

**U3 Typography & density: 3.5/4**
- *What works.* Figures are tabular, and no element on any view I scanned truncates with an ellipsis (live check at 390 and 1440). Long names wrap ("North American Asset Holdings", "Conner CPA Group") rather than cut. KPI notes are one short line, with the full note in the tooltip.
- *Deduction (−0.5): dangling separators on the phone.* On the 390 px phone list a "·" is left at the end of a line before a wrap: "Ste 1250 · 9,300 SF ·" then "$38–$40/SF/yr FSG"; "Ste 1150 · 10,400 SF ·" then "Exp Jan 2032…"; "Ste 300 · 11,000 SF ·" then "Expired Aug 2026" (/tmp/r15a/m-building.png, shot 24).
- *Part of the same deduction: the map floor list's copy is inconsistent.* It mixes "Expires < 12 mo" and "Month-to-month" (capitalised, no "·" before them) with "· holdover" and "· expires < 12 mo" (lower case, with the separator) in the same list (shot 18). The Building view labels are consistent.

**U4 Polish & platform fit: 3/3**
- The glass skin holds in dark, light and Vice: panels are legible, and hover, selected, dimmed and focus states are distinct.
- Pointing at Largest block greys every suite but Ste 1250 in both the plan and the model; Available lights the four available suites (/tmp/r15a/k-avail.png, k-largest-bld.png).
- The dock at 1440 has zero overlapping frames in 72 sampled frames, dock and undock. At 1024, for about 85 ms (t≈145–230 ms), the model's bounding box crosses the picker column while the picker is only 9–45% opaque. It is barely perceptible, so I noted it but did not deduct.

**U5 Mobile & print visual quality: 2.5/3**
- *What works.* The phone layout is readable: the KPIs sit in a 2×3 grid, the legend is folded, and the timeline's rollover is folded to "< 12 mo 35,300 SF · At risk 17,200 SF". The owner PDF is presentation-grade: three sections on three pages, with the plan, rent roll, rollover, rent by type and worklist.
- *Deduction (−0.5): the prospect-safe PDF spills onto an almost empty page.* `docs/shots/round-15/pdf/prospect-safe-report.pdf` has 4 pages. Page 2 holds only the two-line footnote ("Floor width is proportional… WALT and rollover are withheld."), while the running header still says "Section 1 of 3". This is the report a broker hands a prospect.

**UI TOTAL: 18/20**

## UX SCORE

**X1 Persona job coverage: 5/5**
Each of the ten jobs can be finished quickly:
- **Occupancy:** Leased 86.1%, with 80.2% occupied.
- **Expirations:** the Expiring KPI opens the expiration lens and the 12-month worklist.
- **Trust:** Data issues 8, and the over-allocation note.
- **Blocks:** the finder, and the Largest block KPI with its highlight.
- **Identify and open:** the inspector with record actions.
- **Owner and prospect output:** the PDF, PNG and CSV exports; the export check passes on the phone too.
- **Direct, sublease and committed:** told apart by patterns and badges.
- **Time travel:** with KPI deltas.
- **Gaps:** the unaccounted 5,400 SF is traced to Delta Dental.
- **Pipeline:** the deals lens and live-deal counts.

The tablet sheet issue (U1) slows job 5 at 1024 but does not block it.

**X2 Interaction & IA: 3.5/4**
- *What works.* The views, lenses, finder, worklist and inspector are coherent. KPI clicks route to the right panel (Largest block → `mode=find&req=9300`; Expiring → expiry lens and the 12-month worklist), and Esc returns focus to the KPI in both the Stack and Building views. The Building floor list is one tab stop with ↑ ↓ Home End and Enter opens the floor (verified live); Esc from a docked floor returns focus to that floor's label. A needed-by date before the as-of date is refused with a clear message, by link and by typing.
- *Deduction (−0.5): the finder's alternatives ignore the maximum.* `?view=stack&mode=find&req=9000&max=9500` lists "Floors 7–8 · 14,400 SF · 4,900 SF over max" and "Floors 6–7 · 28,400 SF" as alternatives, three times the maximum, under a heading that says "Smaller spaces with their shortfall…".
- *Part of the same deduction: the no-fit message promises rows it doesn't show.* `?mode=find&req=40000` says "The closest spaces and floor combinations are listed below.", but the list contains single spaces only.

**X3 Trust & domain correctness: 3.5/4**
- *What works.* The numbers reconcile everywhere I checked:
  - the KPI tooltip shows 196,700 + 8,000 + 7,000 − 500 = 211,200 SF;
  - the rent roll total footnote matches;
  - NNN $41.10 = (2,400 × $39 + 5,600 × $42) / 8,000, with $3.25/SF/mo annualised;
  - WALT is exact in its tooltip (2.9776 yr).
- *What works: holdover, MTM, committed, sublease, confidential and the lease without units are all handled.*
- *What works: prospect-safe leaked nothing in my sweep.* I checked 25 URLs, clicked every Stack suite, went through every floor pane, the timeline, the map and its Area panel, print, and the toggle-on path, scanning both the text and the aria-label/title attributes for:
  - tenant, prospect and broker names;
  - Holdover, MTM and Confidential;
  - lease dates and sublease end dates;
  - WALT, the Expiring 12 mo figure, and deal stages.
  
  `inquiry`, `q`, `asOf` and the deals lens are all dropped when the mode turns on (the URL became `?view=stack&select=L13-U1&safe=1`). A04 is a quiet listing, so safe mode correctly shows "Nothing marketed ahead".
- *Deduction (−0.5): the finder still lists a dominated option.* `?view=stack&mode=find&req=12000` ranks Floor 6 · Ste 600 (21,400 SF) as option 1, then lists "Floors 6–7 stacked floors · Ste 720 on Floor 7, Ste 600 on Floor 6 · 28,400 SF" as an alternative (shot 08, live). Ste 600 alone already meets the requirement, so this row is a superset of an option. That contradicts the round's claim of "no duplicate subset rows". Cause: `src/domain/finder.ts:347` applies the subset/covered filter only to `kind === 'short'`, so `stack` rows that contain an option are never removed.

**X4 Accessibility of interaction: 3/3**
- axe reports 0 violations on 11 views and themes (Building alone and docked, Stack, Find, Timeline, Map, light, Vice, safe, worklist).
- The floor list uses a roving tabindex (one stop; Tab leaves the list).
- KPI buttons carry their full note as a title and their name from content. Focus returns to the KPI after Esc and to the floor label after an undock.
- The dock and the pane animation are disabled under `prefers-reduced-motion` (`building.css`, `BuildingView.tsx:180`).

**X5 CRM workflows & differentiation: 4/4**
- Deals by stage on vacancies and renewals ("Call 40 d", "Tour 25 d", "No activity").
- Inquiries that fit each availability, plus inquiry matching in the finder.
- Change history with authors, record actions (New deal on Floor 8, Create availability, Log call with Meridian (expires Dec '33)), stale-record flags, and data issues traced to records.

None of this is something VTS, CoStar, Yardi or Prophia can show from their own data.

**UX TOTAL: 19/20**

## ENGINEERING (informational): 8.5/10

The domain logic is pure and well tested: 43 files and 580 tests pass in 2.6 s. The prospect-safe policy lives in one module (`src/domain/safe.ts`) with named questions and projections (`safeFloors`, `safeKpis`, `visibleDeals`), so a new view gets no date to leak, and the leak sweep confirmed it. `exportcheck` exercises PNG, CSV, phone and safe mode end to end. The dock uses FLIP with the Web Animations API, and reduced motion is respected. Deductions:
- `finder.ts` has grown three overlapping rule sets (`findFits` pairs, `nearMisses` stacks, `noFit`). The superset and over-max gaps sit exactly where they interact.
- The map style logs a missing-sprite warning ("Image "wood-pattern" could not be loaded").
- The `settled` timeout in `BuildingView.tsx:184` runs on wall-clock time while the animations run on the document timeline, so the two can drift apart under throttling.

LWC portability is plausible: tokens are CSS custom properties and the data module is shaped like Apex DTOs.

## TOP UI FIXES (ranked by points gained per effort, max 5)
1. **Keep the prospect-safe PDF's footnote on page 1** (`src/components/print/PrintLayout.tsx` plus the print CSS). In safe mode the legend fits one row, so give the plan section `break-inside: avoid` with the footnote inside it. Alternatively, cap the plan at the owner report's height, which already fits. Then make the "Section n of 3" counter count physical pages, or put each section on exactly one page. *+0.5 U5.*
2. **Keep the selected suite visible above the inspector sheet at ≤1024 px.** When the inspector opens as a bottom sheet, scroll the selected block so its bottom is at least 16 px above the sheet's top edge (`scrollIntoView({block:'nearest'})` with `scroll-padding-bottom` equal to the sheet height). Alternatively, open the sheet at a peek height that leaves the selection visible. *+0.5 U1.*
3. **Explain the lobby hatch in the Building view.** Add a "Building use (lobby)" swatch with the grey hatch to the legend whenever any `floor.nonLeasable > 0`, or label the lobby on the model as the Stack view does. *+0.5 U2.*
4. **Stop the phone rows ending a line with "·".** Make each "· value" one `white-space: nowrap` unit so the separator wraps with what follows (`PhoneStack.tsx` row meta). *+0.25 U3.*
5. **Make the map floor list's copy match the Building view labels.** Use the same lower case and the same "·" separators: "· expires < 12 mo" and "· month-to-month" (map floor list in `MapView.tsx`). Together with fix 4, *+0.5 U3.*

## TOP UX FIXES (ranked by points gained per effort, max 5)
1. **Drop stacked alternatives that contain an option** (`src/domain/finder.ts:347`). Extend the filter to `kind === 'stack'` and remove a stack when any `covered` option's keys are all inside it, or when any single space in it already meets `req` on its own. Add a test: req=12000 must not list "Floors 6–7". *+0.5 X3.*
2. **Make the finder's alternatives respect the maximum** (`nearMisses`, `finder.ts:322`). Pass `maxSize` into `nearMisses` and skip a stack whose size exceeds it, unless a divisible space in it can be split to fit. *+0.25 X2.*
3. **Word the no-fit message by what is actually listed** (`noFit`, `finder.ts:~395`). Say "floor combinations" only when the alternatives include a `stack` row; otherwise say "The closest spaces are listed below." *+0.25 X2.*
4. **Say "sublease" in the Building and map floor labels when the floor's available space is sublet.** For example "7 · 100.0% leased · 7,000 SF sublease available", so a 100% leased floor showing available space does not look contradictory. No points; it removes a reading trap.
5. **Keep the KPI bar still when prospect-safe is toggled.** Move "Fixed to today in prospect-safe" into the as-of control's tooltip or the same header row, so the header height does not change (y=114 → 127). No points; it completes the "bar never moves" promise.

## BUGS (with file:line)
- **`src/domain/finder.ts:345-347`: a stacked alternative can contain an exact option.** The covered/subset filter only applies to `short` rows. Repro: `?view=stack&mode=find&req=12000` shows Option 1 "Floor 6 · Ste 600 · 21,400 SF" and the alternative "Floors 6–7 · Ste 720 on Floor 7, Ste 600 on Floor 6 · 28,400 SF".
- **`src/domain/finder.ts:322` (`nearMisses`, no max parameter): stacked alternatives ignore Max SF.** Repro: `?view=stack&mode=find&req=9000&max=9500` lists "Floors 7–8 · 14,400 SF · 4,900 SF over max" and "Floors 6–7 · 28,400 SF".
- **`src/domain/finder.ts` (`noFit`, the `hasAlternatives` message): the message promises rows that are not there.** Repro: `?mode=find&req=40000` says "The closest spaces and floor combinations are listed below." but no combination is listed.
- **Inspector bottom sheet at ≤1024 px covers the selected suite.** Repro: at 1024×768 or 1024×1366, open `?view=stack` and click Ste 350. The block stays at y=409–518 or y=1007–1116 under a sheet whose top edge is at y≈400 or y≈710.
- **Prospect-safe PDF has a near-blank overflow page.** `docs/shots/round-15/pdf/prospect-safe-report.pdf` page 2 contains only the plan footnote, and the header says "Section 1 of 3" on a 4-page document (`src/components/print/PrintLayout.tsx`).
- **`src/components/building/BuildingView.tsx:38` (`PICKER_IN`) at 1024 px: the docking model briefly crosses the picker.** Between t≈145 and 230 ms its bounding box overlaps the picker column (x 33–73) while the picker is 9–45% opaque. Clean at 1440 (0 of 72 frames).
- **Map style: console warning on every map load.** "Image "wood-pattern" could not be loaded…" (missing sprite in the basemap style used by `src/components/map/MapView.tsx`).
- **Prospect-safe header caption moves the KPI bar.** Turning prospect-safe on moves the KPI bar and toolbar down by 13 px (y=114 → 127) because the "Fixed to today in prospect-safe" caption adds a header line.

### Round-14 fixes, checked after scoring
**Landed:**
- the same-floor subset rows in `nearMisses` (Floor 8 is now one row, "Ste 850 + Ste 860");
- the no-results advice now names only relevant changes ("With the type set to Any instead of Sublease, 1 option fits.");
- the Expiration lens is hidden in safe mode, and WALT reads "Withheld" on screen and in print;
- the sublease end date is withheld (plan, PDF, CSV);
- an inquiry is dropped in safe mode, by link and by toggle;
- a needed-by date before the as-of date is refused with a message;
- in the Building view, focus returns to the KPI after Esc;
- the map re-reads its colours on a palette change;
- phone PNG export and the export's patterns (exportcheck passes, including the Floor 7 dots and Floor 4 hatching);
- the map floor list states the same fact per floor as the Building view (only the casing and separators differ).

**Partly landed:**
- The dock overlap is gone at 1440 but persists for about 85 ms against the fading picker at 1024.
- The finder still produces a superset row through the stacked-floors path (bug 1).
