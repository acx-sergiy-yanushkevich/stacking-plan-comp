JUDGE: Claude Opus 5.5 (B)
ROUND: round-22

UI SCORE
U1 Visual hierarchy & layout: 5/5: Both round-21 deductions are fixed. The legend's ⓘ now sits on the card's title line in Stack, Building and Timeline ("as of Nov 9, 2026 · 245,400 RSF leasable ⓘ", shots 00, 16, 33). The property name is one solid color. The building card is now a caption. Measured live, it is one line, 50 px tall, at 1440 and 1920 px. From 1024 to 1366 px it wraps to two lines (62 px), and no width scrolls sideways. The order is the same in every view: product bar, building card, the "Color by" and "Details" KPI groups, toolbar, then the plan with the inspector beside it. Nothing competes with the plan. The Area panel's labelled "Location brief" button beside Close is easy to see (46), and "Show plan" in the brief says what it does (47). One small nit: in the brief, the panel header "Area · Plano, TX" sits right above the heading "Location · Preston Park Financial Center", so there are two titles.
U2 Color & data encoding: 4.5/5: Color is never the only cue: sublease dots, the "Signed, not yet in" hatch, dashed gaps, Holdover and MTM tags, the "Largest block" badge, the top bar on net and modified-gross rents, and "Confidential". The Expiration lens now gives direct availability its own "Available" entry (26,200 SF · 10.7%), so "Vacant, not listed" is the 5,400 SF gap alone. The 11 entries add up to the 245,900 SF on record, which the ⓘ note explains. Legends on screen show names, and the figures appear on hover or focus (54). Half a point off. First, the Expiration ramp still flips between themes: the most urgent step is the palest in dark (01) and the darkest in light (53). Second, the four Pipeline stages are four close oranges and browns (02), so the "Lease drafted" swatch and the "LOI" swatch are hard to tell apart. Every block prints its stage or "x mo left", so these are legibility costs, not broken encodings.
U3 Typography & density: 4/4: Figures are tabular everywhere. RSF is exact, and every rate carries its unit and lease type ($3.25/SF/mo NNN, $26.50/SF/yr MG). The block text tiers hold: "North American Asset Holdings" and "Conner CPA Group" wrap instead of being cut, in the Stack, the phone list and the PDF. The phone's unfolded legend prints each entry's SF and share right-aligned (56). The nit from round 21 is still there: the prospect-safe block titled "Signed, not yet in" also carries a "Signed, not in" badge (10, prospect PDF page 1), the same fact twice in two phrasings.
U4 Polish & platform fit: 2.5/3: The glass skin reads as one design language in dark, light and Vice. Selected, dimmed and focused states are distinct, and the focus ring on a legend entry is clear (54). axe (WCAG 2.2 AA) found no violations on 13 desktop states. Half a point off for two defects in the new legend states, both checked live:
  - In the Map view, the ⓘ popover and the tooltips of second-row legend entries open behind the floor list and the map canvas. The popover is in the DOM, but `elementFromPoint` over it returns `.sp-floorlist__row` (desktop) or `maplibregl-canvas` (390 px). Clicking ⓘ shows nothing, and focusing "Vacant, not listed" shows only a white sliver.
  - In the Building view, hovering the last entry, "Lobby · building use", gives a 320 px tooltip whose text runs 586 px past its box ("…(lobby, loa"), and the page grows to 1626 px wide while it is shown.
U5 Mobile & print visual quality: 2.5/3: Print is presentation-grade. The owner report has 4 sections and the prospect-safe report 3, with the full legend figures and the shares note on the cover. The prospect rent roll now prints a dash where a rent is withheld. The phone layout is readable at 390 px with no horizontal scroll, and its folded legends name their lens ("Expiration legend · 11 states"). Half a point off for three things:
  - On the phone Timeline there is no ⓘ at all: it lives in the subtitle that `timeline.css:142` hides, and the folded legend is told the info button is elsewhere. On the phone Map the popover opens under the map. So in 2 of 4 phone views the ramp and shares notes are unreachable.
  - Dimmed phone badges still fail contrast in the worklist and finder states (2.76:1 and 3.5:1, axe).
  - The prospect PDF footnote still says "the leased, sublease and committed rows".
UI TOTAL: 18.5/20

