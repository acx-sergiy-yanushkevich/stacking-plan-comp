# Round 15 · Judge: Claude Opus 5.5 (B) · KPI bar stability, Building floor list + dock frames, largest-block hover, prospect-safe across ~47 states, finder, phone/tablet/print/PNG; live build at :4180 driven with Playwright
UI 18/20 (U1 4.5, U2 5, U3 3.5, U4 2.5, U5 2.5) · UX 19/20 (X1 5, X2 3.5, X3 3.5, X4 3, X5 4) · Engineering 9/10

JUDGE: Claude Opus 5.5 (B)
ROUND: round-15

Method. I read BRIEF, DESIGN, COMPETITORS §4–7 and all round-15 shots and PDFs. Then I drove http://localhost:4180/ in Chrome through Playwright, with all scripts and scratch files under /tmp/r15-judges/b-work:
- **Geometry:** KPI bar and toolbar rects in 14 states at 1440 and 1024. Model, picker and pane rects plus their effective opacity on every animation frame while docking and undocking, at 1440, 1280 and 1024. Floor-label centre versus the model's floor band at four widths.
- **Keyboard:** the full Tab order, the floor list (↑ ↓ Home End Enter Esc), the Stack grid, KPI Enter then Esc, the as-of popover, and the timeline cursor with its live region.
- **Hover and theme:** pointing at the KPIs in five views; switching the palette live on the map.
- **Prospect-safe:** a text, attribute and SVG-title leak scan over about 47 safe states, plus toggling safe on live from five sensitive states.
- **Finder:** eight requirement edge cases.
- **Phone and tablet:** 390 px with touch, and 1024 px.
- **Repo checks:** `npm test` (580 passed) and `scripts/exportcheck.mjs` (all passed). `git status` was clean before and after.

I formed my scores before reading docs/judging/round-14.

UI SCORE
U1 Visual hierarchy & layout: 4.5/5:
- **What works.** The new KPI bar holds still. It sits at y=114 and is 55 px tall, with the toolbar at y=181, in all 13 non-safe states I measured at 1440: Building alone and docked, a suite selected with and without a floor, Stack, Stack with a selection, worklist, Timeline, Map, Floor, as-of 2028, and finder. With no floor open, the Building view gives the model and its one list the whole card. The hierarchy reads header → figures → toolbar → plan. With a floor open, the heading on Floor 8 is size only ("21,400 RSF leasable").
- **Deduction (−0.5): the labels are not level with their floors below 1440.** The labels keep a 24 px pitch while the model's floors shrink to 18.7 px at 1280 and 15 px at 1024. At 1024 the "12" label's centre is at y=450 while floor 12's band is 442–540. The "1" label sits at y=714, the bottom edge of floor 1's band (608–714). Each end drifts 40–50 px. At 1440 the pitches are 25.7 and 24.8 px and the labels do sit level.
- **Not a deduction: the heading repeats a card.** With Floor 6 open, the heading reads "21,400 RSF leasable · 21,400 SF marketed from Apr '27". The Available card directly under it says "0 SF / 21,400 SF marketed from Apr '27". The code comment claims "no card states it" (src/components/building/floorFact.ts:181), and floorFact.test.ts:134 pins the duplicate. This is the repetition the round set out to remove, but I fold it into the 0.5 above.
- **Not a deduction: the safe toggle moves the bar.** I take that under U4.

U2 Color & data encoding: 5/5:
- **Legends carry data.** Every legend item has SF and share, for example "Available (direct) 26,200 · 10.7%" and "Asking rent (vacancy) 33,200 · 13.5%".
- **Colour is never the only cue.** States carry their own pattern: dots for sublease, hatching for committed, dashed for vacant. Ramps carry a note: "Stronger colour = sooner expiry", "Stronger blue = higher rent".
- **Ramps.** The night expiration ramp runs pale yellow → orange → red → pink → steel blue → navy and reads in lightness order; the later steps are on brand blues. The rent ramp keeps NNN and MG off the gross scale.
- **Mark and palette.** The largest block is tagged in words: the "Largest block" badge on Ste 1250 in Stack, on the plate and on the floor-12 label. The map repaints the extrusions on a live Ascendix → Vice City switch (map-asc.png and map-vice.png): the round-14 stale-colour bug is fixed.
- **Exports.** The PNG keeps the dots and hatching on desktop and phone (exportcheck: Ste 720 has 4 colours with a spread of 97; Ste 450 has 25 colours with a spread of 74; a leased control is 1 flat colour).
- I found no colour-only encoding.

