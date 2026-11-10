# Round 11 · Judge: Claude Opus 5.5 (A) · standalone app, Vice City glass skin; Building view as the landing screen, floor pin/preview, No-activity rule, leased-fill fix
UI 17/20 (U1 4.5, U2 4, U3 3.5, U4 2.5, U5 2.5) · UX 17.5/20 (X1 5, X2 3.5, X3 3, X4 2.5, X5 3.5) · Engineering 8/10

```
JUDGE: Claude Opus 5.5 (A)
ROUND: round-11

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: The Building landing screen (33, 34) has a clear order: header, six KPIs, one toolbar, then the model on the left and the floor plate, KPIs and tabs on the right. The plate is the largest element and the eye lands on it. Pinning Floor 8 lifts the floors above it and outlines the pinned slab in pink (34). This is an improvement on round 10's small panel model. Deductions: with the inspector open (35, and live with select=A02) the model shrinks into a pale, ghosted mass with empty space above and to its left, and its floor tags (12…1) sit away from the slabs they label. The Stack view (00) is unchanged and still the best-ordered screen.
U2 Color & data encoding: 4/5: The status lens works on the night palette. The lighter leased fill now reads as blocks rather than as the card, and sublease (dots), committed (hatch), vacant (dashed) and holdover/MTM (left bar plus badge) never rely on colour alone. The legend shows SF and share. Deductions:
  - Rent lens (03): the FSG steps $28–30.99, $31–33.99 and $34–37.99 are almost the same mid-blue on purple. Kinetic $36, Meridian $34 and Anadarko $31 look identical, so the heat map fails and only the printed rate carries the meaning.
  - Expiry lens (01): the "1–2 yr" red is close to the Holdover/MTM maroon.
  - Map (18): the extruded floors are lit and desaturated (lavender-grey, tan), so they do not match the legend swatches drawn above the map.
  - Building find mode (35): every floor is ghosted, and the matching Floor 6 barely stands out in the model.
U3 Typography & density: 3.5/4: Figures are tabular throughout, the scale is sensible, and the plate labels carry tenant, suite, SF and expiry. Remaining problems:
  - In the rent lens, narrow tiles shrink to a smaller ad-hoc size ("Conner CPA Group", "Preston Park Café" at about 10 px), which breaks the type scale.
  - In find mode, "Available now" wraps because the "1 inquiry fits" badge pushes it (08, Floor 8).
  - The phone timeline cuts names off at the right edge ("North American Asset H…", "Argosy Partners · Ste 300 · 11,0").
  - At 800 px the KPI labels wrap to two lines ("LARGEST / BLOCK", "EXPIRING 12 / MO").
U4 Polish & platform fit: 2.5/3: The neon-on-purple skin is coherent and distinctive, and the daytime sunset version (36–37) is clean. Hover, pin, selected and focus states are consistent, and axe found no WCAG 2 A/AA violations on six Building and Stack states, including light, find, safe and expiry. Deduction: translucency costs legibility exactly where it matters. In find mode, or with the inspector open, the Building model becomes a stack of semi-transparent ghosts in which no single floor reads (35). The quality of the landing screen depends on that state.
U5 Mobile & print visual quality: 2.5/3: The print and PDF output is presentation-grade (28): a cover with KPIs and the plan, a full rent roll with honest totals and the over-allocation note, then rollover, worklist, in-place rent by lease type and coming supply. The phone stack cards (23–24) are readable. Deductions: the phone timeline clips names and figures at the right edge with no visible scroll affordance (25). The KPI strip cuts "LARGEST BLOCK" off at the screen edge. The new landing screen does not exist below 1100 px: tablets (1024 px) and phones land on Stack with no Building tab.
UI TOTAL: 17/20

UX SCORE
X1 Persona job coverage: 5/5: All ten jobs can be done quickly:
  - Occupancy and vacancy on landing.
  - The "most space available" floor opens by default.
  - Rollover buckets, worklist windows and time travel with KPI deltas (07).
  - Find space with inquiry pre-fill, two-floor combinations and shortfalls (08, 14).
  - Data issues with fix and locate actions (06), and unaccounted area traced to Delta Dental (13).
  - A prospect-safe export (the print output was checked and contains no names, rents, holdover or deal text).
  - Direct, sublease, later, committed and for-sale are told apart.
  - The deals lens.
X2 Interaction & IA: 3.5/4: The preview-on-hover, click-to-pin model is learnable. Status text says "Preview · click the floor to pin it", "Pinned" and "First match…", and there are explicit Unpin and Full floor plan buttons. The filter bar plus Clear is consistent across Find, Worklist, Bucket and Search. Deductions:
  - The landing screen depends on viewport width. Below 1100 px `?view=building` silently renders Stack (App.tsx:191) and the tab disappears (Toolbar.tsx:22-23), so a shared link opens a different view on a tablet.
  - With the inspector open, the floor picker is hidden (building.css:31). The only way to change floors is the mouse-only model, or closing the inspector first.
  - The floor picker has no arrow-key navigation: ArrowDown on a floor button does not move focus, so it takes 12 tab stops.
X3 Trust & domain correctness: 3/4: The numbers check out:
  - 245,400 RSF is the sum of the floors. Available is 33,200 (26,200 direct plus 7,000 sublease).
  - Leased is capped at 211,200 because of the disclosed Floor 7 over-allocation, giving 86.1%. Occupied is 80.2% (196,700).
  - Expiring 12 months is 35,300, 16.7% of leased. NNN is annualised correctly ($41.10, combining $3.25/mo and $42/yr).
  - Holdover and MTM are kept out of the rollover years. The confidential lease shows a lock with no rent.
  - At 2028, "Vacated" projections and the delta chips are right.
  - The tightened No-activity rule (12 months) is in segmentText.ts:167 and has tests.
  The deduction is a prospect-safe leak on the new landing screen. The floor tabs under the plate (FloorLists, used by both the Building and Floor views) stay live in safe mode:
  - Deals (2) on Floor 6 lists "LOI · Prospect · 21,400 SF · Ste 600 · Dana Whitfield · updated Nov 5, 2026" and "Tour · 15,000 SF · Marcus Webb".
  - Inquiries (1) shows "15,000–22,000 SF · needed by Jun 30, 2027 · Crexi".
  - Issues shows "A tenant is month-to-month" and "A lease is missing from the plan" on Floor 2.
  The app's own policy says otherwise: the Pipeline KPI reads "Withheld", and the inspector says "Deal activity is withheld in prospect-safe mode" (BuildingPanel.tsx:205) and "Tenant risk is withheld" (BuildingPanel.tsx:109). The header hides Data issues in safe mode, but the tab exposes them. Also borderline: Cirrus's quiet (unpublished) listing still shows "Avail Apr '27" and appears in Coming supply in safe mode (segmentText.ts:101), which tells a prospect about off-market space.
X4 Accessibility of interaction: 2.5/3: In practice: a skip link, a logical tab order (header, KPIs, toolbar, floor picker), the role="grid" stack with arrow keys, a polite live region on the Building state, and no axe violations in six states. Deductions:
  - The model is an image. Its keyboard equivalent, the floor picker, is display:none whenever the inspector is open (building.css:31), so a keyboard user in Building view with a suite selected cannot reach any other floor.
  - The picker has no roving or arrow keys.
  - The aria-live "Preview · click the floor to pin it" fires on every pointer pass and focus move, which makes it noisy for screen-reader users.
X5 CRM workflows & differentiation: 3.5/4: The product uses what only a CRM knows: deals per vacancy by stage, inquiry-fit matching with pre-filled finder and "Fits this inquiry" badges, last-touch badges ("Call 40 d", "Meeting 7 d", "Email 87 d"), a renewal worklist with Log call / Start renewal, change history per record, verified stamps, a stale-record issue, and a quiet-listing flag. This is clearly ahead of the VTS, CoStar and Yardi stacking views. Deduction: the new landing screen adds no CRM action of its own. The floor tabs list deals and inquiries, but the only actions are "select suite" and "highlight". There is no "New deal on this floor", "Log call", or opening the inquiry record from the Building view without a detour through the inspector.
UX TOTAL: 17.5/20

ENGINEERING (informational): 8/10: There are 241 vitest tests in 25 files, and all pass, including the new segmentText.test.ts (No-activity rule) and BuildingView.test.tsx. src/domain is pure TypeScript with tests alongside, and state is one URL-synced model. The uncommitted BuildingHero change fits the viewBox to the drawn bounds instead of a fixed W×H box, which is a sensible fix. The weaknesses are prospect-safe policy and structure:
  - Prospect-safe policy is enforced per component (BuildingPanel withholds deals, while FloorLists and the floor tab counts do not). There is no central `safe` projection of the model, which is exactly how this round's leak happened.
  - The view swap based on width is done twice (App.tsx:191 and Toolbar.tsx:22).
  - LWC portability is fine for the CSS-token approach, but the hover store and the SVG viewBox fitting are React-specific.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Building model in find, worklist and inspector states (BuildingHero + hero.css): draw matching floors' slices at full opacity with their lens fill and a 2 px brand edge. Drop non-matching floors to about 25% fill but keep their outline at 0.6 opacity so the silhouette stays. Never ghost the floor shown on the right. Re-centre the narrowed model vertically in its column and anchor the floor tags to each slab's right edge. Fixes the illegible 35 and the inspector-open state. +0.5 (U4), +0.5 (U1).
2. Night rent ramp (vice.css rent tokens): spread the five FSG steps over a lightness range of at least 35 L* (for example #1d3a66 → #2f6fb0 → #4fa3d9 → #8fd3f0 → #d4f3ff, with dark text from step 4). Check neighbouring steps at ΔE ≥ 12 against the purple card. Also move the expiry "1–2 yr" red to a clearly lighter coral, so it separates from the Holdover/MTM maroon. +0.5 (U2).
3. Phone timeline (timeline.css ≤760 px): keep the label column sticky and let bars scroll inside a container that shows a fade or shadow and a "scroll →" hint. When a bar's label overflows the viewport, put it on its own line above the bar instead of clipping it. Give the KPI strip a visible scroll affordance (peek of the next card plus snap padding). +0.5 (U5).
4. Rent-lens narrow tiles: drop the ad-hoc smaller font. Use the standard 12 px meta size and fall back one text tier (name plus SF, rate in tooltip and inspector) when the rate does not fit. In find mode, put the "1 inquiry fits" badge on its own line below the name when the tile is under 200 px. +0.5 (U3).
5. Map extrusion colours (map style): use the lens tokens unlit, or set `fill-extrusion-vertical-gradient: false` and the light intensity to about 0.15, so the slab colours match the legend swatches above the map. +0.25 (U2).

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Prospect-safe floor tabs (src/components/floor/FloorLists.tsx:36-41, 68-160): when `safe`, render only the Suites tab. Hide Deals, Inquiries and Issues, together with their counts, in both the Building and Floor views. This matches BuildingPanel.tsx:109/205 and the header's hidden Data issues. Add a test in safe.test.ts or Floor.test.tsx asserting no "LOI", "Tour", inquiry source or issue title appears in either view when safe=1. +1 (X3).
2. Floor picker stays with the inspector open (building.css:31): instead of `display:none`, show a compact one-column picker (floor number only, 32 px buttons) beside the narrowed model. Give it roving tabindex with ArrowUp/Down, Home/End and Enter to pin (MiniStack.tsx). +0.5 (X4), +0.25 (X2).
3. Building view below 1100 px (App.tsx:191, Toolbar.tsx:22): at 761–1099 px render the Building view as one column (model and picker in a row above the plate and tabs) instead of silently swapping to Stack. On phones keep Stack, but show a one-line notice when `view=building` was requested ("Building view needs a wider screen; showing Stack"). +0.25 (X2), +0.25 (U5).
4. Quiet listings in prospect-safe (segmentText.ts:101, BuildingPanel coming supply, print coming supply): when `safe` and `seg.marketed.published === false`, suppress the "Avail Apr '27" badge and leave that SF out of Coming supply, or add a header toggle "Include quiet listings" that defaults off in safe mode. +0.25 (X3).
5. CRM actions on the Building floor column: add a row of toast-stub actions under the floor KPIs ("New deal on Floor N", "Create availability", "Log call with the next-expiring tenant"). Make each Deals and Inquiries row open its record (toast), not only select the suite. +0.5 (X5).

BUGS (with file:line):
- Prospect-safe leak: deal stage, SF, broker and dates, inquiry size, date and source, and data-issue titles are shown in the floor tabs in safe mode. This contradicts the "withheld" policy elsewhere. src/components/floor/FloorLists.tsx:36-41 (tab counts), :68 (deals), :103 (inquiries), :136 (issues). Policy text: src/components/inspector/BuildingPanel.tsx:109, :205.
- Keyboard users lose all floor navigation in Building view while the inspector is open: the picker is hidden. src/components/building/building.css:31.
- MiniStack floor buttons have no arrow-key handling despite being the keyboard equivalent of the model. src/components/floor/MiniStack.tsx:30-33 (only pointer and focus handlers).
- `?view=building` silently becomes Stack below 1100 px (a shared link opens a different view). src/App.tsx:191, src/components/shell/Toolbar.tsx:22-23.
- The aria-live Building status announces on every hover or focus preview. src/components/building/BuildingView.tsx:118-120.
- Quiet (unpublished) listing still badged "Avail Apr '27" in prospect-safe. src/components/plan/segmentText.ts:101.
- Round-10 fixes checked: the duplicate focused-floor extras are fixed (04, 05), the tablet header wraps cleanly at 800 and 1024 px, the pinned slab has a visible pink outline, and new tests cover the No-activity rule and the Building view.
```
