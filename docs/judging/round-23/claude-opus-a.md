JUDGE: Claude Opus 5.5 (A)
ROUND: round-23

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: Every view keeps the same order: product bar, building card, KPI bar ("Color by" | "Details"), toolbar, then the plan with its panel. All four buildings keep it too (61, 62, 63).
  - The 22-floor Legacy West tower fits the Building view, with a leader-lined label for every floor (61).
  - At 1024 px its floor picker lists all 22 floors beside the Floor 16 plate (checked live).
  - Cedar Springs (8 floors) and Bluebonnet (4 floors) read as cleanly as the default building.

  Half a point off for wraps that still look accidental:
  - At 1440 px the Expiration legend wraps "For sale" alone onto a second row, in both the Stack and the Map (53, 59). Shortening the label from "For sale (no lease term)" was not enough.
  - At 1024 px a building with no sale listing (Legacy West) still leaves "✓ Latest change Nov 8, 2026" alone on the card's second line. The new `.sp-header__tail` group only helps when a listing is there to travel with it.
U2 Color & data encoding: 4.5/5: Color is never the only cue: sublease dots, the hatch on "Signed, not yet in", dashed space with no record, the Holdover and Month-to-month words, the "Largest block" tag, the Confidential tag.
  - The Lease drafted swatch is now hatched like the suite it keys (02).
  - Prospect-safe Rent's legend reads "Occupied · Signed, not yet in · Not on the market", the same figures as the KPI (58).
  - The owner's Rent legend gains its own dashed item for space with no record.

  Half a point off:
  - The Expiration ramp still changes hue and direction by theme. In dark, "< 6 mo" is pale yellow `#ffe07c` and "5+ yr" is navy (`src/styles/ascendix.css:60-65`). In light, "< 6 mo" is dark rust `#9c3b18` (`src/styles/tokens.css:49`) (53 vs 59).
  - In the Pipeline lens, LOI, Proposal and Tour are three neighboring oranges and browns; only the block text tells them apart (02).
U3 Typography & density: 4/4: Tabular figures everywhere. No name is truncated across the four buildings: "North American Asset Holdings", "Kessler & Pratt CPA" and "Maple Avenue Advisors" wrap whole. Every rate carries its unit and lease type ("$4.10/SF/mo NNN" style rates appear in the rent roll). Prospect blocks no longer repeat "Signed, not yet in" as both title and badge (58). One nit: in Find mode, "Available now" on Ste 350 breaks into two lines under the "2 inquiries fit" badge (60).
U4 Polish & platform fit: 2.5/3: The round-22 tooltip bug is fixed. I hovered every legend entry in the Stack, Building, Timeline and Map views at 1024, 1280, 1440 and 1920 px, in dark and light, and hit-tested each tip with pointer events on: every tip was fully visible and on top, with 0 failures. On Preston Park at 1440 px, the Map ⓘ note now opens above the map and the floor list.

  Half a point off: the note is now clipped by the map card instead. The card has `overflow: hidden` (`src/components/map/map.css:10`), and the panel always hangs rightward from the ⓘ (`src/components/ui/ui.css:103`).
  - On Legacy West's Map at 1440 px (Leasing), the panel spans x 983–1323 but the card ends at x 1052. The note reads "Each sha… / add up t…" (scratch screenshot).
  - On Preston Park's Map at 1920 px (Expiration), the right third of the note is cut off.
  - Wes demos the new tower on the Map and the note can't be read.
U5 Mobile & print visual quality: 2.5/3: On a phone:
  - Tapping the phone Timeline's ⓘ opens a fully visible note (verified at 390 px).
  - Dimmed phone rows keep full-contrast badges, and axe found 0 issues in 8 phone states.
  - "Issues 8" is named by its words.
  - The PDFs are still presentation-grade: "Signed, not yet in" throughout, a dash for withheld rent, and the location brief last.

  Half a point off:
  - The round's headline feature breaks on a phone. At 390 px, typing "12k direct by jun 2027" squeezes the bar's sentence into a 7-line column, pushes "Clear" past the screen edge and widens the page to 402 px, so it scrolls sideways (scratch screenshot `ph-search-size.png`).
  - The owner PDF still prints the Pipeline card as "57,800 SF requested".
  - The owner PDF's subtitle leaves "6.4% cap" alone on a second line.