UX SCORE
X1 Persona job coverage: 4.5/5: All 10 jobs can be done, and quickly:
  - vacancy and the 9,300 SF largest block are on the opening screen;
  - expirations show by lens, worklist and rollover, measured from the as-of date;
  - Data issues opens in one toolbar click;
  - Find space for 12,000–15,000 SF by Jun 1, 2027 gives Floor 6 from Apr 2027, split to 15,000, with "1 inquiry fits";
  - every block has record actions;
  - the owner and prospect PDFs are both real;
  - direct, sublease, later and signed-not-in each have their own state;
  - time travel recomputes everything;
  - the Pipeline lens shows the deals on each vacancy.

  A broker can hand the prospect-safe screen to a tenant (10), and Wes's phone check holds. Half a point off for Todd's search-first test, unchanged from round 21. In the only free-text box, "12000 sf", "20k direct", "sublease" and "holdover" each return "No tenant, suite or prospect matches… Try a suite number" (`src/model/usePlanModel.ts:257`). A size request only reaches the finder if the user knows to open Find space.
X2 Interaction & IA: 3.5/4: The IA is coherent. One URL-backed state drives every view, and the KPIs work as navigation. The Area flow works exactly as described, tested live: Area → "Location brief" (focus lands on "Show plan") → Esc goes back to `mode=area` with focus on "Location brief" → Esc closes it with focus on "Area". The ⓘ opens on Enter or Space, and Escape or an outside click closes it, with focus returned. Half a point off:
  - Clicking ⓘ in the Map view moves focus into a dialog nobody can see (U4), which is a dead end in a live demo.
  - The Pipeline block still reads "Lease Out · Lumen Analytics" while the legend says "Lease drafted" (`src/components/plan/segmentText.ts:188` skips `stageLabel`).
  - Search and Find space are still two ideas the user has to learn.
X3 Trust & domain correctness: 3.5/4: The numbers reconcile. The expiration legend adds up to 245,900 SF (Available 26,200, gap 5,400, signed 8,000, at risk 17,200, and so on). Rollover is 35,300 SF in 4 leases (16.7% of the 211,200 SF leased). The rent roll rows add up to 211,700 SF, capped to 211,200 because Floor 7 is 500 SF over. Holdover, MTM, confidential, sublease and the for-sale condo are each handled correctly. Prospect-safe leaks nothing: `npm run leakcheck` reports "0 leaks". My own scan of page text, aria-label, title and screen-reader text, with the ⓘ note opened, across 18 states at 1440 and 390 px (36 page loads) found no tenant, contact, broker, prospect, sale price, cap rate, in-place rent or term; the only matches were the allowed asking rents. Half a point off:
  - New this round: the prospect-safe Rent legend reads "Leased: 210,100 SF, 85.6% of leasable", next to a KPI that says Leased 86.1%. That figure counts the 5,400 SF of unrecorded space that the Leasing lens calls "Not available". The gap has no rent, so it falls to the `muted` tone (`src/domain/lenses.ts:184-187`), and round 22 relabelled that tone "Leased" for prospects (`src/domain/lenses.ts:273`).
  - The finder still accepts a 5,000 SF minimum with a 3,000 SF maximum and offers Ste 350 "split to 3,000" (`src/domain/finder.ts:250`).
  - "57,800 SF requested" is still the largest deal per space, not what the deals request (`src/components/kpis/KpiStrip.tsx:188`).
  - The same 5,400 SF is still called "Vacant, not listed" while its own block says "Likely Delta Dental Plan".
X4 Accessibility of interaction: 2.5/3: This is a real improvement. Every legend entry is now a tab stop with a visible focus tooltip and screen-reader text ("< 6 mo: 28,800 SF, 11.7% of leasable"), and the ⓘ is a real button with a dialog popover that moves focus in and back out. The plan stays a keyboard grid (→ ↓ ↓ ← reaches the Floor 10 label, Enter opens the floor, Esc returns focus to the label). axe is clean on 13 desktop states and on 11 of 13 phone states. Half a point off:
  - In the Map view, keyboard focus goes into an invisible dialog, and second-row legend tooltips cannot be seen.
  - The phone Timeline has no ⓘ at all.
  - Dimmed phone badges fail contrast (`.sp-pbadge--deal` 2.76:1).
  - The Expiration legend puts 11 extra tab stops before the plan (the "Skip to plan" link softens this; a single roving tab stop would be better).
