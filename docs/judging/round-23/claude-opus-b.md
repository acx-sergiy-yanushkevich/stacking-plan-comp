JUDGE: Claude Opus 5.5 (B)
ROUND: round-23

UI SCORE
U1 Visual hierarchy & layout: 5/5: The order is the same in every view and in all four buildings: product bar, building card, the "Color by" and "Details" KPI groups, toolbar, then the plan with the inspector beside it. Nothing competes with the plan.
  - The 22-floor Legacy West tower draws all 22 floor labels with leader lines and no overlap (61). At 1280×720 the tower scrolls instead of squashing.
  - Cedar Springs (62) and Bluebonnet (63) fit the same layout with no special cases.
  - Switching buildings drops the selection, search and panel. Measured live: from `?select=L13-U1&q=Cirrus&mode=block` the switch gave `?building=P002&view=stack`, and focus went back to the switcher.
  - One nit: the Map camera uses a fixed zoom (`src/components/map/useMapLibre.ts:59`). The 4-floor Bluebonnet building is therefore a small shape in a large dark canvas (63).

U2 Color & data encoding: 4.5/5: Color is never the only cue. Sublease has dots and signed-not-yet-in has a hatch. Gaps are dashed. Holdover and MTM carry tags, and Confidential, Quiet and "Largest block" are badges. The Pipeline legend's "Lease drafted" swatch is now hatched as the suite is drawn (02). The prospect Rent legend now reads Occupied · Signed, not yet in · Not on the market (58). Bands with no space are left out, so a prospect sees "Gross < $28, $31–33.99, $38+" with gaps between the bands. Half a point off for two things:
  - **Prospect Leasing legend does not match the plan.** It labels the 5,400 SF gap "Not available" with a solid gray swatch (`src/domain/lenses.ts:215`). The block itself is drawn dashed, titled "5,400 SF not available" and subtitled "Not on the market" (`src/components/plan/segmentText.ts:160`, shot 10, prospect PDF cover). The Rent and Expiration legends call the same space "Not on the market" (`src/domain/lenses.ts:240`, `:288`), so a prospect sees two names and two swatches for one thing.
  - **Expiration ramp flips with the theme.** The most urgent step is the palest color in dark (01, 59) and the darkest in light (53).

U3 Typography & density: 4/4: Figures are tabular. RSF is exact everywhere. Every rate carries its unit and lease type ("$34–$36/SF/yr NNN", "$4.10/SF/mo NNN" basis on Cedar Springs).
  - Long names wrap instead of truncating in the Stack, the phone list and the PDF: "North American Asset Holdings", "Maple Avenue Advisors", "Frontier Private Bank".
  - The prospect "Signed, not yet in" block no longer repeats itself with a second badge (10).
  - Legend tooltips now wrap inside a 320 px box.
  - Small nit: in Find mode, Ste 350's "Available now" wraps to two lines beside "2 inquiries fit" and the count badge (60).

U4 Polish & platform fit: 2.5/3: The glass skin holds in dark, light and Vice, and the new buildings look native.
  - **Tooltips (verified live).** I focused every entry of 8 legends (77 entries, Map, Building, Stack and Timeline, 1024–1440 px). Each tooltip was fully visible, inside the window and inside its box, and the page never grew wider. Right-half entries hang from the right edge. That fixes the round-22 Lobby overflow.
  - **ⓘ note behavior.** It keeps focus, and Escape returns focus to the ⓘ.
  - **Switcher.** Sample rows are `aria-disabled`, but they are only slightly dimmer (rgb 197,208,220 against 245,248,251).

  Half a point off: the Map ⓘ note is still cut off at common laptop widths. `LegendInfo` always opens its popover from the left edge (`src/components/plan/Legend.tsx:122`). `Popover` only shifts the panel into the window (`src/components/ui/Popover.tsx:63-71`), but `.sp-map { overflow: hidden }` (`src/components/map/map.css:10`) clips it at the card edge. Measured with `elementFromPoint` over the open note, share hidden:

  | Map lens | 1100 px | 1180 px | 1280 px | 1366 px | 1440 px |
  |---|---|---|---|---|---|
  | Pipeline | — | 68% | 38% | 15% | 0% |
  | Rent | 33% | 9% | — | — | 0% |
  | Leasing | 27% | — | — | — | 0% |
  | Expiration | 21% | — | — | — | 0% |

  At 1280 px the Pipeline note reads "Steps run from the deal furthest a…".