UI TOTAL: 18/20

UX SCORE
X1 Persona job coverage: 4.5/5: All ten jobs can be done, and the search box now passes Todd's first test.
  - "12000 sf", "12-15k" and "20k direct by Q2 2027" each offer Find space. Enter turned the last one into `req=20000&by=2027-06-30&fit=direct&mode=find`: 1 option, with focus on the Find space heading.
  - "sublease", "mtm", "signed" and "condo" each light the right suite.
  - Four buildings open, each with its own figures.

  Half a point off: Legacy West has three vacant, direct floors stacked together, available now: Floors 18–20, 78,000 SF. Its own records hold Granite Peak's 60,000 SF proposal and a 50,000–78,000 SF inquiry for that block.
  - Find space for 60,000 SF answers "No space fits 60,000 SF… The largest block available now is 26,000 SF on Floor 20".
  - The Granite Peak inquiry is offered only 52,000 SF two-floor pairs.
  - The cause: the finder combines only two adjacent floors (`src/domain/finder.ts:189-214`).
  - Todd's literal phrasing "20k contiguous SF, Q2, direct" silently drops "Q2", because only "by …" dates are read (`src/domain/query.ts:86`).
X2 Interaction & IA: 3.5/4: The search box and Find space are now one flow, and the bar shows what it understood: "That reads as a space requirement: 12,000 SF direct by Jun 30, 2027".
  - Switching building keeps the view, lens and date, drops the selection, search and panel (`?building=P005`), returns focus to a switcher named "Switch building: Cedar Springs Exchange", and announces the new KPIs.
  - A maximum below the minimum marks Max SF invalid, says "Maximum must be at least 12,000 SF." and searches nothing.

  Half a point off:
  - The size path can't be discovered: the box is still labeled "Find tenant, suite or prospect" (`src/components/shell/toolbarRules.ts:16`).
  - A state word works only when it is the whole query (`src/domain/query.ts:82`). "available space" and "subleases on floor 7" return "No tenant, suite or prospect matches".
  - "15k-12k" reads as "15,000 SF" and drops the 12k.
  - The phone bar and the Map note are broken (U4, U5).
X3 Trust & domain correctness: 3.5/4: I reconciled Cedar Springs by hand from its records:
  - Leasable is 182,200 SF.
  - Leased is 142,700 SF, or 78.3%. Occupied is 116,700 SF, or 64.1%, which leaves out the vacant 11,000 SF sublease and the future lease.
  - Available is 29,200 direct + 11,000 sublease = 40,200 SF.
  - Expiring 12 mo is 7,000 + 6,200 = 13,200 SF, 9.3% of leased.
  - The rollover buckets plus at-risk add up to 142,700 SF, the leased figure.
  - Pipeline is 3 deals and 19,500 SF; the Lease Out deal on a closed availability is left out.
  - Prospect-safe mode drops the unpublished Ste 850: Available 29,000 SF, Largest block 9,000 SF on Floor 6.

  Leak checks: `npm run leakcheck` reported 407 checks and 0 leaks, but it covers only Preston Park. My own check of 39 prospect-safe states across the three new buildings looked for 89 names (tenants, contacts, brokers, prospects) and every in-place rent, and found 0 leaks.

  Half a point off:
  1. Cedar Springs' listing is "Under Contract" (`src/data/mock/buildings/cedarSprings.ts:134`). The header still says "For sale $92,000,000 · $504.94/RSF · 5.8% cap" (`src/components/shell/Header.tsx:157-160`), a prospect sees "Listed for sale", and the PDF says the same (`src/components/print/PrintLayout.tsx:101`). The status shows only in a hover title.
  2. The owner PDF still prints "57,800 SF requested" (`src/components/print/PrintLayout.tsx:119`). That is the label this round retired on screen, because the deals actually request 75,800 SF.
  3. "One name" is still four:
     - The block says "5,400 SF not listed · No lease or availability" (`src/components/plan/segmentText.ts:157-158`).
     - The issue says "…is unaccounted for · No lease or availability covers this area" (`src/domain/issues.ts:94-95`).
     - The Map label says "not listed" (`src/components/map/mapStyle.ts:66`).
     - A prospect's default Leasing legend and PDF say "Not available" (`src/domain/lenses.ts:215`), while their Rent and Expiration legends say "Not on the market".
  4. Searching "available" lights 5 suites, 26,200 SF (`src/domain/query.ts:24`), right under a KPI that says Available 33,200 SF, which includes the 7,000 SF sublease.