X5 CRM workflows & differentiation: 4/4: This is clearly CRM-native. Deal stages show on each vacancy and renewal, with a Pipeline lens. Open inquiries are matched to space ("2 inquiries fit", and the inquiry selector pre-fills the finder). Blocks show activity recency ("Call 40 d", "Email 87 d", "No activity"). Quiet listings are kept from prospects, which is correct here because A04 is `published: false`. The inspector shows Field History and "Verified" stamps, Data issues have fix actions, and the renewal worklist exports to CSV. A location brief is ready to hand to a client. None of the tools in COMPETITORS §4–§5 combines these.
UX TOTAL: 18/20

ENGINEERING (informational): 9/10: The vitest suite passes: 63 files and 893 tests, run in a /tmp copy with `--cache=false`. The leak check passes against the live build. The domain layer is pure TypeScript with tests alongside. Withholding is centralized in `src/domain/safe.ts`. The host adapter and one CSS file per component keep the path to an LWC port credible. One point off, for two reasons. First, the legend's `Entry` reimplements a tooltip instead of using `src/components/ui/Tooltip.tsx`, and neither it nor `Popover` escapes its stacking context. The map legend's `backdrop-filter` (`src/styles/glass.css:171`) with no z-index buries both under `.sp-map__stage`, and jsdom tests cannot catch that. Second, the prospect-safe Rent mapping of unrecorded space to "Leased" is a domain bug that `lenses.test.ts` does not cover.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Lift the Map legend above the map. Add `position: relative; z-index: 5;` to `.sp-map-legend` in `src/components/map/map.css:14`, or render `.sp-legend__pop` and `.sp-legend__tip` in a portal on `document.body` positioned from the trigger's rect. Check at `?view=map` at 1100, 1440 and 390 px that the ⓘ note and the "Vacant, not listed" tooltip are fully visible. Expected +0.5 U4, +0.25 U5.
2. Give the phone Timeline its ⓘ. In `src/components/timeline/TimelineView.tsx:173`, drop `infoElsewhere` from the folded `<Legend>` when `stackedMode` is on, so the button renders inside the opened legend list, as it does on the phone Stack. The `.sp-weak` holding the title-line button is hidden by `src/components/timeline/timeline.css:142`. Expected +0.25 U5.
3. Stop legend tooltips overflowing. In `src/components/plan/plan.css:50`, replace `white-space: nowrap` with `white-space: normal; width: max-content; max-width: min(320px, calc(100vw - 32px));`, and anchor tips for entries in the right half of the legend with `right: 0; left: auto`. The Lobby tip then wraps inside its box and the page stays 1440 px wide. Expected +0.25 U4.
4. Fix dimmed phone badge contrast. In `src/components/stack/*.css:92`, `.sp-psuite.is-dim { opacity: 0.45 }` dims the badges with the row. Dim only the row's fill and text, keeping `.sp-pbadge` at full opacity or restyling it as a muted outline badge with at least 4.5:1 contrast. Expected +0.25 U5.
5. Use one phrase for a signed lease, "Signed, not yet in":
   - the badge in `src/components/plan/segmentText.ts:137`; drop the badge when the block's title already says it (prospect-safe);
   - `src/components/kpis/KpiStrip.tsx:90`;
   - `src/components/print/PrintLayout.tsx:158`;
   - `src/components/inspector/BlockPanel.tsx:136`;
   - `src/components/timeline/TimelineRows.tsx:255`.

   Also change "committed rows" to "signed-not-yet-in rows" in `src/components/print/PrintLayout.tsx:170`. Expected: polish toward U3/U5.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Send size and state queries from the search box to the right tool, in `src/model/usePlanModel.ts` (`search()` at :145 and the empty state at :256-257).
   - Parse a number with an optional "k" and "SF", plus "direct" or "sublease" and "by <month|Qn yyyy>". When found, show a first row "Find 12,000 SF of space →" that sets `req`, `fit` and `by` and opens `mode=find`.
   - Map "sublease", "holdover", "month-to-month" or "MTM", "available", "for sale" and "signed" to the matching segment filter.
   - Make the empty state suggest "Try 12,000 SF, a suite (“350”) or a floor".

   Expected +0.5 X1, +0.25 X2.