U5 Mobile & print visual quality: 3/3: All three round-22 phone deductions are fixed, checked live at 390 px with touch:
  - The phone Timeline's opened legend has its ⓘ.
  - The ⓘ is 18 px with a 44 px `::after` hit area on coarse pointers (`src/components/plan/plan.css:69`).
  - The note is 0% hidden on the phone Stack, Timeline, Map and Building views.
  - `npm run a11y` is clean on 6 phone states, including the worklist and finder states that failed badge contrast in round 22.
  - Legacy West on a phone has no horizontal scroll (docW 390).

  The PDFs are presentation-grade: owner 4 sections, prospect 3, full legend figures, and the shares note. The prospect footnote now says "signed-not-yet-in rows".

UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 4.5/5: Todd's round-22 complaint is mostly answered. The one box now routes a requirement to Find space:
  - "12000 sf", "12-15k" and "12k by 6/2027" each produce "That reads as a space requirement…" with a "Find 12,000 SF of space" button.
  - Enter on "12k direct by jun 2027" gives `req=12000&by=2027-06-30&fit=direct&mode=find`, with focus on the Find space heading. Result: Floor 6 Ste 600 from Apr 2027, plus "Ste 850 + Ste 860 … 4,600 SF short".
  - "sublease", "signed", "for sale", "available", "mtm" and "holdover" light their states. The no-match message suggests a suite, a floor or a size.

  Four buildings now open with real data, and all 10 jobs can be done in each. Half a point off for two gaps a tenant rep or Todd hits at once:
  - **The finder only pairs two floors** (`src/domain/finder.ts:189-214`; alternatives `:357-368`). On Legacy West, `req=60000` returns "No space fits 60,000 SF", although floors 18, 19 and 20 are 78,000 SF of contiguous direct space available now. This is a headquarters requirement in exactly the tower added this round.
  - **The date is read only when it ends the query** (`src/domain/query.ts:86-90`). Todd's own phrase, "20k contiguous SF, Q2, direct", reads as "20,000 SF direct" and drops Q2. So do "15k sublease in Q2" and "12k by jun 2027 direct". Nothing says a word was not read.

X2 Interaction & IA: 4/4: Search and Find space are now one flow. The bar says what it understood, offers the tool, and Enter runs it. The search box clears and the panel opens with the fields filled. Other checks:
  - The Pipeline block now reads "Lease drafted · Lumen Analytics", matching the legend and the Building label.
  - Find space refuses an inverted range: Max SF is marked invalid, with "Fix the range to see the space that fits" and nothing lit (60).
  - Building switching is clean: selection, search and mode are dropped, and focus returns to the switcher.
  - A prospect typing "holdover" or "mtm" gets the neutral "No suite or floor matches".
  - The ⓘ opens on Enter or Space, and Escape or a click outside closes it.
  - URL state still drives every view, and the KPIs work as navigation.

X3 Trust & domain correctness: 3.5/4: The numbers reconcile.
  - **Legends.** The prospect Rent legend now agrees with the 86.1% KPI: Occupied 196,700 (80.2%), Signed 8,000 (3.3%), Not on the market 5,400 (2.2%) (`src/domain/lenses.ts:184-188`, `:286-288`). The screen KPI says "57,800 SF in play … (the deals request 75,800 SF in all)".
  - **Leak checks.** `npm run leakcheck` timed out on `networkidle` (Google Fonts loads took 17 s). Rerun from a `/tmp` copy with fonts blocked, it reports "0 leaks" over 407 checks. That script only reads names from `src/data/mock/property.ts`. My own scan of P002, P005 and P007 in prospect-safe mode found no tenant, contact, broker, prospect, in-place rent or lease term. It covered 58 page states, including every floor and the print layout, selected every one of 134 blocks, and checked 86 names in text, aria-label and title.

  Half a point off:
  - **Under contract shown as for sale.** Cedar Springs is under contract (`src/data/mock/buildings/cedarSprings.ts:134`, `status: 'Under Contract'`). The header shows "For sale $92,000,000 · $504.94/RSF · 5.8% cap", the prospect is told "Listed for sale", and the print cover repeats it. `src/components/shell/Header.tsx:151-161` and `src/components/print/PrintLayout.tsx:101` never read `status`, which appears only in a tooltip. A buyer calling about it would be misled; this is Wes's demo embarrassment.
  - **Owner PDF still says "requested".** It prints "Pipeline 9 deals · 57,800 SF requested" (`src/components/print/PrintLayout.tsx:119`), the round-22 wording the screen fixed. The deals request 75,800 SF.
  - **One lease, two states.** Lumen's lease is signed and not yet commenced, yet the Pipeline lens calls it "Lease drafted · Lumen Analytics" beside a "Signed, not yet in" badge (02). `topDeal` counts Lease Out only on a committed lease (`src/domain/lenses.ts:76`), so the legend's "Lease drafted" entry (`:266`) can only ever hold signed space.

