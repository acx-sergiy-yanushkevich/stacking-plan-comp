# Round 14 · Judge: Claude Opus 5.5 (A) · Ascendix palette default, Building view (alone, docking, docked), prospect-safe across every tab and lens, finder, keyboard, phone/tablet/print, live build at :4180
UI 18.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 3, U5 3) · UX 19.5/20 (X1 5, X2 3.5, X3 4, X4 3, X5 4) · Engineering 9/10

```
JUDGE: Claude Opus 5.5 (A)
ROUND: round-14

Method: read BRIEF, DESIGN, COMPETITORS §4–7 and JUDGE_PROMPT; went through all 47 round-14 shots and the three PDFs;
`npx vitest run` (40 files, 504 tests, all pass; working tree still clean afterwards); drove the live build with
Playwright (chrome channel). Scripted runs: prospect-safe text and aria scan of 20 states (every view, every lens,
worklist, issues, block selects, find, inquiry, search, asOf=2028, bucket, window); Building view dock frames at
50/150/300/600/1200 ms, Esc, KPI-row focus; full Tab order; stack grid arrows, Home/End, Enter, Esc; timeline cursor keys;
as-of popover focus; reduced motion; 390×844, 360×740 and 1024×768 overflow and target sizes; finder edge cases
(Direct, Sublease, today's date, 20,000 and 40,000 SF, multi-floor alternative). Scratch files are in /tmp/r14a only.

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: Stack, Timeline and Map keep the three bands (header, KPI strip, one toolbar),
then the plan card with its legend and the inspector beside it, which never covers the plan (00, 16, 18). The Building
view leads well: a model with floor tags that only say something where there is something to say ("12 · 9,300 SF
available", "3 · 5,500 SF available · holdover"; 33). Docked, the plate gets the full right column (839×315 measured
after a click; 34), so the round-13 small-plate bug is gone. Deduction: in the Building view the KPI strip is in a different
place in each state. With no floor open it is a vertical column inside the plan card, *below* the legend (33; at
1024 px a row inside the card, 42). One click on a floor and it jumps to a full-width band above the toolbar (34, 43),
while "Most space" disappears. The six numbers a broker reads first move on every open and close, and in the alone
state the legend is read before the KPIs, which breaks the header → KPIs → controls → plan order that every other view
keeps. Smaller: the alone state ends at y≈930 of an 1100 px viewport with an empty band under the card (33), and the
Floor 1 drill-in has a large empty area under the plate (22).

U2 Color & data encoding: 4.5/5: The Ascendix palette is restrained and coherent: navy surfaces, Primary Blue for
selection, rails and rollover bars, Primary Orange kept for focus and the "+500 SF over" and stale warnings. Status lens:
every state has a second cue (sublease dot pattern, committed hatch with "Signed, not in", dashed vacant/unaccounted,
Holdover/MTM pills with a left bar, the "Confidential" pill, "For sale"), and the legend gives SF and share for each
item. The light expiration lens now runs dark rust → pale cyan in lightness order, and holdover pink is clear of
2–3 yr lavender (checked live with ?theme=light&lens=expiry), so that round-13 complaint is fixed. Deduction: the dark
expiration ramp (01, 39) is a six-hue sequence (pale yellow, orange, red-orange, mauve, purple, slate blue). 3–5 yr
purple (Anadarko, Floors 9–11) and 5+ yr slate (Halcyon, Meridian) sit at almost the same lightness and become one
colour under deuteranopia. On the stack the "x yr y mo left" line saves it, but the Building/inspector 3D model and the
Map extrusion (19) carry the lens by colour alone. The ramp also runs the opposite way in the two themes (<6 mo is
the lightest tone at night and the darkest by day), so a printed day-mode PDF and a night-mode screen colour the same
lease differently.

U3 Typography & density: 3.5/4: Tabular figures everywhere; the text tiers work, and nothing that matters is cut off
(long names such as "North American Asset Holdings" and "Preston Park Café" wrap to two lines rather than clipping; print
shrinks "Conner CPA Group" instead of cutting it). Deductions: (a) in the narrow availability blocks the rate breaks
away from its lease type. Ste 860 reads "$31–$33/SF/yr" with "FSG" alone on a fourth line, and Ste 120 the same with
"NNN" (00, 01, 03, 08, 37), on the desktop stack in every lens. The brief makes rate + unit + type a single fact, and here
it is split and crowds the block's bottom edge. (b) Floor 1 plate: "Lobby · building use / 8,000 SF / Not leasable" is
set straight on the diagonal hatch, which runs through the glyphs (22, also at 390 px). (c) Tablet docked plate: Ste 860
falls back to a 9 px-looking "Available now / Ste 860 / 3,200 SF" with no rent, while Ste 850 beside it keeps the rent
(43).

U4 Polish & platform fit: 3/3: This reads as one product in both themes and both palettes. Glass panels keep text
legible (the KPI cards, inspector and toolbar all sit on near-opaque glass), hover/selected/dimmed/focus states are
distinct (selected Cirrus has an orange ring plus a highlighted floor gutter; dimmed blocks lose their text; focus is a
2 px orange outline on HTML controls, an orange halo on SVG blocks), and empty states have a sentence and an action
("No space fits 12,000 SF … Try 12 months later"). The palette switch and theme switch are tidy. The only flaw I found
is mid-dock: at 50 ms the KPI band slides in under the toolbar card and the moving model covers the floor rail's
percentages ("10 1(", "9 1(") for about 100 ms. Too brief to cost the point.

U5 Mobile & print visual quality: 3/3: 390 px stack is a clean list of floor cards, each with a to-scale bar and
suite rows with full facts and pills (23). The block sheet has a visible handle with a focus ring (24). The phone map now
collapses the legend to "Legend · 8 states" so the map starts at 49% of the screen (25b). No horizontal overflow at
390 or 360 in any view I loaded. The PDFs are presentation-grade: a cover with KPIs and a full-width plan, a rent roll
whose total line explains the 500 SF cap, and rollover, rent-by-type and the worklist on page 3. Minor: page 3 of the
prospect-safe PDF is about three-quarters empty (two short tables).

UI TOTAL: 18.5/20

UX SCORE
X1 Persona job coverage: 5/5: All ten jobs finish fast. Vacancy and largest block are in the KPIs and the Building
tags; expirations are in the expiration lens, the 12-month KPI (one click to lens + worklist), and rollover buckets that
highlight their leases; trust comes from issues (3 errors, 2 warnings, 3 info with fix/locate/mark reviewed),
"1 record stale" and "Verified" dates. The finder takes an exact date including today, Direct/Sublease and an inquiry;
the identify/open record path works from any block. The owner and prospect-safe PDFs plus CSV are there.
Direct/sublease/later/committed each have their own state. Time travel recomputes the KPIs with deltas (07, 17).
Pipeline shows on each vacancy and in the deals lens.

X2 Interaction & IA: 3.5/4: Coherent views, a URL that round-trips every state, a filter summary bar with Clear,
inspector modes with Close, KPI cards that are shortcuts, and Esc that closes the open floor (verified: ?floor=F8 → /,
focus back on the Floor 8 rail button). Deductions:
(a) The finder lists the same floor twice under Alternatives when Type is Direct: for 12,000 SF it shows
"Floor 8 · Direct · Now · 4,600 SF short · 7,400 SF" and then "Floor 8 · Direct · Now · 7,800 SF short · 4,200 SF". The
second row is a subset of the first (Ste 850 alone), neither row names its suites, and it takes one of the four
slots (src/domain/finder.ts:297-298 push the floor total and then every single suite of the same floor).
(b) The no-results state gives advice that does not apply. For 40,000 SF with no maximum, no type and no date set, it
says "Raise the maximum, drop the type filter or move the date…".
(c) In prospect-safe the Deals lens is removed, but "Expiration" stays in the lens control and turns into a second
status lens: every lease reads "Leased", and the legend becomes Leased/Sublease/Committed/Vacant/For sale.
Clicking it does nothing useful, and it says nothing about why. The KPI strip has the same mismatch: "Expiring 12 mo:
Withheld · Lease terms are not shown in prospect-safe mode" sits beside "WALT 2.98 yr · In-place, SF-weighted", which is
a lease-term figure.
(d) The Building view's KPI strip moves between states (see U1). The cost of that is also IA: the same buttons are in a
different tab position and place on the page depending on whether a floor is open.

X3 Trust & domain correctness: 4/4: Numbers check out by hand. Leased 211,200 = 211,700 recorded − 500 over on
Floor 7, and 86.1% of 245,400. The 12-month expiry of 35,300 = Café 2,400 + Cirrus 21,400 + BeachBody 5,000 + NAAH
6,500. The 7–8 yr bucket of 22,000 = Meridian 14,000 + Lumen 8,000. At 2028 the <12 mo bucket of 21,600 = Kinetic +
WBH + Conner. The NNN average of $41.10 is converted correctly from the Café's $3.25/SF/mo. Holdover ("Expired Aug 2026",
held at 2028), MTM (0 in WALT, "At risk"), the sublease's own state and term, committed not counted as occupied
(80.2% occupied vs 86.1% leased), the confidential lease's rent hidden in every lens and the rent roll, the for-sale
condo out of the rent scale, and the lease without units and the lease without a floor both shown as "Not placed" in
the rent roll. Prospect-safe: across 20 live states, no tenant, contact or prospect name appears in text or aria, and
no in-place rent. A safe link drops asOf (?safe=1&asOf=2028-01-01 → ?safe=1) and the as-of button is locked "Fixed to
today". Leases read "term not disclosed", the rollover and worklist are withheld, the safe PDF has no lease dates, and
the unpublished Ste 600 listing does not appear ("Nothing marketed ahead"). One note, not a deduction: the sublease
availability keeps "thru Sep 30, 2030" in safe mode (plan, timeline, PDF rent roll row "Tenant (sublandlord) … thru Sep
30, 2030"), which is the sublandlord's lease end. It is normal marketing information for a sublease, but it is the
one lease end date a prospect can read.

X4 Accessibility of interaction: 3/3: There is a skip link; the Tab order is logical (header → KPIs → view/lens radios
→ search → Find/Worklist → one tab stop into the grid → rollover → inspector). The grid is a role=grid with roving
tabindex: arrows move across suites and floors, ← from the first suite reaches the rowheader, Home/End work,
Enter selects (select=L13-U1), and Esc clears with focus kept on the block. The timeline cursor is a role=slider (→ one
month, Shift+→ one year, Home today). The as-of popover moves focus to "Today", and Esc returns it to the button. The
Largest block, Available and Expiring KPIs move focus to the inspector heading, WALT to the timeline's first bucket.
Reduced motion leaves 0 elements with transitions over 50 ms. Every block has a full accessible name. Phone and tablet
targets are 22–24 px tall with enough spacing.

X5 CRM workflows & differentiation: 4/4: Uses what only the CRM knows: activity recency pills on blocks ("Call 40 d",
"Meeting 7 d", "No activity"), live-deal counts and stages, inquiries that fit each vacancy, the inquiry-driven finder,
a change history per record ("Term Expiration Date Jun 30 → Mar 31, 2027 · Elena Ruiz"), stale-record flags, broker
and last touch in the worklist, and record actions (New deal on Floor 8, Log call with the expiring tenant, Start
renewal, Add unit). The marketed-for-later lease is linked to its quiet availability and its deals. VTS, CoStar, Yardi
and Prophia do not join these to the plan.

UX TOTAL: 19.5/20

ENGINEERING (informational): 9/10: The domain layer is pure TypeScript with 504 passing tests across 40 files,
including palette contrast checks (src/styles/paletteChecks.ts), safe-mode projections, the finder, rollover and
exports. One URL-synced state hook; the components are split by view, and the inspector modes are separate panels.
Prospect-safe is a model transform (src/domain/safe.ts) rather than scattered conditionals, which is why the text scan
comes back clean. The finder's near-miss generator (finder.ts:293-299) emits overlapping candidates and relies on
key-dedupe only, so subsets get through. For LWC portability, the SVG plan, tokens and per-component CSS port cleanly;
the 3D building and MapLibre will need a separate approach under Locker/LWS.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Keep the Building view's KPI strip in one place. In BuildingView.tsx / building.css, render the six KPI cards as the
   same full-width band above the toolbar in the alone state too (as in 34/43), and keep "Most space" chips in the left
   column under the floor rail; or keep them in the left column in both states. Either way, KPIs come before the legend,
   and opening a floor does not move them. Expected: +0.5 U1.
2. Keep rate and lease type together in narrow blocks. In segmentText.ts (and the textFit tiering), treat
   "$31–$33/SF/yr FSG" as one token. Join with U+00A0 between "/yr" and the type, or when it would wrap, drop to the
   compact "$31–33 FSG" form, so "FSG"/"NNN" never sits alone on a line (Ste 860, Ste 120 on the desktop stack).
   Give the Floor 1 lobby label a solid backing plate (card colour at 85% behind the text) so the hatch does not run
   through the glyphs. Expected: +0.5 U3.
3. Make the dark expiration ramp lightness-monotonic. In tokens.css / the Ascendix dark tone set, re-space
   --tone-exp-4 (3–5 yr) and --tone-exp-5 (5+ yr) by at least 15 L* (for example keep 3–5 yr purple and take 5+ yr
   to a deep navy-blue well below it), and run it through paletteChecks with a deuteranopia simulation. Then add a
   small "x yr" text tag or pattern to the 3D model's selected/hovered floor slab. Expected: +0.5 U2.
4. Prospect-safe PDF page 3: put "Space on offer" and "Coming supply" on page 2 under the rent roll (which has room)
   and drop to two pages, or enlarge page 3 into a one-page availability sheet with the Floor plates of the floors on
   offer. Expected: polish, keeps U5 at 3.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Stop the finder listing a floor's subset beside its total. In src/domain/finder.ts:297-298, when a floor yields a
   whole-floor total row (sp.length > 1), skip the single-suite rows for that floor (or keep only the larger), and show
   the suites in the row ("Floor 8 · Ste 850 + 860"). Add a test: req=12000, type=direct → exactly one Floor 8 row.
   Expected: +0.25 X2.
2. Make the no-results advice match the inputs. In FindPanel.tsx, build the sentence from what is actually set: only
   mention "raise the maximum" when max is set, "drop the type filter" when type ≠ any, "move the date" when by is
   set. Otherwise say "The largest block is 9,300 SF; the closest combinations are below." Expected: +0.25 X2.
3. In prospect-safe, hide the Expiration lens button the way Deals is hidden (or disable it with the tooltip
   "Expiration is withheld in prospect-safe mode"). Either withhold WALT as well, or give its note the same reason text,
   so the KPI strip does not show a lease-term figure next to "Lease terms are not shown". Expected: +0.5 X2.
4. Decide on the sublease end date in prospect-safe and make it explicit: either keep "thru Sep 2030" and label it
   "Sublease term (marketed)" in the plan, timeline and PDF, or show only "Sublease · term on request". Then drop the
   "Tenant (sublandlord)" label from the safe rent roll; "Tenant" is enough. Expected: closes the last date
   inference, keeps X3 at 4.

BUGS (with file:line):
- src/domain/finder.ts:297-298: nearMisses pushes a floor's combined total and then each single suite of the same
  floor; dedupe at :309-316 is by exact key set, so the subset survives. Repro: ?view=stack&mode=find&req=12000&fit=direct
  → Alternatives list "Floor 8 · 7,400 SF" and "Floor 8 · 4,200 SF" (Ste 850 alone), neither naming its suites.
- src/components/inspector/FindPanel.tsx (no-results empty state): with req=40000 and no max, type or date set, the
  advice still reads "Raise the maximum, drop the type filter or move the date to include space marketed for later."
- Prospect-safe lens set: Expiration stays selectable and renders a status-like legend (Leased 196,700 · Sublease ·
  Committed · Vacant · For sale) with no expiry information, while Deals is hidden. WALT 2.98 yr still shows beside
  "Expiring 12 mo: Withheld · Lease terms are not shown".
- Prospect-safe sublease date: "Sublease thru Sep 2030" (plan, timeline bar "thru Sep 30, 2030", PDF rent roll row
  "Tenant (sublandlord) … thru Sep 30, 2030") is the sublandlord's lease end. Arguably marketing information; noting for a
  conscious decision.
- Building view dock (BuildingView.tsx / building.css): at about 50 ms into the dock the KPI band overlaps the toolbar
  card's top edge and the moving model covers the floor rail's percentages. Gone by 150 ms.
- Round-13 fixes, checked after scoring, have all landed. The plate opens at full size on a click (839×315). Esc
  closes the open floor with focus back on the rail row. After a KPI click, focus goes to the inspector heading. The
  docked model tags only the open and hovered floors. A safe link drops asOf and the as-of control is locked. Unpublished
  availabilities stay out of safe mode. Safe output has no rollover counts, commencement dates or committed end date.
  The finder has an exact date input with Today, applies the type to alternatives, and a multi-floor alternative
  highlights every suite (Floors 7–8 → 850, 860, 720). The map floor list uses lensFact. The phone map legend is
  collapsed. Tablet 1024×768 shows the floor KPI row on the first screen. The day expiration lens separates holdover
  from 2–3 yr. One round-13 fix landed only in part: the dock still overlaps mid-motion (above).
```