X4 Accessibility of interaction: 2.5/3: Better than round 22:
  - The legend is a named group ("Expiration legend").
  - "Issues 8" is named by its words.
  - Dimmed phone badges pass contrast.
  - The ⓘ has a 44 px hit area on touch.
  - Focus lands on the Find space heading after Enter.
  - My extended axe run (WCAG 2.2 AA) found 0 violations in 31 states: 23 desktop states, including the new buildings, the size search, a state-word search, prospect-safe Rent and the refused range, plus 8 phone states. The repo's `npm run a11y` timed out waiting for network idle, so I ran an adapted copy without that wait.

  Half a point off:
  - At 390 px the size-search state forces a 402 px page that scrolls sideways (WCAG 1.4.10 Reflow). axe does not catch this.
  - On Legacy West at 1440 px and Preston Park Expiration at 1920 px, the Map ⓘ moves focus into a dialog that is largely clipped (WCAG 2.4.11 Focus Not Obscured).
  - The text-only note now swallows Tab (`src/components/ui/Popover.tsx:94-97`). It is a non-modal `role="dialog"` with no `aria-modal` that behaves like a modal.
X5 CRM workflows & differentiation: 4/4: Each new building carries what only a CRM knows:
  - Deals on vacancies and renewals.
  - Open-inquiry matching (Granite Peak 50,000–78,000 SF from the Find space picker).
  - Activity recency ("Call 48 d", "Meeting 4 d").
  - Field History ("Term Commencement Date Feb 1, 2027 → Mar 1, 2027 · Ben Hartley").
  - Stale-record issues (Bluewater 151 days, Pinnacle 175 days).
  - An availability with no floor ("Availability TBD (3,000 SF) has no floor").
  - A quiet listing respected in prospect-safe mode.
  - A closed availability's Lease Out deal drawn as "Lease drafted" on the signed lease.
  - A portfolio switcher.

  No competitor in COMPETITORS §4–§7 combines these. The missing "Under contract" status is CRM data too, but I counted it under X3.
UX TOTAL: 18/20

ENGINEERING (informational): 8.5/10: The vitest suite passes: 65 files, 909 tests, run in a scratch copy. The new `src/domain/query.ts` is pure and has its own tests. `rangeProblem` sits in the domain, so the panel and the finder agree. `buildings.test.ts` checks that every floor's records fit its leasable area, that record ids are unique across buildings, and that history is ordered. 1.5 points off:
  - The two-floor ceiling in the finder was never tested against the scenario the new tower was built for (Legacy West, 60,000 SF → Floors 18–20).
  - `leakcheck.mjs` and `a11y.mjs` exercise only the default building.
  - `a11y.mjs` waits for `networkidle`, which hung here on Google Fonts.
  - The print KPI labels are duplicated in `PrintLayout` instead of shared with `KpiStrip`, which is how "requested" survived.
  - Popovers are still positioned inside clipping containers, which caused a second overlay bug in two rounds. For the LWC port, a top-layer `popover` or a portal would end that class of bug.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. **Let the search bar wrap on phones.** Add `flex-wrap: wrap;` to `.sp-filterbar` (`src/components/stack/stack.css:10`). Under `@media (max-width: 600px)`, give the sentence span `flex: 1 1 100%`, so "Find 12,000 SF of space" and "Clear" drop to a row of their own. Check that `document.documentElement.scrollWidth === 390` with `?view=stack&q=12k%20direct%20by%20jun%202027` at 390 px. Expected: +0.5 U5.