X4 Accessibility of interaction: 3/3: `npm run a11y` reports 0 serious or critical issues on 22 states (16 desktop, 6 phone). The legend is a named group. Every entry is a tab stop whose name includes its SF and share. The ⓘ is a real dialog button that moves focus in and back out. The phone ⓘ has its 44 px hit area, and "Issues 8" is named by its words. The plan stays a keyboard grid with "Skip to plan". The remaining costs are small:
  - The Leasing legend adds 9 tab stops before the first block, and Expiration adds 12.
  - At 1180–1366 px the Pipeline Map note takes focus while partly clipped (scored under U4).

X5 CRM workflows & differentiation: 4/4: This is clearly CRM-native, now across a portfolio:
  - deal stages on each vacancy and renewal, plus a Pipeline lens;
  - open inquiries matched to space ("2 inquiries fit"), and an inquiry picker in Find space for each building;
  - activity recency on blocks ("Call 48 d", "No activity");
  - quiet listings kept from prospects (Cedar Springs Ste 850 shows as "not available");
  - field history in the inspector ("Term Expiration Date Jun 30, 2027 → Mar 31, 2027");
  - verified stamps, Data issues with fix actions, a CSV worklist, and a client-ready location brief.

  None of the tools in COMPETITORS §4–§7 combines these.

UX TOTAL: 19/20

ENGINEERING (informational): 9/10: The vitest suite passes: 65 files and 909 tests, run in a `/tmp` copy with `--cache=false`. a11y now covers phone states. Withholding is still centralized in `src/domain/safe.ts`, and the query reader is a small, pure, tested module (`src/domain/query.ts`). The building kit makes the three new data sets cheap and consistent. One point off for three things:
  - The leak check builds its name list from `src/data/mock/property.ts` only (`scripts/leakcheck.mjs:23`), so three of the four buildings that open have no automated leak coverage.
  - Multi-floor fits are hard-coded as adjacent pairs in two places (`src/domain/finder.ts:189-214`, `:357-368`) instead of one N-floor run search.
  - The domain models `SaleListing.status`, but nothing renders it.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Keep the Map ⓘ note inside the map card. Two options:
   - In `LegendInfo` (`src/components/plan/Legend.tsx:122`), pass `align="end"` when the trigger's left edge is past half the legend's width, the same test `Entry` uses at `src/components/plan/Legend.tsx:90-91`.
   - Or make `Popover`'s layout effect (`src/components/ui/Popover.tsx:63-71`) shift into the nearest `overflow: hidden` ancestor's rect, not only the window.

   Verify at `?view=map&lens=deals` at 1180, 1280 and 1366 px, and `?view=map&lens=rent` at 1100 px, that the whole note is visible. Expected +0.5 U4.
2. Give the prospect one swatch and one name for unrecorded space:
   - in `statusTone` (`src/domain/lenses.ts:142-144`), return `'empty'` for `unmarketed` in prospect-safe mode as well;
   - change the safe Leasing legend entry at `src/domain/lenses.ts:215` to `{ tone: 'empty', label: 'Not on the market', pattern: 'dashed' }`;
   - title the block `${sf(seg.size)} not on the market` at `src/components/plan/segmentText.ts:160`.

   The plan, all three prospect legends and the PDF cover then agree. Expected +0.25 U2.
3. Fit the Map camera to the building. In `src/components/map/useMapLibre.ts:59`, compute the zoom from the footprint's bounds and the building's height (`map.fitBounds` on the footprint with about 35% padding, then apply `CAMERA.pitch` and `CAMERA.bearing`). The 4-floor Bluebonnet then fills the view the way Preston Park does. Expected: polish toward U1/U4.
4. Make the legend one tab stop. Use roving `tabIndex` on the entries (`src/components/plan/Legend.tsx:96`): 0 on the focused entry, −1 on the rest, ←/→ to move, Home/End for the ends. The ⓘ stays its own stop. This removes 8–11 stops before the plan. Expected +0.25 U4 (and X4 headroom).
5. Keep the Expiration ramp's direction in both themes. In `src/styles/ascendix.css`, order the dark-theme `--tone-exp-0…5` fills so that "< 6 mo" is the strongest, most saturated step in both themes, as it is in light (53). Then the 5+ yr end is the quietest everywhere. Expected +0.25 U2.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Say "Under contract".
   - In `src/components/shell/Header.tsx:151-161`, when `saleListing.status !== 'Active'`, owner mode reads "Under contract · $92,000,000 · $504.94/RSF · 5.8% cap" and prospect mode reads "Under contract" instead of "Listed for sale".
   - Do the same in `src/components/print/PrintLayout.tsx:101`.
   - Add a Header test for `P005`.

   Expected +0.5 X3.