U3 Typography & density: 3.5/4:
- **What works.** The scale is consistent: 11 px KPI labels, 18 px figures and 12 px notes, with tabular figures. The Building labels are 13 px. Block text tiers never truncate a name: "Conner CPA Group" wraps to two lines, and "Preston Park Café" shrinks in the PDF. Rates stay with their lease type: "$31–$33/SF/yr FSG", "$34–$36/SF/yr NNN".
- **Deduction (−0.5): the Map view's floor list prints its facts at 10 px.** Measured on the desktop map: "50.0% leased" and "9,300 SF available" are 10 px, and the floor number is 12 px. This is the only per-floor list in that view, and it is below a readable size for a 1440 desktop where the same facts are 13 px in the Building view.

U4 Polish & platform fit: 2.5/3:
- **What works.** The glass skin is coherent in dark, light and Vice. Focus rings are clear (an orange 2 px ring on the floor label, focus-flabel.png). The selected floor is outlined in brand cyan on the model and in the picker. The undock has no overlap frames.
- **Deduction (−0.5): two states are not consistent.**
  - **Prospect-safe moves the bar.** Turning it on adds "Fixed to today in prospect-safe" under the as-of button (src/components/shell/AsOfPopover.tsx:40). The header grows from 90 to 103 px, which pushes the KPI bar and the toolbar down 13 px: toolbar y 180.6 → 193.8. The round promised the bar never moves.
  - **The floor list is blank for about 0.9 s after "Whole building".** The list is at opacity 0 for 0.9 s, still 0.80 at 969 ms after the click, while the model slides back (building.css:26 sets opacity 0 while is-moving, and DOCK_MS is 760).
  - **Pointing at a KPI does nothing to the Timeline.** On Timeline, pointing at "Largest block" or "Available" greys only the inspector's mini model; the timeline bars do not change (hover-timeline-Largestblock.png).

U5 Mobile & print visual quality: 2.5/3:
- **What works.** The phone at 390 px has no horizontal overflow (scrollWidth 390 in all eight phone states I loaded). The KPIs are a 3 × 2 grid. The timeline folds its rollover into "< 12 mo 35,300 SF · At risk 17,200 SF ⌄". The phone PNG works. The owner PDFs are three clean pages.
- **Deduction (−0.5): the prospect-safe PDF has an almost empty page 2.** prospect-safe-report.pdf is four pages for a report headed "Section 1 of 3". Page 2 carries only the plan footnote ("Floor width is proportional … are withheld."), with no running head. The rent roll follows on page 3.
- **Also: the phone sheet hides the selection.** Opening a suite (?view=stack&select=A02) parks Ste 350 half under the sheet's top edge, so its asking-rent line is cut by the sheet.

UI TOTAL: 18/20

UX SCORE
X1 Persona job coverage: 5/5:
All ten jobs are done in a click or two.
- **Vacancy by floor** (job 1): the Building list, for example "8 · 65.4% leased · 7,400 SF available".
- **Expirations** (2): the Expiration lens, and the "Expiring 12 mo" KPI goes straight to the 12-month worklist.
- **Trust** (3, 9): the issues count of 8, "1 record stale", the Floor 7 over-allocation note and the F2 data gap.
- **Finder** (4).
- **Identify and open** (5): the inspector shows the tenant, term, rent, broker, last touch and Field History.
- **Owner and prospect exports** (6): PDF, PNG and CSV, with a safe variant of each.
- **Direct, sublease, committed** (7): told apart in Stack, Timeline and PDF.
- **Time travel** (8): the timeline cursor (Shift+→ moves a year) recomputes the KPIs and announces "leased 71.7%, down 14.4 points".
- **Deal pipeline** (10): the Deals lens and its counts.
- **Phone:** the same jobs work through the stacked list and sheets.

