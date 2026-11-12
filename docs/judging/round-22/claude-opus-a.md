JUDGE: Claude Opus 5.5 (A)
ROUND: round-22

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: Every view keeps the same order: product bar, building card, KPI bar ("Color by" | "Details"), toolbar, then the plan with the inspector beside it (00, 16, 18, 33). Round 22 fixed the two round-21 nits. The ⓘ now sits on the card's title line ("as of Nov 9, 2026 · 245,400 RSF leasable ⓘ") in Stack, Building and Timeline, so it no longer takes a row of its own. The property name is one solid color (computed fill rgb(245,248,251), no gradient). The building card is one line at 1440 and 1920 px (62 px and 50 px tall). The Area panel's "Location brief" is now a labeled button beside Close (46). Half a point off for wraps that look accidental. At 1280 px, a common laptop width, the card's facts wrap and leave "✓ Latest change Nov 6, 2026" alone on a second line. At 1440 px the Expiration legend puts "For sale (no lease term)" on a row of its own (01, 53), and the Map legend does the same with "Vacant, not listed" (18).
U2 Color & data encoding: 4.5/5: Color is never the only cue: sublease dots, the hatch on "Signed, not yet in", dashed unrecorded space, Holdover and MTM tags, the "Largest block" tag, top bars on net rents and the lock. The Expiration lens now separates Available (26,200 SF, green) from the 5,400 SF with no record. I checked the 11 legend figures against the plan: they add up to 245,900 SF, which is 245,400 leasable plus Floor 7's 500 SF. Legend figures can be reached again by keyboard and touch (54, 56). Half a point off. The Expiration ramp still changes hue and direction between themes: in dark, "< 6 mo" is pale yellow and "5+ yr" navy; in light, "< 6 mo" is dark red, and "3–5 yr" and "5+ yr" are two close pale blues (53). In prospect-safe Rent, the swatch named "Leased" also colors Floor 2's block "5,400 SF not available · Not on the market". The Floor view has no legend at all (21).
U3 Typography & density: 4/4: Figures are tabular everywhere. No tenant name is truncated in the Stack, Timeline, floor plates or phone list. Every rate carries its unit and lease type. Leased blocks in prospect-safe Rent now end cleanly, with no stand-in word. One nit: blocks titled "Signed, not yet in" still carry a "Signed, not in" badge in prospect-safe mode (10, prospect-safe PDF page 1).
U4 Polish & platform fit: 2.5/3: The glass skin holds together in dark, light and Vice, and legend entries have a clear focus ring and a styled tooltip. Two of the new states fail on screen.
  - **Map view (1024 and 1440 px, dark and light):** clicking the legend's ⓘ sets `aria-expanded=true` and moves focus into the popover, but the popover is painted under the floor list and the map, so nothing appears. A hit test at the panel's center lands on `.sp-dotrun__in` and `maplibregl-canvas`. Second-row entry tooltips are hidden the same way. The cause is `backdrop-filter` on `.sp-map-legend`, which creates a stacking context that traps the popover's z-index 40.
  - **Right-edge tooltips:** every tooltip starts at its entry's left edge, so the right-most entry's figures are cut off. In the Stack at 1440 px it reads "Vacant, not listed: 5,400 S". In the Building view, the "Lobby · building use" tip runs past the 1440 px viewport.
  Wes would hit the Map one on the first click in a live demo.
U5 Mobile & print visual quality: 2.5/3: Phone legends now name their lens ("Expiration legend · 11 states") and list SF and share for each entry (56). Tapping ⓘ opens the note in the phone Stack and Building views. Print is still presentation-grade: the owner report has 4 sections and the prospect-safe report 3, with "Signed, not yet in" and a dash for withheld rent in the right places and the location brief last. Half a point off for three phone problems:
  - On a 390 px phone, the Map's ⓘ popover opens behind the map canvas.
  - The phone Timeline has no ⓘ at all. Its title-line ⓘ is hidden by CSS, and the folded legend is told the ⓘ is drawn elsewhere.
  - So in two of the four phone views, the ramp-order, shares and Floor 7 note cannot be reached.
  - Dimmed phone badges are still 2.76:1 (axe, in the worklist and find states).