2. Find stacked floors of any height. Replace the pair loops in `src/domain/finder.ts:189-214` and `:357-368` with one window over adjacent floors' best runs: grow it from each floor while the total is under `req`, up to 4 floors. Label it "Floors 18–20 · three floors". Add a `finder.test.ts` case: Legacy West, `req=60000`, returns Floors 18–20, 78,000 SF, Direct, Now. Expected +0.5 X1.
3. Read the date anywhere in the query, and say what was not read. In `src/domain/query.ts:86-90`:
   - match a date token wherever it appears, with an optional "by", "before", "in" or "for" before a quarter, a month with or without a year, `m/yyyy` or an ISO date;
   - cut out only that token;
   - accept "Q2" with no preposition;
   - return `unread: string[]` for leftover words other than "contiguous", "space", "sf" and "of", and show "Not read: “…”" in the FilterBar.

   Test "20k contiguous SF, Q2, direct" → 20,000 SF direct by Jun 30, 2027. Expected +0.25 X1, +0.25 X2.
4. Use one pipeline figure in print. In `src/components/print/PrintLayout.tsx:119`, change the note to `${sf(k.pipeline.sf)} in play`, and add the screen's detail line to the PDF footnote: "each space once at its largest live deal; the deals request 75,800 SF in all". Expected +0.25 X3.
5. Name a signed lease as signed in the Pipeline lens. Only a committed lease can reach `deal-3` (`src/domain/lenses.ts:76`), so:
   - relabel that legend entry "Lease signed" (`src/domain/lenses.ts:266`);
   - in `src/components/plan/segmentText.ts:189`, print "Signed · Lumen Analytics" when `seg.kind === 'committed'`.

   The block then stops saying both drafted and signed. Expected +0.25 X3.

BUGS (with file:line):
- `src/components/shell/Header.tsx:151-161` and `src/components/print/PrintLayout.tsx:101`: `saleListing.status` is ignored. Cedar Springs (`src/data/mock/buildings/cedarSprings.ts:134`, `'Under Contract'`) shows "For sale $92,000,000 · $504.94/RSF · 5.8% cap" to the owner, "Listed for sale" to a prospect, and the same on the print cover.
- `src/domain/finder.ts:189-214` and `:357-368`: multi-floor options and alternatives are adjacent pairs only. On Legacy West, `?building=P002&view=stack&req=60000&mode=find` gives "No space fits 60,000 SF" although floors 18–20 are 78,000 SF of contiguous direct space available now.
- `src/domain/query.ts:86-90`: the `by …` capture takes everything to the end of the string, so any word after the date drops it silently. "12k by jun 2027 direct" reads as "12,000 SF direct". "Q2" or "in Q2" without "by" is ignored ("20k contiguous SF, Q2, direct" reads as "20,000 SF direct").
- `src/components/plan/Legend.tsx:122` with `src/components/map/map.css:10`: the Map ⓘ popover always opens from the left edge, and `.sp-map { overflow: hidden }` clips it. Share hidden: Pipeline 68% at 1180 px, 38% at 1280 px, 15% at 1366 px; Rent 33% at 1100 px, 9% at 1180 px; Leasing 27% and Expiration 21% at 1100 px.
- `src/components/print/PrintLayout.tsx:119`: the owner PDF prints "57,800 SF requested", while the screen says "57,800 SF in play" and the deals request 75,800 SF.
- `src/domain/lenses.ts:215` with `src/components/plan/segmentText.ts:160`: the prospect Leasing legend and PDF cover show "Not available" with a solid swatch. The block is dashed and says "Not on the market", as do the Rent and Expiration legends (`src/domain/lenses.ts:240`, `:288`).
- `src/domain/lenses.ts:266` with `src/components/plan/segmentText.ts:189`: a signed, committed lease is shown as "Lease drafted · Lumen Analytics" beside its own "Signed, not yet in" badge.
- `scripts/leakcheck.mjs:23`: leak-check names come only from `src/data/mock/property.ts`. Legacy West, Cedar Springs and Bluebonnet are not checked. My manual scan found no leaks in them.
- `scripts/leakcheck.mjs` (as run by `npm run leakcheck`): `page.goto(…, { waitUntil: 'networkidle' })` times out when Google Fonts is slow. Two runs failed at `?view=map&safe=1&mode=area&asOf=2027-02-09` and at `?view=stack`. A `/tmp` copy that aborts font requests passes with 0 leaks.