X2 Interaction & IA: 3.5/4:
- **What works.**
  - Every KPI is a button with a clear action (Available → finder; Largest block → finder at req=9300; Expiring → expiry lens and 12-month worklist; WALT → timeline; Pipeline → deals lens).
  - Search has a filter bar and an empty state: "No tenant, suite or prospect matches 'zzzz'. Try a suite number…".
  - The finder:
    - It refuses a needed-by date before the as-of date with a message ("Jan 1, 2026 is before the as-of date…").
    - A sublease-only miss offers "Search any type".
    - Every option names its suites ("Ste 850 + Ste 860 on Floor 8, Ste 720 on Floor 7"). The round-14 subset rows are gone.
- **Deduction (−0.5): three rough edges.**
  - **A redundant finder alternative.** For req=12000, the only option is Floor 6 Ste 600 (21,400 SF). The Alternatives still list "Floors 6–7 · Ste 720 + Ste 600 · 28,400 SF". It is the option plus a sublease. With inquiry=I05 it is labelled "14,400 SF over max", which is noise. The `stack` rows are never checked against `covered` (src/domain/finder.ts:342-350 push them; the filter at :361 only removes `kind === 'short'` rows). That contradicts the interface comment at :420, "never a part of an option".
  - **Prospect-safe off does not restore state.** Toggling it on drops asOf, the expiry lens and the worklist, which is right. Toggling it off leaves them gone (?view=stack&asOf=2028-06-01 → on → off ends at ?view=stack&select=A05), so the broker has to rebuild the view after showing a prospect.
  - **The KPI hover is invisible in Timeline.** In that view it only lights the inspector's mini model (see U4).

X3 Trust & domain correctness: 3.5/4:
- **Figures check out.**
  - Leased: 211,200 / 245,400 = 86.06%, shown as 86.1%, with the cap explained.
  - Expiring 12 mo: 35,300 = 2,400 + 21,400 + 5,000 + 6,500 across 4 leases, 16.7% of leased.
  - Available: 33,200 = 26,200 direct + 7,000 sublease. The for-sale condo is kept out.
  - WALT: the tooltip gives 2.9776 yr and says how the card rounds it.
- **States:** holdover, MTM, committed, confidential ("Rent confidential") and lease without units ("Likely Delta Dental Plan") are each explicit.
- **Prospect-safe leaks nothing.** Across about 47 safe URLs, I scanned body text, title, aria-label, SVG titles and live regions for 20 tenants, 23 people, 8 prospects, in-place rents, the sublease end date and the listing price and cap rate. The only hits were the asking-rent band "FSG < $28", which is legitimate, and the property owner on the PDF cover. Live toggling from five sensitive states drops the inquiry, lens and worklist. WALT, Expiring and Pipeline read "Withheld" on screen and in print.
- **Deduction (−0.5): the Building floor list never says "sublease".** Floor 7's label and accessible name read "100.0% leased · 7,000 SF available" (src/components/building/floorFact.ts:26 `spaceOf` prints `f.available` with no type). A tenant rep reading the one list in the default view takes Ste 720 for direct space. The Map list's accessible name says "also: the space on offer is a sublease", so the two lists still differ on this fact.

X4 Accessibility of interaction: 3/3:
- **Keyboard and focus.**
  - The Tab order is logical: skip link, header, six KPIs, view tabs (one stop), lens (one stop), search, Find space, Worklist, then the floor list (one stop).
  - In the floor list, ↑ ↓ Home End move and Enter opens. Focus stays on the Floor 8 button through the dock, and Esc closes the floor and keeps focus there.
  - The Stack grid moves with arrows, Enter selects, and ←← reaches the floor header.
  - Esc returns focus to the KPI that opened the finder or worklist (round-14 bug fixed).
  - The as-of popover focuses "Today", and Esc returns to the button.
- **Screen readers.**
  - KPI names hold the whole note, for example "Available 33,200 SF 26,200 direct · 7,000 sublease · +21,400 Apr '27".
  - Floor-label names include "largest block".
  - The timeline slider has a valuetext, and a polite live region announces the KPI change.