UI TOTAL: 18/20

UX SCORE
X1 Persona job coverage: 4.5/5: All ten jobs can be done.
  - The vacancy and largest block are visible in one glance, and expirations are measured from the as-of date.
  - Data issues (8) is one click away.
  - Find space for "20,000 SF by Jun 30, 2027, direct" gives the same answer every time: Floor 6 from Apr 2027 (1 inquiry fits, 2 live deals), then ranked direct alternatives with each one's shortfall.
  - In prospect-safe mode, 12,000 SF offers a two-floor combination (Floors 7–8, 14,400 SF) and correctly leaves out the unpublished Floor 6 listing.
  - Record actions, the owner and prospect-safe PDFs, time travel and the deal pipeline all work.
  Half a point off, unchanged from round 21: the only free-text box still fails Todd's first test. "12000 sf", "20k direct", "sublease", "holdover" and "available" each return "No tenant, suite or prospect matches…" and a suggestion to try a suite or floor, never Find space.
X2 Interaction & IA: 3.5/4: State is coherent and kept in the URL. The labeled "Location brief" opens the brief and moves focus to "Show plan". Escape narrows the brief, a second Escape closes the panel, and focus returns to the Area button (tested). Escape on the legend popover closes only the popover; an open worklist stays open. A click outside closes it. Half a point off: search and Find space are still two separate ideas a user has to learn, and on the Map view the ⓘ gives no visible response at all.
X3 Trust & domain correctness: 3.5/4: I checked the figures by hand.
  - Rollover buckets plus at-risk add up to 194,500 + 17,200 = 211,700 SF on record.
  - Leased is 211,200 SF after the 500 SF cap, or 86.1%; occupied is 196,700 SF, or 80.2%.
  - Expiring 12 mo (35,300 SF) equals the legend's 28,800 + 6,500.
  - The CSV writes "Signed, not yet in", the month-to-month issue says "Avg term", and the prospect-safe rent roll shows "—" for in-place rent.
  - I ran `npm run leakcheck` live: 407 checks, 0 leaks.
  Half a point off for three wording problems:
  1. Round 22 renamed prospect-safe Rent's muted item to "Leased". That tone also covers Floor 2's 5,400 SF "Not on the market" space and the 8,000 SF signed lease. A prospect therefore reads "Leased 210,100 · 85.6%" in the legend (on a phone, directly under the KPI) while the KPI says "Leased 86.1%". The prospect-safe Leasing lens avoided exactly this by calling the tone "Occupied".
  2. The owner legend still calls Floor 2's 5,400 SF "Vacant, not listed", while the block and Data issues say it is likely Delta Dental's.
  3. "57,800 SF requested" is the largest live deal per space, capped at the suite size. The 9 live deals actually request 75,800 SF.
X4 Accessibility of interaction: 2.5/3: A big step forward. Each legend entry is a tab stop that shows its figures in a tooltip, and a screen reader hears them too ("< 6 mo : 28,800 SF, 11.7% of leasable"). The ⓘ is a real button (`aria-haspopup=dialog`): Enter or Space opens it, focus moves into a labeled dialog, and Escape returns focus to the button. "Skip to plan" jumps the 11 extra legend stops. axe (WCAG 2.2 AA) found no violations in 12 desktop states, including with the popover open. Half a point off:
  - On the Map view, focus moves into a dialog that is fully hidden (WCAG 2.4.11 Focus Not Obscured).
  - The phone Timeline has no way to reach the note.
  - On phones, the "Issues 8" button's accessible name is "Data issues (8)". axe flags this on five phone states (WCAG 2.5.3 Label in Name), and dimmed badges are 2.76:1.
  - The legend's `aria-label` sits on a div with no role, so assistive technology ignores the name and does not announce the entries as a group or list.
X5 CRM workflows & differentiation: 4/4: Still clearly CRM-native.
  - Deal stage on every vacancy and renewal, plus the Pipeline lens.
  - Open-inquiry matching: the Find space inquiry picker and "1 inquiry fits".
  - Activity recency on blocks ("Call 40 d", "Email 87 d", "No activity").
  - The Field History change log ("Term Expiration Date Jun 30, 2027 → Mar 31, 2027 · Elena Ruiz").
  - Quiet and published listings respected in prospect-safe Find space.
  - A stale-record issue (Bowline, 160 days).
  - Record-action stubs on blocks and issues, and the renewal worklist with CSV.
  - A location brief to hand a client.
  None of the competitors in COMPETITORS §4–§7 combines these.