2. **Keep the legend note inside its card.**
   - In `LegendInfo` (`src/components/plan/Legend.tsx:119-136`), measure the ⓘ on open the way `Entry` does (`:88-92`). If it sits past the middle of its `.sp-legend`, pass `align="end"` to `Popover`.
   - In Popover's layout effect (`src/components/ui/Popover.tsx:63-72`), clamp the panel to the nearest ancestor whose computed `overflow` is hidden (here `.sp-map`, `src/components/map/map.css:10`), not just to the window.
   - Check Legacy West Map Leasing at 1440 px and Preston Park Map Expiration at 1920 px.
   Expected: +0.5 U4.
3. **Fix the two PDF details.**
   - Change the Pipeline note at `src/components/print/PrintLayout.tsx:119` to `${sf(k.pipeline.sf)} in play`.
   - At `:101`, wrap the sale-listing text in a `white-space: nowrap` span, so "6.4% cap" never sits alone.
   Expected: +0.25 U5 (with fix 1, U5 reaches 3/3).
4. **Run the Expiration ramp one way in both themes.** Reorder the dark tokens at `src/styles/ascendix.css:60-65` so `exp-0` ("< 6 mo") is the deepest red-orange and `exp-5` ("5+ yr") the quietest blue-gray, the same direction as light at `src/styles/tokens.css:49-54`. Keep the ramp note's wording ("from the soonest expiry to the latest"). Expected: +0.5 U2.
5. **Remove the last orphans.**
   - Cut the legend's column gap from 14 px to 8 px at ≥1280 px (`src/components/plan/plan.css:46`). The 11 Expiration entries need about 44 px more to fit one row at 1440 px.
   - On the card, when there is no listing, put the "floors" fact and "Latest change" in the `.sp-header__tail` group (`src/components/shell/Header.tsx:146-164`), so the latter never wraps alone at 1024 px.
   Expected: +0.5 U1.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. **Show the sale listing's real status, and fix the stale PDF label.**
   - In `src/components/shell/Header.tsx:151-162` and `src/components/print/PrintLayout.tsx:101`, show "Under contract" when `saleListing.status === 'Under Contract'`. The owner sees "Under contract · listed at $92,000,000 · $504.94/RSF · 5.8% cap"; a prospect sees "Under contract".
   - Apply UI fix 3 ("in play").
   Expected: +0.25 X3.
2. **Let Find space stack more than two floors.** In `src/domain/finder.ts:189-214`, walk upward from each floor and add each floor's best run while every floor in between has one. Push an option at the first length whose total is at least `req` (and at most `req.max`), named "Floors 18–20 · three floors". Add tests:
   - Legacy West, 60,000 SF → Floors 18–20, 78,000 SF.
   - The Granite Peak inquiry (LW-I01) is offered the 78,000 SF block.
   Expected: +0.5 X1.
3. **Make "one name" true.**
   - `src/components/plan/segmentText.ts:157-158`: title "No lease or listing", meta "Floor 2 · 5,400 SF" (keep "Likely Delta Dental Plan").
   - `src/domain/issues.ts:94-95`: "5,400 SF on Floor 2 has no lease or listing".
   - `src/components/map/mapStyle.ts:66`: "no lease or listing".
   - For a prospect: `src/domain/lenses.ts:215` and `:261` become "Not on the market" with a dashed swatch, and `segmentText.ts:160` becomes "5,400 SF not on the market".
   - Make "available" light sublease space too (`src/domain/query.ts:24`, `kinds: ['available', 'sublease']`), so it lights the KPI's 33,200 SF.
   Expected: +0.25 X3 (with fix 1, X3 reaches 4/4).