- **Motion.** Under reduced motion the dock jumps from one position to the other with no frames between.
- **Nit, no deduction:** the phone sheet handle is 390×16 px. It passes the 2.5.8 spacing exception, but a 24 px-high handle would be kinder.

X5 CRM workflows & differentiation: 4/4:
- **Pipeline and demand.** Deals lens with stages; "Who is looking": the finder ranks options by fitting inquiries, with "1 inquiry fits · 2 live deals".
- **Activity and history.** Last-touch badges ("Call 40 d", "No activity", "Tour 25 d"). The inspector's Changes list from Field History ("Term Expiration Date Jun 30, 2027 → Mar 31, 2027 · Elena Ruiz").
- **Record actions.** Pre-filled actions ("New deal on Floor 6", "Log call with Cirrus Energy (expires Mar '27)", "Create availability").
- **Stale-record trust.** "1 record stale".
- **Exports and privacy.** A prospect-safe PDF, PNG and CSV that hold up under a leak scan. None of VTS, CoStar, Yardi or Prophia offers this combination (COMPETITORS §4–5).

UX TOTAL: 19/20

ENGINEERING (informational): 9/10:
- **Tests and checks.** All 580 tests in 43 files pass in 2.1 s. `src/domain` is pure TypeScript with tests beside each module (finder.test.ts alone is 553 lines). `exportcheck.mjs` tests the real PNG pixels for patterns and the CSV for leaks on desktop and phone. That is the right level for things unit tests cannot see.
- **Structure.** State is URL-synced and drops safe-incompatible params centrally. All floor-label wording comes from one module (floorFact.ts), so the texts cannot drift, though that module still misses "sublease". The dock is a FLIP built on `element.animate`, which ports to LWC.
- **Lost points.** The `stack` alternatives skip the `covered` filter their own doc comment promises (finder.ts:342-361), and a test pins the duplicated Floor 6 heading as intended (floorFact.test.ts:134). MapLibre, Inter and the glass `backdrop-filter` will need work in an LWC shadow-DOM port.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. **Keep the floor labels level at every width (+0.5 U1).**
   - In BuildingHero.tsx, return each floor's projected right-edge mid-y in `fit.ladder`.
   - In BuildingView.tsx, absolutely position each `.sp-flabel` at that y (translateY), so the list's pitch follows the model's, instead of a flex column of 24 px rows.
   - When the model's floor pitch is under 22 px (≤1280), drop the model's height or move the list under the model, which the code already does for `is-under`, rather than letting the labels drift.
   - Add a Playwright check that |label centre − floor right-edge mid-y| ≤ 8 px at 1024, 1280, 1440 and 1920.
2. **Fix the prospect-safe PDF's empty page (+0.5 U5).** In src/components/print/PrintLayout.tsx and print.css, put the plan footnote inside page 1's container with `break-inside: avoid`, or shrink the plan by the footnote's 2 lines in safe mode, where the legend is shorter. Assert in scripts/pdf.mjs that each report has exactly 3 pages.
3. **Do not move the bar on the safe toggle (+0.25 U4).**
   - Show "Fixed to today in prospect-safe" as the as-of button's tooltip and accessible description instead of a second line under it (AsOfPopover.tsx:40), or reserve that line's height always.
   - Assert in the stability test that the toolbar y is identical with safe=1.
4. **Show the floor list while the model slides back (+0.25 U4).** In building.css:26 / BuildingView.tsx:184, fade `.sp-flabels` in over the last 30% of the undock (as the picker does on dock, line 200) instead of holding opacity 0 until `moving` clears.
5. **Make the map floor list readable (+0.5 U3).** In map.css, set the floor list's fact text to 12 px (the floor number to 13 px). If width is the issue at ≤1280, wrap the fact to a second line rather than shrinking it.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. **Say "sublease" on the Building floor list (+0.5 X3).**
   - In src/components/building/floorFact.ts:26, build `spaceOf` from the floor's segments: "7,000 SF sublease available" when all of it is sublease, and "4,000 SF available (1,000 sublease)" when mixed.
   - Use the same helper in `floorLabel` and `floorFact`, so the map and Building lists agree.
   - Update floorFact.test.ts with a Floor 7 case.