2. Stop the prospect Rent legend calling unrecorded space leased. In `src/domain/toneFor` (`src/domain/lenses.ts:181-187`), return a dedicated gap tone for `seg.kind === 'unmarketed'` before the prospect-safe rule. Add a rent-lens legend entry for it, dashed, labelled "Not on the market" for a prospect and "Vacant, not listed" for the owner. Rename the prospect's muted entry at `src/domain/lenses.ts:273` to "Leased · rent not shown", so it reads 204,700 SF instead of 210,100. Add a `lenses.test.ts` case asserting the safe Rent legend's gap entry is 5,400. Expected +0.5 X3.
3. Make the Map ⓘ usable (UI fix 1) and add the phone Timeline ⓘ (UI fix 2). Add a Playwright check in `scripts/a11y.mjs` that, after Enter on every visible `.sp-legend__info`, `elementFromPoint` at the popover's center lies inside `.sp-legend__pop`. Expected +0.5 X4, +0.25 X2.
4. Plain stage name and an honest pipeline figure. Use `stageLabel(d.stage)` in `src/components/plan/segmentText.ts:188`, so the block reads "Lease drafted · Lumen Analytics". Change the KPI note in `src/components/kpis/KpiStrip.tsx:188-189` to "57,800 SF in play", with the tooltip "largest live deal per space; competing deals on one suite count once". Expected +0.25 X2, +0.25 X3.
5. Validate the finder range. In `src/components/inspector/FindPanel.tsx` and at the top of `searchSpace` in `src/domain/finder.ts`, when `max < req`, keep both values, mark Max SF invalid with "Maximum must be at least 5,000 SF", and return no options or match highlights. Apply the same rule to URL-loaded `req` and `max`. Expected +0.25 X3.

BUGS (with file:line):
- `src/components/map/map.css:14` and `src/styles/glass.css:171`: `.sp-map-legend` gets `backdrop-filter` (a stacking context) and no z-index. The ⓘ popover and second-row legend tooltips paint under `.sp-map__stage`, so `elementFromPoint` over the open popover returns `.sp-floorlist__row` at 1440 px and `maplibregl-canvas` at 390 px. Focus moves into an invisible dialog.
- `src/components/timeline/TimelineView.tsx:173` with `src/components/timeline/timeline.css:142`: on the phone, the folded Timeline legend is rendered with `infoElsewhere` while the subtitle holding `LegendInfo` is `display: none`, so the phone Timeline has no legend note at all.
- `src/components/plan/plan.css:50`: `.sp-legend .sp-legend__tip { white-space: nowrap }` overrides the 320 px wrapping tip. On the Building view, the "Lobby · building use" tip text is 586 px in a 320 px box ("…(lobby, loa") and widens the document to 1626 px.
- `src/domain/lenses.ts:184-187` and `:273`: in the prospect-safe Rent lens, the `unmarketed` gap (5,400 SF) gets the `muted` tone, now labelled "Leased". The legend shows "Leased: 210,100 SF, 85.6%" beside a KPI of 86.1% leased, and the Leasing lens calls the same space "Not available".
- `src/components/plan/segmentText.ts:188`: Pipeline blocks print the raw CRM stage ("Lease Out · Lumen Analytics") while the legend and `stageLabel` say "Lease drafted".
- `src/domain/finder.ts:250`: `?mode=find&req=5000&max=3000&fit=direct` returns "Space that fits 5,000–3,000 SF · 1 option", Ste 350 split to 3,000 SF.
- `src/model/usePlanModel.ts:257`: "12000 sf", "20k direct", "sublease" and "holdover" return the no-match state and are not routed to the finder or a state filter.
- `src/components/kpis/KpiStrip.tsx:188-189`: "57,800 SF requested" is the largest live deal per space, capped at the suite size, not the SF the deals request.
- `src/components/print/PrintLayout.tsx:170`: the prospect PDF footnote still says "committed rows" after the "Signed, not yet in" rename. "Signed, not in" also remains at `src/components/plan/segmentText.ts:137`, `src/components/kpis/KpiStrip.tsx:90` and `src/components/print/PrintLayout.tsx:158`.
- Phone (390 px), worklist and find states: dimmed `.sp-pbadge--deal` is #8d97a1 on #265278 (2.76:1) and `.sp-pbadge--lock` is 3.5:1 (axe color-contrast, serious), from `.sp-psuite.is-dim { opacity: 0.45 }`.