4. **Read the way brokers type.** In `readQuery` (`src/domain/query.ts:78-110`):
   - Take a bare "Q2", "Q2 2027", "June 2027" or "in 2027" anywhere in the query as the needed-by date.
   - Swap a reversed range ("15k-12k" → 12,000–15,000).
   - Match state words as tokens inside longer queries, so "available space" lights Available and "subleases on floor 7" lights Floor 7's sublease.
   - Rename the field "Tenant, suite or size (12k SF)" in `src/components/shell/toolbarRules.ts:16`, so the feature can be found.
   Expected: +0.5 X2.
5. **Finish the overlay accessibility.**
   - Apply UI fixes 1 and 2 (reflow and an unclipped dialog).
   - In `src/components/ui/Popover.tsx:94-97`, have Tab close a text-only note and let focus move on, instead of swallowing the key.
   Expected: +0.5 X4.

BUGS (with file:line):
- `src/components/map/map.css:10` with `src/components/ui/ui.css:103` and `src/components/ui/Popover.tsx:63-72`: the legend ⓘ popover hangs rightward from the ⓘ inside `.sp-map { overflow: hidden }`, and is only kept inside the window, not the card. On Legacy West's Map at 1440 px (Leasing), the panel spans x 983–1323 against a card edge at 1052, and the note is cut to "Each sha… / add up t…". On Preston Park's Map Expiration at 1920 px, about a third of the note is cut off.
- `src/components/stack/stack.css:10,18`: `.sp-filterbar` does not wrap and `.sp-filterbar__find` is `flex: none`. At 390 px, "12k direct by jun 2027" squeezes the sentence to a 7-line column, pushes "Clear" off-screen and widens the page to 402 px.
- `src/components/shell/Header.tsx:157-160`, `src/components/print/PrintLayout.tsx:101`: a sale listing with `status: 'Under Contract'` (`src/data/mock/buildings/cedarSprings.ts:134`) is shown as "For sale $92,000,000 · …" to the owner and "Listed for sale" to a prospect, on screen and in the PDF. The status appears only in a hover title.
- `src/components/print/PrintLayout.tsx:119`: the owner PDF's Pipeline card says "57,800 SF requested". The screen says "57,800 SF in play", and the deals request 75,800 SF.
- `src/domain/finder.ts:189-214`: multi-floor options pair only two adjacent floors. On Legacy West, 60,000 SF returns "No space fits" although Floors 18–20 (78,000 SF, direct, now) are stacked together. The Granite Peak inquiry (50,000–78,000 SF) is offered only 52,000 SF pairs.
- `src/domain/query.ts:86`: only "by / before / needed by" dates are read. "20k contiguous SF, Q2, direct" becomes "20,000 SF direct" with no date, and "need 12k sf in 2027" becomes "12,000 SF".
- `src/domain/query.ts:82`: a state word must be the whole query. "available space" and "subleases on floor 7" return the no-match message.
- `src/domain/query.ts:100` (falls through to `:102-107`): a reversed range "15k-12k" is read as a single "15,000 SF" and the 12,000 is dropped.
- `src/domain/query.ts:24`: "available" and "vacant" light direct space only (5 suites, 26,200 SF), while the KPI above says Available 33,200 SF including the 7,000 SF sublease.
- `src/components/plan/segmentText.ts:157-158`, `src/domain/issues.ts:94-95`, `src/components/map/mapStyle.ts:66`: the space the legends call "No lease or listing" is still "not listed" / "No lease or availability" on the block, "unaccounted for" in Data issues and "not listed" on the Map label.
- `src/domain/lenses.ts:215` (and `:261`): a prospect's Leasing legend and PDF call that space "Not available" with a solid swatch, while the block is dashed and the Rent and Expiration legends say "Not on the market".
- `src/components/ui/Popover.tsx:94-97`: a text-only note (`role="dialog"`, no `aria-modal`) swallows Tab and holds focus until Escape or a click outside.
- `src/styles/ascendix.css:60-65` against `src/styles/tokens.css:49-54`: the Expiration ramp runs pale yellow to navy in dark and dark rust to pale blue in light, so the most urgent bucket changes color with the theme.
- `scripts/leakcheck.mjs`, `scripts/a11y.mjs:32`: both cover only the default building, and `a11y.mjs` waits for `networkidle`, which timed out here while Google Fonts loaded.