2. **Stop offering an option back as an alternative (+0.25 X2).** In src/domain/finder.ts `nearMisses` (:342-361), drop a `stack` row when either floor's spaces alone already make an exact option (`covered.some(keys => keys.every(k => m.keys.includes(k)))`). Also drop it when one floor's own total meets `req`. Add a test: req=12000 has no "Floors 6–7" alternative.
3. **Restore the owner view after prospect-safe (+0.25 X2).** In src/state/planState.ts, stash the dropped params (asOf, lens, mode, window, inquiry, bucket, q) in a ref or sessionStorage when safe turns on, and restore them when it turns off. Then turning safe off after a prospect meeting returns the broker to the 2028 expiry worklist they had open.
4. **Make the KPI hover visible in Timeline (+0.25 X2).** In TimelineRows.tsx, read the same hover store as StackView, and dim bars whose segKey is not in the lit set. Taking the Largest block hover as an example, only Ste 1250's bar stays full strength.
5. **Remove the heading duplicate (polish).** In floorFact.ts:178-186 `floorHeading`, drop the "marketed from" phrase, because the Available card already prints it. Fix the comment at :181 and the expectation at floorFact.test.ts:134.

BUGS (with file:line):
- **The finder offers its own option back as an alternative.** src/domain/finder.ts:342-350 push `stack` alternatives with no check against `covered`; the filter at :361 only drops `kind === 'short'`. Repro: ?view=stack&mode=find&req=12000 → Options: "Floor 6 Ste 600 21,400 SF"; Alternatives: "Floors 6–7 · Ste 720 on Floor 7, Ste 600 on Floor 6 · 28,400 SF". With inquiry=I05 the same row reads "14,400 SF over max". This contradicts the doc comment at finder.ts:420 ("never a part of an option").
- **The Building floor list never says "sublease".** src/components/building/floorFact.ts:26 `spaceOf` omits the space type: Floor 7 reads "100.0% leased · 7,000 SF available" (label and aria-label). The Map list's accessible name says "the space on offer is a sublease".
- **The Floor 6 heading duplicates the Available card.** src/components/building/floorFact.ts:178-186 (comment :181 says "no card states it"): with Floor 6 open, the heading's "21,400 SF marketed from Apr '27" is printed again in the Available card directly below it.
- **Prospect-safe moves the KPI bar and toolbar 13 px.** src/components/shell/AsOfPopover.tsx:40 adds a second header line. Repro: ?view=stack, toggle Prospect-safe → toolbar y 180.6 → 193.8.
- **The prospect-safe PDF has an almost blank page 2.** docs/shots/round-15/pdf/prospect-safe-report.pdf is 4 pages for 3 sections; page 2 carries only the footnote (src/components/print/PrintLayout.tsx, print.css:8).
- **Minor: the floor labels drift off their floors below 1440.** At 1024×768, label "12" has its centre at y=450 against floor 12's band 442–540, and label "1" at y=714 sits at the bottom edge of floor 1's band (608–714). The label pitch is 24 px against a floor pitch of 15 px (BuildingView.tsx / building.css .sp-flabels).
- **Minor: the floor list is blank for about 0.9 s on undock.** building.css:26 holds `.sp-flabels` at opacity 0 until `moving` clears (BuildingView.tsx:184, DOCK_MS 760).

Round-14 fixes checked:
- **Landed:**
  - The KPI strip and toolbar no longer move between Building states.
  - No frame where the dock overlaps the picker or pane: I sampled every rAF at 1024, 1280 and 1440 and found no overlap while the other element is visible.
  - Focus returns to the KPI on Esc.
  - In prospect-safe, the inquiry is dropped and the Expiration lens is hidden.
  - A needed-by date before as-of is refused.
  - Finder subset rows are gone and options name their suites.
  - The no-fit advice matches the inputs.
  - The map repaints on a palette change.
  - The PNG keeps its patterns and exports on a phone.
  - The phone rollover folds.
  - The Asking-rent legend shows its share.
  - "Tenant (sublandlord)" is gone from the safe rent roll.
- **Not landed, and partly regressed:** round-14 asked for a tighter prospect-safe PDF. It is now four pages, one of them nearly empty.
