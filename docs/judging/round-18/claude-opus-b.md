# Round 18 · Judge: Claude Opus 5.5 (B) · Live build driven in Chrome with Playwright (mouse, touch and keyboard) at 390, 420, 768, 1024, 1280, 1366, 1440 and 1920 px, dark and light, Ascendix and Vice; axe on 11 states; the three real PDFs; screenshots 00–48; domain, area, inspector, KPI, map and sheet code; npm test (856/856 passed)
UI 17/20 (U1 4.5, U2 4.5, U3 3, U4 2.5, U5 2.5) · UX 18/20 (X1 5, X2 3.5, X3 3.5, X4 2.5, X5 3.5) · Engineering 8/10

JUDGE: Claude Opus 5.5 (B)
ROUND: round-18

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: The order is clear: header, then the two-group KPI bar ("Color by" / "Open"), then one toolbar, then the plan with the inspector beside it. The Area button sits after Find space in every view, phone included. The brief at 1440 and 1920 reads well: four headline cards, then "What stands out" and amenities side by side, then the ring table and transit. The plan really is put away: the grid measures 0×0 while the brief is open, and the MapLibre canvas comes back at the right size even after a window resize. Deductions: the "What stands out" column leaves a large empty block beside the longer amenities column at every desktop width. The Area panel says "Plano, TX" twice (the panel subtitle, then "Plano, TX · rings around the property"). The full-height sheet cuts the header in half (see U5).
U2 Color & data encoding: 4.5/5: Status-lens states carry pattern, border and label. The KPI groups use a dot and underline for switches and an arrow for openers. The Area meters show the ring as a bar and the US as a tick, with both figures and the difference in words. Rent-legend shares sum to 100.1%, which is rounding. Deductions: bus stops use the "people" glyph, the same icon as the Area button and population. Whether a stop is bus or rail is shown only by icon in the panel, the brief and the PDF; there is a screen-reader label but no visible word. On the phone list, the leased swatches (outlined empty squares) look like unchecked checkboxes.
U3 Typography & density: 3/4: Figures are tabular and exact throughout, and the brief keeps "1 mile" and "0.2 mi" whole. However, in the Map view at 1280 px (any lens, with or without the Area panel), Floor 12's "9,300 SF available" is drawn on top of "50.0% leased". I measured both runs at y=343, with the facts starting at x=69 and the share at x=79. Floor 1's wrapped "expires < 12 mo" also falls back under the floor number. The 1366 and 1440 px rows are fine. Smaller issues: at an as-of of Jun 2028, the "North American Asset Holdings · vacated" label crosses the as-of cursor; the floor-plate KPI cards start a line with "·" ("0 direct / · 7,000 sublease"); the PDF's Available card breaks "7,000 / sublease".
U4 Polish & platform fit: 2.5/3: The glass skin is coherent and legible in light, dark and Vice. Hover, focus, selected and dimmed states are clear. Deductions:
  - The "Leased" Color-by switch shows unpressed (hollow dot, no underline) whenever the Area panel, the brief or the worklist is open, although the toolbar still shows Status pressed. This is visible in the round's own screenshots 46 and 47.
  - The Building panel says "Annualised" (British spelling).
  - The Area footer heads sample data with "Data: US Census Bureau ACS 5-year · OpenStreetMap".
  - A developer hint ("Add ?live=1&census=KEY…") appears in a client-facing panel.
U5 Mobile & print visual quality: 2.5/3: The phone header is one title and one row of controls at 390 and 420 px. The phone stack list is readable. The phone brief's table fits 358 px without overflow, and the handle drag works (sheet top 439 → 68 px). No width from 390 to 1920 scrolls horizontally. The PDFs are presentation-grade: 4 sections for the owner report and 3 for prospect-safe, each ending with Location. Deductions: the "full-height" sheet stops 68 px from the top (SHEET_MOST 0.92), slicing the date, Safe, Export and "…" buttons in half at 390 px, and slicing the facts line at 1024 px. PDF section 3 leaves the right half of the page empty under a six-row worklist.
UI TOTAL: 17/20

UX SCORE
X1 Persona job coverage: 5/5: All ten jobs complete quickly:
  - occupancy and largest block from the KPIs, with hover lighting
  - rollover from the as-of control, with deltas
  - the issues panel
  - the finder with inquiry prefill and alternatives
  - the block inspector with record actions
  - owner and prospect-safe PDFs
  - committed and sublease states
  - time travel (verified at 2028: Leased 70.9%, −15.2 pts)
  - deals lens and pipeline

  The new Area and brief add a client-facing deliverable for the landlord rep and tenant rep, it is reachable from every view, and prospect-safe shows it whole.