UX TOTAL: 18/20

ENGINEERING (informational): 8.5/10: The vitest suite passes: 63 files, 893 tests, run in a scratch copy with the cache outside the repo. The domain layer is pure TypeScript with tests beside it. Withholding is centralized in `src/domain/safe.ts`, and the leak check covers 407 states, including switches into prospect-safe mode, time travel and the CSV. The Legend refactor reuses the shared Popover, and one `entryFigures` feeds both the tooltip and the screen-reader text. 1.5 points off:
  - No visual or stacking test covers overlays, which is how the Map popover regression shipped.
  - A legend-label rename ("Rent withheld" → "Leased") changed its meaning, and no test ties the legend's "Leased" figure to the KPI.
  - Strings are still duplicated: the "Signed, not in" badge, and "signed, not in" in the rent-roll total beside "Signed, not yet in" in its state column.
  - For the LWC port: popovers positioned inside containers will meet the same stacking contexts in shadow DOM; a portal or the top-layer popover API would port better.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. **Lift the Map legend above the map.** Add `position: relative; z-index: 3;` to `:root[data-skin='glass'] .sp-map-legend` (`src/styles/glass.css:171`), and to `.sp-map-legend` in `src/components/map/map.css:14` for the classic skin. Its popover and tooltips will then paint over `.sp-map__stage` and the floor list. Check at 1024, 1440 and 390 px in both themes. Expected: +0.5 U4 (together with fix 3), +0.25 U5.
2. **Give the phone Timeline its ⓘ.** Remove `infoElsewhere` from the folded legend at `src/components/timeline/TimelineView.tsx:173`, so the legend draws its own ⓘ as PhoneStack does; the title-line ⓘ is hidden there by `src/components/timeline/timeline.css:142`. Expected: +0.25 U5.
3. **Make legend tooltips edge-aware.** In `Entry` (`src/components/plan/Legend.tsx:83`), when the tip opens, compare the entry's rect with its `.sp-legend` container. If the entry starts past the container's midpoint, add `sp-legend__tip--end` (`left: auto; right: 0`). This replaces the unconditional `left: 0` at `src/components/plan/plan.css:50`. Expected: with fix 1, U4 back to 3/3.
4. **Keep dimmed phone badges legible.** Replace `.sp-psuite.is-dim { opacity: 0.45 }` (`src/components/stack/stack.css:92`) with dimming of the row's children except `.sp-psuite__badges`, and give dimmed badges a muted fill with text at 4.5:1 or better. Expected: +0.25 U5.
5. **Remove the accidental wraps.**
   - Shorten the Expiration legend label "For sale (no lease term)" (`src/domain/lenses.ts`, expiry legend spec) to "For sale", with "no lease term" in its tooltip, so all 11 entries fit one row at 1440 px.
   - In the building card's facts (`src/components/shell/Header.tsx`, the `facts` block), wrap the "For sale …" span and "Latest change" in one `white-space: nowrap` group, so a wrap moves both to the second line instead of orphaning "Latest change" at 1180–1365 px.
   Expected: +0.5 U1.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. **Fix the Map legend overlay** (UI fix 1). Today it focuses a dialog that is completely hidden. Expected: +0.25 X4, +0.25 X2.
2. **Make the prospect-safe Rent legend agree with the KPI.**
   - In `src/domain/lenses.ts:184`, when `prospectSafe`, return `'empty'` (dashed) for `unmarketed` and `'committed'` (hatch) for `committed` instead of `'muted'`.
   - Add those two items to the safe Rent spec as "Not on the market" and "Signed, not yet in".
   - Rename the remaining muted item "Occupied" (`src/domain/lenses.ts:273`).
   The legend then reads "Occupied 196,700 · 80.2%", "Signed, not yet in 8,000", "Not on the market 5,400", the same figures as the prospect-safe Leasing legend. Expected: +0.5 X3 (together with fix 4).
