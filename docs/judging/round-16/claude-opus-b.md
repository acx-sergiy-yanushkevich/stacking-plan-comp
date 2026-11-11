# Round 16 · Judge: Claude Opus 5.5 (B) · live build driven with Playwright (dock frame capture via CDP screencast, keyboard, prospect-safe toggle and sweep, finder, sheets at 390/820/1024, wrap scan, axe), round-16 shots and PDFs, code, 688 unit tests
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 19.5/20 (X1 5, X2 4, X3 3.5, X4 3, X5 4) · Engineering 8.5/10

```
JUDGE: Claude Opus 5.5 (B)
ROUND: round-16
```

## How I tested

- **Live build (http://localhost:4180/), Chrome through Playwright.** Scratch output went to /tmp/r16b; nothing was written in the repo, and `git status` stays clean.
- **Dock and undock.**
  - I sampled every requestAnimationFrame at 1920, 1440, 1280, 1100, 1024 and 820 px, comparing the model's box with the picker, the floor list, the floor pane and the legend, each with its opacity.
  - I recorded real-speed CDP screencasts of a mouse dock and undock at 1440.
  - I also took 0.1× slowed captures. These are only useful for the glide: the turn runs on JS time, so slowed frames show a misleading mid-turn angle.
- **Keyboard.**
  - Floor list: Tab, ↑↓, Home/End, Enter. I delayed the web font by 2.5 s to repeat the "rebuilt when the font arrives" case.
  - Picker, Esc, and "Whole building" pressed by keyboard.
  - Stack grid arrows, Enter and Esc.
  - As-of popover open and Esc, and the Export menu.
- **Prospect-safe.**
  - I set up a session (expiry lens, as-of 2027-06-01, 12-mo worklist, `q=meridian`, inquiry I02) and turned safe on with a real click on the switch.
  - I measured the header, KPI bar and toolbar, and the position of every control.
  - I clicked through all four views and every lens offered, opened seven selections, all inspector modes and the floor view, and typed searches.
  - Each state was scanned for 60+ tenant, contact, prospect and broker names, in-place rents and sale-listing figures across innerText, title, aria-label, `<title>` and the URL.
  - Then I turned safe off and checked what was restored, including after a reload.
- **Other live checks.**
  - Finder: seven requirements.
  - Bottom sheets: Stack and Building at 390, 820 and 1024.
  - Map vs Building label lists: compared row by row in 4 lenses × safe on/off.
  - Wrap scan for a "·" that ends a line: 10 states × 6 widths.
  - axe (wcag2a/aa/21aa): 8 states × 2 themes.
  - L* of the expiration steps, computed from the CSS.
  - `npx vitest run --no-cache`: 50 files, 688 tests passed.
- **PDFs.** I read all three real Chrome PDFs page by page.

## UI SCORE

**U1 Visual hierarchy & layout: 4.5/5**

What earns the points:
- The order is right in every view: header, then one quiet KPI bar, then one toolbar row, then the plan.
- At 1440×900 the Building view's twelve labels are level with their floors (horizontal leaders, 13 px). At 1024 and 1280 the 24 px rows fan out with thin leaders that still land on each floor's edge.
- Opening a floor docks the model beside a compact picker. The plate, its four figures and the tabs read left to right, and the inspector reflows and never overlays.

Deduction:
- **Map view at 1440×900 (live, expiration lens): the floor list crushes the map.**
  - The list column is about 500 px wide, with roughly 120 px of empty space above row 12 and 130 px below row 1.
  - The map, which is the subject of that view, gets about 530 of the card's 1,030 px.
  - The "Footprint: OpenStreetMap · 12 floors · 13.5 ft each" box takes another 300 × 75 px of the map's top-left corner.
  - The list is as tall as twelve 26 px rows, so a narrower column, or a list over the map's left edge, would give the map the width.

**U2 Color & data encoding: 4.5/5**

What earns the points:
- Every status has a second cue: dots for sublease, hatch for committed, dashed for vacant, a hatch for the lobby (now in the legend), and badges for Holdover, MTM, Avail Apr '27, Signed and Largest block.
- Legends carry SF and share.
- I computed the expiration ramps' neighbouring L* gaps in the two scored palettes, in both themes:

  | Palette and theme | Gaps between neighbouring steps (ΔL*) |
  |---|---|
  | Ascendix dark | 17.0 / 10.5 / 9.3 / 10.1 / 11.5 |
  | Ascendix light | 15.2 / 16.0 / 8.2 / 8.3 / 8.2 |
  | Vice dark | 10.9 / 11.0 / 11.3 / 10.6 / 9.8 |
  | Vice light | 12.4 / 14.4 / 9.5 / 9.3 / 11.4 |

  All of these are 8 or more, as claimed.

Deduction:
- **On the Map floor list (expiration lens) the swatch and the words of a row disagree.**
  - The swatch is the floor's dominant tone (`dominantTone`, `src/components/map/MapView.tsx:188`), but the text names the soonest expiry.
  - Floor 5 shows a coral "1–2 yr" swatch beside "expires Apr '27", which is a "< 6 mo" step.
  - Floor 1 shows a pink "2–3 yr" swatch beside "expires Feb '27".
  - A reader matching the swatch to the legend gets a different answer from the text on the same line.

**U3 Typography & density: 3.5/4**

What earns the points:
- Figures are tabular throughout.
- No name is truncated: the Stack wraps "North American Asset Holdings", and the plate moves names that do not fit to a numbered key.
- The Map and Building labels are identical at 13 px (12/12 rows, 8 lens/safe combinations, 0 diffs).

Deduction:
- **"No separator ends a line" is not true.** The wrap scan found three places, and each is confirmed in a capture.
  - The worklist inspector subtitle reads "Leases ending within 12 months · 4 leases ·" with "35,300 SF" on the next line, at 1440, 1280 and 1100. The string is built in `src/model/usePlanModel.ts:250` and shown by `Inspector.tsx:60`. It is visible in shot 12.
  - The inspector's mini-model caption reads "Floor 3 · 74.3% leased · 21,400 RSF ·" with "5,500 SF available" on the next line (`src/components/hero/BuildingHero.tsx:256`). It is visible in shot 05.
  - At 820 and 1024 the Building caption reads "Labels: % leased ·" with "space available now" on the next line. The trailing " ·" is put inside the no-break part by design (`src/components/building/BuildingView.tsx:345`).

**U4 Polish & platform fit: 2.5/3**

What earns the points:
- The glass skin is legible in dark, light and Vice.
- **The dock is clean:**
  - In 120-frame samples at six widths, the model's drawing never covered a visible picker, list or pane. At 1920, 1440 and 1280 its *bounding box* touched the legend for about 70 ms, but the frames show empty space there, not drawing.
  - "Whole building" brings the list back at full opacity in 226–256 ms.
- Hover, selected, dimmed and focus states are distinct.
- KPI hover lights the timeline bars (28 or 23 bars dimmed on hover, 0 after moving away).

Deductions:
- **Prospect-safe still moves the toolbar.**
  - The header, KPI bar and toolbar boxes keep their position (measured identical).
  - But removing Worklist and two lenses moves the search field from x=756 to x=863 and Find space from x=1188 to x=1295, a 107 px jump under the user's eye (`src/components/shell/Toolbar.tsx:71`).
  - The release notes say the toolbar keeps its position.
- **The timeline at as-of 2029-07-01 (dragged live) has overlapping labels.**
  - The Floor 3 "Holdover" tag runs into "Argosy Partners", and the holdover bar's end edge is drawn through the name, so it reads "Argosy|Partners".
  - "Preston Park Café" and "BeachBody Workouts" have expired by then but do not carry the "· vacated" suffix that their neighbours carry.
  - Source: `src/components/timeline/TimelineRows.tsx` (holdover extension at 321–339).

**U5 Mobile & print visual quality: 2.5/3**

What earns the points:
- **The PDFs are presentation-grade.**
  - The prospect-safe report is now two full pages, with the running head "Section 1 of 2".
  - The owner report is three pages with real tables.
  - The NNN average converts $3.25/SF/mo to /yr before weighting ($41.10).
- The phone has no horizontal scroll in the Stack, Map or Timeline.
- Floor cards are readable at 390.

Deduction:
- **The phone header wastes the first screen.**
  - At 390×844 the palette switch and the theme button take a full row by themselves.
  - Header, KPI grid and toolbar end at about y=425, so half the first screen is chrome before the first floor.
  - The palette switch belongs in the Export or a settings menu on a phone.

**UI TOTAL: 17.5/20**

## UX SCORE

**X1 Persona job coverage: 5/5**

All ten jobs are done fast, and I did each live:
- **Occupancy and vacancy:** the KPI bar and the floor labels.
- **Rollover:** the inspector chart, the expiration lens, the KPI that opens the 12-mo worklist (URL `lens=expiry&window=12&mode=worklist`), and the timeline cursor.
  - Shift+→ moves the date a year, Home returns to today, and the mouse drag works: KPIs recompute to 58.8% leased with a −27.3 pts delta.
- **Trust:** 8 data issues with fix, locate and mark-reviewed actions, plus the over-allocation note.
- **Find space:** ranked options and correct alternatives.
- **Block detail and record actions.**
- **Owner and prospect-safe PDFs, PNG, CSV and copy link.**
- **Direct, sublease, committed and later are each labelled.**
- **Time travel.**
- **Data gaps.**
- **Pipeline:** the deals lens and the per-vacancy stages.

The phone omits the Building tab, but the Stack covers every phone job.

**X2 Interaction & IA: 4/4**

- **Finder rules hold (all checked live):**
  - `req=12000` no longer offers "Floors 6–7" containing its own option.
  - `max=15000` keeps the 14,400 SF two-floor stack and drops the Floor 8 row it contains.
  - `req=20000` lists no stack and says only "Smaller spaces with their shortfall."
  - `fit=direct` says "Choose 'Any' to combine…".
  - In safe mode the unpublished Floor 6 option correctly disappears.
- **Prospect-safe restores the session.** Turning it off brings back the lens, as-of date, window, inquiry, search and mode. While safe is on, the URL is only `?view=stack&safe=1` and both storages are empty.
- **Feedback is consistent:** filter bars with Clear, empty states, and the as-of popover takes focus on Today and returns it on Esc.

**X3 Trust & domain correctness: 3.5/4**

What earns the points:
- **Exact figures that reconcile.**
  - The rollover buckets add up to 194,500 SF; with the 17,200 SF at risk that is 211,700 SF.
  - 211,700 SF is the "rows sum to" figure, and leased is capped at 211,200 SF.
  - The four leases expiring within 12 months add up to 35,300 SF, matching the KPI.
- **Holdover, MTM, committed, sublease (with its expiration) and confidential (rent hidden, excluded from averages) are each handled.**
- **The prospect-safe sweep found zero leaks.**
  - I scanned 43 states, including every view, every lens offered, 7 selections, every inspector mode and the floor view, for 60+ names, contacts, prospects, brokers, in-place rents and listing figures.
  - The only hits were the asking rents, which are allowed, and the text I typed in the search box.
  - The building listing reads only "Listed for sale".

Deduction:
- **In the Rent lens, the owner-mode floor label prints in-place rent beside available space without saying which rent it is.**
  - Floor 12 reads "50.0% leased · 9,300 SF available · $36/SF/yr FSG".
  - $36 is Kinetic's in-place rate; the 9,300 SF on offer asks $38–$40.
  - The same label in prospect-safe mode says "asking $38–$40/SF/yr FSG".
  - `floorFact.ts:126-130` returns the in-place figure and drops the asking rent whenever both exist. The only explanation is the caption note, not the label.
  - On the owner call this invites quoting the wrong figure for the vacancy.

**X4 Accessibility of interaction: 3/3**

- **Focus is never dropped**, even with the font held back 2.5 s:
  - Enter on a floor label lands focus on that floor's picker row.
  - Esc from the docked view and "Whole building" by keyboard both return focus to the floor's label.
- The floor list is one tab stop with ↑↓/Home/End.
- **The Stack grid works:** ←→ moves along a floor, ↓ moves to the floor below, ← from the first suite reaches the floor label, Enter selects, Esc closes.
- Accessible names are clean ("Floor 12, 50.0% leased, 9,300 SF available, largest block").
- The KPI buttons announce their whole note.
- axe: 0 violations in 16 states.
- Not deducted: with zero-delay synthetic key presses, ArrowDown immediately followed by Enter selected the *previous* block (A08) while focus had moved to Halcyon. With 150 ms between keys it behaved correctly.

**X5 CRM workflows & differentiation: 4/4**

Deals on vacancies and renewals by stage, inquiry matching ("Fits this inquiry"), last-touch chips ("Call 40 d", "No activity"), broker and record actions, 30-day change history, marketed-for-later supply and the data-issue fixes are all things only a CRM knows, and they are woven into the plan rather than bolted on.

**UX TOTAL: 19.5/20**

## ENGINEERING (informational): 8.5/10

The domain layer is pure and well covered: 688 tests pass in 3.3 s, including finder rules, prospect-safe and label-parity tests. The model, view and print split is clean, and the dock code reads as careful engineering: a FLIP glide whose fades are timed from the same geometry, and focus aimed before the state changes.

Deduction (E3): the round-16 claim that "browser globals in the state layer and the app shell go through one host adapter" holds only for address, history and title.
- `src/state/focusStore.ts:5,11,16,54-57,80-87` still calls `document.activeElement`, `document.querySelector` and `requestAnimationFrame` directly.
- `src/App.tsx:54,70-71` calls `document.querySelector` directly.
- Global `document.querySelector('.sp-app')` will not reach into an LWC shadow root, so these need to go through `host.ts` too.

## TOP UI FIXES (ranked by points gained per effort, max 5)

1. **Stop separators ending a line (+0.5 U3).**
   - `usePlanModel.ts:250`: join the filterLabel parts with `NBSP + '·' + ' '`, so the dot wraps with what follows.
   - `BuildingHero.tsx:256`: use `' ·' + NB`-style joins so "·" never ends the line, or render each part in a nowrap span with the separator at the *start* of the next part.
   - `BuildingView.tsx:345`: move `' ·'` out of the end of part *i* and into the start of part *i+1*, inside its `sp-nb` span.
   - Add the wrap scan to the Playwright checks for the worklist subtitle, the inspector model caption and the building caption at 820–1440.
2. **Keep the toolbar still in prospect-safe (+0.5 U4).**
   - In `Toolbar.tsx:71`, keep the Worklist button's slot when safe is on: render it with `visibility:hidden; aria-hidden`, or as a disabled "Worklist (withheld)" button.
   - Fix the lens segmented control's width, as is already done for the group, so the search field and Find space do not shift 107 px.
   - Assert their x positions in the stability test.
3. **Give the Map its width (+0.5 U1).**
   - In map.css, cap the floor-list column at `max-content` with a 360 px ceiling, and let the map take the rest (`grid-template-columns: minmax(0, auto) 1fr`).
   - Align the list's top with the map's top instead of centring it.
   - Shrink the "Footprint: OpenStreetMap" overlay to a one-line chip.
4. **Make a map row's swatch and text agree (+0.5 U2).** On the Map floor list, draw the swatch from the same fact the text names (on the expiration lens, the soonest-expiry step), or print the dominant step in words ("mostly 1–2 yr · next Apr '27"). Do the same in `dominantTone`'s callers for the floor list only; leave the extrusion colours as they are.
5. **Give the phone header one row back (+0.5 U5).** At ≤760 px, move the Ascendix/Vice switch and the theme button into the Export menu (or a "⋯" menu beside it), so the header is title plus one row of controls and the first floor starts about 60 px higher.

## TOP UX FIXES (ranked by points gained per effort, max 5)

1. **Say which rent the Rent-lens label shows (+0.5 X3).**
   - In `floorFact.ts:126-130`, prefix in-place rents with "in place".
   - When the floor has space on offer, append the asking rent: "9,300 SF available · in place $36/SF/yr FSG · asking $38–$40/SF/yr FSG".
   - Keep the safe-mode text as it is.
   - The Map list inherits the change through the shared label function, and the parity test keeps the two lists equal.
2. **Close the Stack grid's Arrow-then-Enter race (no points; robustness).** When the roving focus moves on ArrowDown, update the grid's active key synchronously in the keydown handler, not on the next frame, so an immediate Enter selects the block that has focus. Add a test that sends ArrowDown and Enter in one event loop turn.
3. **Mark expired leases on the timeline consistently (no points).** Append "· vacated" to every lease whose end is before the cursor, including short bars (fall back to the name and the tag). Keep the holdover tag's box clear of the name by starting the name after `tagW + 6`.

## BUGS (with file:line)

- `src/model/usePlanModel.ts:250` → shown at `src/components/inspector/Inspector.tsx:60`: the worklist subtitle wraps as "… 4 leases ·" with "35,300 SF" on the next line at 1100–1440.
- `src/components/hero/BuildingHero.tsx:256`: the inspector model caption wraps as "… 21,400 RSF ·" with "5,500 SF available" on the next line (block inspector at 1100–1440).
- `src/components/building/BuildingView.tsx:345`: the Building caption ends a line with "·" at 820 and 1024 by construction.
- `src/components/shell/Toolbar.tsx:71`: turning prospect-safe on moves the search field and Find space 107 px right.
- `src/components/map/MapView.tsx:188`: the floor-list swatch shows the dominant tone while the text names the soonest expiry. On the expiration lens, Floor 5 has a coral swatch with "expires Apr '27", and Floor 1 a pink swatch with "expires Feb '27".
- `src/components/building/floorFact.ts:126-130`: in the owner-mode Rent lens, the label's in-place rent replaces the asking rent and is not identified as in-place (Floor 12: "9,300 SF available · $36/SF/yr FSG" while asking is $38–$40).
- `src/components/timeline/TimelineRows.tsx:321-339`: at as-of 2029-07-01 the Floor 3 holdover tag and bar edge overlap "Argosy Partners". Expired Café and BeachBody bars lack "· vacated".
- `src/state/focusStore.ts:5-87` and `src/App.tsx:54,70`: direct `document` and `requestAnimationFrame` use contradicts the "one host adapter" claim and will not cross an LWC shadow root.
- Minor (synthetic timing only): in the Stack grid, ArrowDown immediately followed by Enter selected the previously focused block (URL `select=A08` while focus was on Halcyon).

## Round-15 fixes checked

**Landed:**
- **Prospect-safe PDF:** two pages, "Section n of 2", with the footnote on page 1.
- **Selected suite kept clear of the sheet:** checked at 390, 820 and 1024.
- **Lobby entry in the Building legend.**
- **Phone rows:** no "·" ends a line at 390.
- **Map list = Building list:** row by row, 8 combinations.
- **Floor 7 label:** reads "7,000 SF sublease available".
- **Finder:** stack-containing-option, maximum and no-fit wording all fixed.
- **KPI bar and toolbar boxes stay still on the safe toggle:** the lock and the sentence are in the as-of button's tooltip and description.
- **Undock:** the list is back in about 230 ms.
- **Floor 6 heading:** shows only name and size.
- **First keyboard open keeps focus:** checked with a delayed font.
- **Expiration L* steps:** at least 8 apart.

**Not fully landed:**
- "No separator ends a line": three cases remain (see U3).
- "Toolbar keeps its position": the box does, but its contents shift (see U4).