X2 Interaction & IA: 3.5/4: The flow is discoverable: "Around the building" leads to "See area details", which opens Area with focus on its heading. The 1/3/5 switch is a radio group with arrow keys. The brief toggle exposes aria-pressed, focus stays on it, and ?mode=brief deep-links. Inside the panel, Escape narrows and a second Escape closes, returning focus to the Area button. Deductions:
  - Escape only works when focus is inside `.sp-ins`. After a ?mode=brief link (focus on body) or a mouse click on brief text (focus moves to <main>), Escape does nothing.
  - Clicking "Leased" while the brief is open resets mode to building and closes the panel, though it looks like an unpressed lens switch.
  - Page scroll is not restored after narrowing (400 → 98 px).
  - Closing an Area panel opened from "See area details" sends focus to <main>, not back to the link.
X3 Trust & domain correctness: 3.5/4: RSF is exact and reconciles across the legend, rent roll (211,700 recorded vs 211,200 capped, explained) and rollover. Holdover, MTM, committed, sublease and confidential are handled correctly. The ended-lease bar shows the vacated tone and its own dates, and selects nothing. Prospect-safe leaks nothing in the UI or the PDF (Expiring, WALT and Pipeline withheld; "Listed for sale" only). Deductions:
  - The brief says "61% of adults within 1 mile hold a bachelor's degree, 2.8× the US" (src/domain/areaBrief.ts:134). The measure is "highest degree is a bachelor's" (B15003_022/B15003_001, US 21.6%). It undercounts holders and contradicts the ~35% "bachelor's or higher" figure clients know.
  - In live mode a ring's "median household income" is a household-weighted mean of tract medians (CensusSource.ts:56–76), not disclosed.
  - AreaPanel.tsx:143 says "No stops within half a mile" for a list that runs to 4.6 mi.
X4 Accessibility of interaction: 2.5/3: axe (WCAG 2.1 AA) reports 0 violations in 10 states (building, stack+area, brief dark/light/Vice/safe, timeline+area light, map+area, timeline, floor). Tool panels take focus, Close returns focus to its trigger, and the segmented control is real radios. Deductions: at 390 px the brief's scroller `.sp-ins__body` has no focusable content (axe serious: scrollable-region-focusable), so a keyboard user on a tablet or phone cannot scroll the brief. The Escape scope gap in X2 also affects keyboard users arriving from a deep link.
X5 CRM workflows & differentiation: 3.5/4: The CRM depth is strong:
  - deals per vacancy with stage
  - inquiry fit badges and inquiry-matched finder
  - "Call 40 d" / "No activity" touch recency
  - change history with who and when
  - "Quiet · not published" listing status
  - New deal / Log call / Create availability stubs

  The location brief, though, is generic demographics that CoStar or Placer already sell. It doesn't use anything the CRM knows: no "prepared for" inquiry or contact, no requirement fit, no "log as sent" activity.
UX TOTAL: 18/20

ENGINEERING (informational): 8/10: The domain is pure TypeScript and well tested: 856 tests pass; areaBrief has 10 cases and the US benchmark is documented by ACS table. State is one URL-synced store, and brief is a mode, so the plan stays mounted. Inspector, AreaPanel and LocationBrief share bar markup. One CSS file per component on tokens ports cleanly to LWC. Weaknesses: the layout relies on hand-tuned CSS tricks, and one has already broken. In map.css:84–93, a zero-height `::before` spacer plus an absolutely positioned transparent separator produces the 1280 px overprint, and no width-sweep check catches it. Escape handling is split between the page-level handler (App.tsx:269) and the panel's onKeyDown (Inspector.tsx:147), which left the brief's gap.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Map floor list overprint (src/components/map/map.css:80–93). The empty `.sp-dotrun__in::before` spacer is a zero-height flex item. When `.sp-flabel__last` (the fact plus the "Largest block" tag, 223 px) does not fit after it, the spacer sits alone on line 1 and the facts wrap to the top-left of the cell, over "50.0% leased". Two fixes:
   - Quick: give the spacer `align-self: stretch; min-height: 1lh`, so a wrapped line goes below.
   - Better: place `.sp-flabel__fact` in its own grid column (`grid-column: 5 / -1`) and drop the spacer.

   Then add a Playwright sweep at 1280, 1366 and 1440 that fails when two text boxes in a `.sp-map-floor` intersect. +0.5 U3.