3. **Send size and state queries from the search box to the right tool** (the search matcher in `src/model/usePlanModel.ts`).
   - Parse a number with an optional "k" or "SF", "direct" or "sublease", and "by <month | Qn YYYY>".
   - When one is found, show a first row "Find 12,000 SF of space →" that sets `req`, `fit` and `by` and opens `mode=find`.
   - Map "available", "sublease", "holdover", "month-to-month", "MTM", "for sale" and "signed" to the matching segment filter.
   - Change the empty state at `src/model/usePlanModel.ts:256-257` to "Try 12,000 SF, a suite number (“350”) or a floor (“Floor 8”)".
   Expected: +0.5 X1, +0.5 X2.
4. **Use honest owner labels.**
   - Change "Vacant, not listed" to "Unaccounted (no record)" at `src/domain/lenses.ts:219` and `:244`; prospects keep "Not on the market".
   - Change the Pipeline note to "57,800 SF in play", with the tooltip "largest live deal per space; the 9 deals request 75,800 SF in all" (`src/components/kpis/KpiStrip.tsx:188-189`).
   Expected: +0.5 X3 (together with fix 2).
5. **Clean up the remaining accessibility issues.**
   - Give the legend `role="group"` (`src/components/plan/Legend.tsx:136`) so "Expiration legend" is announced.
   - Make the phone Issues button's name contain its visible text: drop the `aria-label` at `src/components/shell/Toolbar.tsx:164` and render a visually hidden "Data " before "Issues".
   - Apply UI fix 4 for badge contrast.
   Expected: +0.25 X4.

BUGS (with file:line):
- `src/styles/glass.css:171` (with `src/components/map/MapView.tsx:329`, `:337` and `src/components/ui/ui.css:97`): `backdrop-filter` on `.sp-map-legend` creates a stacking context. The legend ⓘ popover (z-index 40) and the second-row tooltips paint under the floor list and the map. Seen in the Map view at 1024 and 1440 px, dark and light, and on a 390 px phone: ⓘ sets `aria-expanded=true` and focuses an invisible dialog.
- `src/components/timeline/TimelineView.tsx:173` with `src/components/timeline/timeline.css:142`: in the stacked (phone) Timeline, the title-line ⓘ is hidden and the folded legend is told `infoElsewhere`, so the legend note cannot be reached.
- `src/components/plan/plan.css:50`: legend tooltips are always anchored at the entry's left edge. The right-most tip is cut off ("Vacant, not listed: 5,400 S" in the Stack at 1440 px), and the Building view's "Lobby · building use" tip ends at x = 1445 on a 1440 px viewport.
- `src/domain/lenses.ts:273` with `:184`: the prospect-safe Rent legend's "Leased 210,100 · 85.6%" counts Floor 2's 5,400 SF "Not on the market" space and the 8,000 SF signed lease. The KPI on the same screen reads "Leased 86.1%" (211,200 SF).
- `src/domain/lenses.ts:219`, `:244`: the legend labels Floor 2's 5,400 SF "Vacant, not listed", while the block says "Likely Delta Dental Plan" and Data issues says the area "may be its space".
- `src/components/kpis/KpiStrip.tsx:188-189`: "57,800 SF requested" is the largest deal per space capped at the suite (`src/domain/kpis.ts:156`); the 9 live deals request 75,800 SF.
- `src/model/usePlanModel.ts:256-257`: "12000 sf", "20k direct", "sublease", "holdover" and "available" return the no-match state and are not routed to Find space or a state filter.
- `src/components/shell/Toolbar.tsx:164`: on phones, the button shows "Issues 8" but its accessible name is "Data issues (8)". axe flags label-content-name-mismatch (WCAG 2.5.3) on the phone Stack, Timeline, Map, worklist and find states.
- `src/components/stack/stack.css:92`: dimmed phone badges are 2.76:1 (`.sp-pbadge--deal`) and the lock badge 3.5:1 (axe color-contrast, phone worklist and find states).
- `src/components/plan/segmentText.ts:137`: the "Signed, not in" badge repeats the "Signed, not yet in" title on prospect-safe blocks. The rent-roll total line in both PDFs still says "8,000 SF signed, not in", while its state column says "Signed, not yet in".