2. Leased pressed state (src/components/kpis/KpiStrip.tsx:92): change `active` to `state.lens === 'status'`, as Pipeline does. Make the 'status' action (App.tsx:234) keep `mode` when it is area or brief, so a switch never closes a panel. +0.5 U4.
3. Full-height sheet (src/components/ui/sheetHeight.ts:6, `expandedSheetHeight`): for `mode=brief`, pass `keepClear` = the header's measured bottom, so the sheet stops below whole controls. Or go to 100dvh with the header under a scrim. Never leave a half-cut row of buttons at 390 or 1024 px. +0.5 U5.
4. Area panel copy:
   - Change "Annualised" to "Annualized" (BuildingPanel.tsx:220).
   - When `area.sample` is true, replace "Data: US Census Bureau ACS 5-year · OpenStreetMap" (AreaPanel.tsx:160) with "Sample figures; live mode: ACS 5-year and OpenStreetMap".
   - Move the "Add ?live=1&census=KEY" hint (AreaPanel.tsx:163–170) behind `?debug=1`.
   - Drop the "Plano, TX ·" prefix at AreaPanel.tsx:52–54, since the panel heading already names the city.

   +0.5 U4 (with #2).
5. Transit rows (LocationBrief.tsx:136, AreaPanel.tsx:150): add a 'bus' icon to the Icon set and use it instead of 'people'. Show the mode in words in each row's meta ("Bus · 0.2 mi", "Rail · 3.1 mi"), on screen and in the PDF. +0.5 U2.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Escape for the brief: in App.tsx's page-level handler (App.tsx:269–279), before the filter logic, add `if (state.mode === 'brief') { patch({ mode: 'area' }); focus the "Location brief" toggle; return; }`. Escape then narrows from a deep link, from <main> after a click in the brief, and from the header. Keep Inspector.tsx:105 for focus inside the panel. +0.5 X2.
2. Keyboard-scrollable sheet: give `.sp-ins__body` (Inspector.tsx:168) `tabIndex={0}`, `role="region"` and `aria-label={head.title}` whenever it is the sheet's scroller, or whenever its content has no focusable element. This clears axe's scrollable-region-focusable at 390 px and lets keyboard users page through the brief. +0.5 X4.
3. Bachelor's measure (src/domain/areaBrief.ts:16, 67, 128, 134; LocationBrief.tsx:28; CensusSource.ts ACS_VARS). Two options:
   - Preferred: switch to "bachelor's or higher" (B15003_022+023+024+025 over B15003_001; US ≈ 35%) and label it "Bachelor's or higher".
   - Otherwise: relabel everywhere as "Bachelor's as highest degree" and reword the point to "61% of people 25 and over have a bachelor's as their highest degree".

   Also footnote that live ring incomes are household-weighted averages of tract medians. +0.5 X3.
4. Return state after the brief:
   - Save `window.scrollY` on entering `mode=brief` and restore it on narrowing (observed 400 → 98).
   - When an Area panel opened from "See area details" closes, return focus to that link (BuildingPanel), not <main>.
   - Make AreaPanel.tsx:143's empty state "No stops on record", matching LocationBrief.

   +0.5 X2 (with #1 and UI #2).
5. Make the brief CRM-aware. When `inquiry=` is set or a block is selected, add a line under the brief title, e.g. "Prepared for Harbor Freight Regional HQ · 15,000–22,000 SF by Jun 30, 2027 · Floor 6 Ste 600". Add a "Log as sent to <inquiry contact>" activity stub (toast). Carry the "prepared for" line into the PDF's Location page; in prospect-safe mode it names the prospect, never a tenant. +0.5 X5.

BUGS (with file:line):
- src/components/map/map.css:87 (with :80, :84). At 1280 px in the Map view, Floor 12's "9,300 SF available" overprints "50.0% leased" (both at y=343; facts at x=69, share at x=79). Floor 1's second line wraps under the floor number.
- src/components/inspector/Inspector.tsx:105–114 and :147. The brief's Escape is bound only to `.sp-ins` onKeyDown. With ?mode=brief (focus on body) or after clicking brief text (focus on <main>), Escape does not narrow the brief; App.tsx:269–279 does not handle brief.
- src/components/inspector/Inspector.tsx:168. `.sp-ins__body` scrolls the phone brief (1269/680 px) but is not focusable: axe serious, scrollable-region-focusable at 390 px.
- src/components/kpis/KpiStrip.tsx:92. "Leased" loses `aria-pressed` and its underline in area, brief, worklist and issues modes while lens=status. Pipeline (lens only) does not; the two switches are inconsistent.
- src/components/ui/sheetHeight.ts:6. SHEET_MOST = 0.92 leaves a 68 px strip that cuts the header's control row in half at 390×844 and its facts line at 1024×768.
- src/components/inspector/BuildingPanel.tsx:220. "Annualised" violates the American English rule.
- src/domain/areaBrief.ts:134 (with :67, :128). "hold a bachelor's degree" describes a bachelor's-as-highest-degree measure (B15003_022 only, US 21.6%).
- src/components/map/AreaPanel.tsx:143. The empty state "No stops within half a mile" contradicts a list that includes stops at 3.1 and 4.6 mi.
- src/components/map/AreaPanel.tsx:160. "Data: US Census Bureau ACS 5-year · OpenStreetMap" is shown above "Sample figures for the demo" when `area.sample` is true.
- src/components/timeline/TimelineRows.tsx:465. At asOf=2028-06-01 the outside label "North American Asset Holdings · vacated" is placed after the ended bar and runs across the as-of cursor line.
