# Round 12 · Judge: Claude Opus 5.5 (B) · standalone Vice City glass app; Building view alone/docked with live-driven transition, measured palette, prospect-safe policy module, phone/tablet, PDFs
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 18/20 (X1 5, X2 3, X3 3.5, X4 2.5, X5 4) · Engineering 8.5/10

```
JUDGE: Claude Opus 5.5 (B)
ROUND: round-12

Method. I looked at all round-12 shots (00–43) and the three PDFs. Then I drove the live build at
http://localhost:4180/ with Playwright (Chrome channel), writing scratch files to /tmp only:
- Dock/undock timing, sampled every ~65 ms, with and without reduced motion.
- Quick-start click accuracy at 1100, 1280, 1440 and 1920 px, each at three heights within the button.
- The full Tab order, plus the picker's ↑ ↓ Home End Enter keys.
- Plate arrow keys, Enter to open the inspector and Esc back.
- axe on 7 states.
- An extended prospect-safe sweep with the repo's leakcheck rules on 228 states (desktop and 390 px):
  every segment selected in Building and Timeline, every floor × every lens with every tab opened, and
  every inspector mode.
- Responsive checks at 390, 768, 1024, 1100 and 1200 px (overflow, smallest rendered type).
- The vitest suite (335/335 pass), run with cacheDir redirected to /tmp. Nothing was written in the repo.

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: The order is clear: title band, six KPI cards, one toolbar, then
the plan card with the legend and the over-allocation note in its head. Alone, the model is the hero
(shot 33) and the "N · 9,300 SF available" tags read at a glance. Docked (34, 38), the model, the plate,
the numbers, the record actions and the tabs read left to right, and the picker stays visible with the
inspector open.
−0.5: In the alone state the left column ("Pick a floor", three quick starts) ends about 300 px above the
card's bottom, leaving a dead block. The picker floats mid-card, detached from the prompt that refers to
it (33, 36, 39). Docked at 1440×1000, the floor KPIs and tabs start below the fold, so the plate and its
numbers are never seen together without scrolling (live: docked.png; plate caption at y≈846).
U2 Color & data encoding: 4.5/5: The palette is measured (vice.test.ts). Patterns carry state: dots
for sublease, hatch for committed, dashed for vacant/unaccounted. The expiry ramp steps in hue and
lightness. Each floor has a text fact beside the model in every lens, so colour is not the only cue on
the model. Under a filter, non-matching suites go neutral (35).
−0.5, two problems:
(a) By day the same "Leased" state has two colours side by side. The model uses the periwinkle solid
#9097cc (vice.css:108), while the legend swatch and the plate use #dfe3f0 (vice.css:103). See shot 40:
S&P Enterprises is mid-blue on the model and pale grey on the plate next to it.
(b) In the deals lens (live, lens=deals) the four stages (Lease out, LOI, Proposal, Tour) are close
magenta/purple steps. Under face shading on the model, LOI and Proposal are hard to tell apart. The floor
tag says only "N live deals", never the stage.
U3 Typography & density: 3.5/4: Tabular figures throughout. Plate slices fall back by width without
truncating names ("Available now / Ste 860 / 3,200 SF" drops the rate only when narrow). The PDF
plate wraps "Preston Park / Café" rather than clipping it.
−0.5: The docked model's floor numbers render at 7.5 px at 768 and 1024 px, and 8.5 px at 1100–1200 px
(measured from the SVG scale; see 43). The inspector's mini-model numbers render at about 5.4 px. With
the inspector open, the picker drops its leased % and shows bare floor numbers (38).
U4 Polish & platform fit: 2.5/3: The glass skin is coherent in night and day, and focus rings are always
visible. The dock is a real FLIP: the stage translates over about 760 ms, the floor pane fades in, and
under reduced motion both are skipped (verified: transform `none` at every sample).
−0.5, motion and hover polish:
- Pointing at a "Most space" button rewrites the prompt into a longer three-line paragraph, so all three
  buttons jump 19.5 px down under the pointer (BuildingView.tsx:155-156). The jump is visible and moves
  the click target.
- Mid-dock, the model slides under a stationary pointer and the right pane flips to "Floor 10 · Preview"
  before settling on the pinned floor (mid-dock.png).
- Undock starts with the 717 px stage 45 px off the card's left edge (left = −45 at t=0), and the picker
  is covered during the first frames.
U5 Mobile & print visual quality: 2.5/3: The phone stack cards, block sheet and timeline (label above
each bar) are clean at 390 px, with no horizontal overflow on any view. The PDFs are presentation-grade:
cover KPIs, plan with legend, rent roll with a reconciled total and footnotes, rollover, rent by type, and
worklist.
−0.5: The tablet docked Building view (43, and live at 768/1024) shows the model as a small figure with
7.5 px floor numbers above a very large plate, which reads unbalanced. At 768 px the toolbar's second
row pushes the search field to x≈165 with an empty band to its left.
UI TOTAL: 17.5/20

UX SCORE
X1 Persona job coverage: 5/5: All ten jobs are done fast:
- Occupancy by floor (picker %, model tags).
- Expirations in months from as-of (expiry lens tags: "Expires Mar '27", "Holdover / MTM").
- Trust (over-allocation note, Data issues 8, stale record).
- Find space 12,000 SF, with alternatives and stacked floors (35).
- Identify a suite and open its record.
- Owner and prospect-safe PDFs.
- Direct vs sublease, now vs later ("21,400 SF marketed from Apr '27"), committed.
- Time travel.
- Data gaps.
- Deals per vacancy.
I recomputed the KPIs from the legend and the rent roll: 211,200 leased = 196,700 + 8,000 + 7,000 − 500;
four leases total 35,300 SF in < 12 mo; FSG $30.71 and NNN $41.10 weighted by recorded SF. All match.
X2 Interaction & IA: 3/4: Pin, preview and unpin are coherent. The picker previews on arrow keys and pins
on Enter. Search opens the first match ("First match · click a floor to pin it"). Previewing Floor 6 and
then searching "kinetic" now shows Floor 12, which fixes the round-11 bug.
−1, the landing screen's primary shortcut is unreliable by mouse. Measured with human-like pointer moves:
- A click at the vertical centre of any of the three "Most space" buttons opens nothing, at 1100, 1280,
  1440 and 1920 px.
- A click in the top quarter of "Floor 8 · 7,400 SF" opens Floor 12, and the top quarter of
  "Floor 7 · 7,000 SF" opens Floor 8. Only the bottom ~8 px of each button works.
The cause is the hover reflow in U4 (BuildingView.tsx:155-161). In addition, once a floor is pinned,
hovering any floor of the docked model swaps the whole right pane (head, plate, KPIs, tabs) to that
floor's preview (BuildingView.tsx:51). The picker sits to the left of the model, so every trip from the
plate to the picker drags the pointer across the model and flips the pane through several floors. The
pane's height changes and the page jumps.
X3 Trust & domain correctness: 3.5/4: RSF is labelled. Holdover, MTM, sublease, committed and
confidential are distinct, and the confidential rent shows "Confidential" in the rent roll. The
over-allocation is disclosed and capped, and unplaced leases are listed as "Not placed (data issue)".
In-place rent by type excludes committed and confidential leases and weights by recorded SF. The
extended prospect-safe sweep (228 states, every tab, desktop and phone) found 0 real leaks. Its only
hit, "Ste 300", is a suite number. Quiet listings, deal counts, issue counts, record actions and the
search echo are all withheld, and the header shows only "Listed for sale".
−0.5: Prospect-safe singles out exactly the at-risk tenants. Every other lease shows "Exp Jun 2029";
only the holdover (Ste 300) and the MTM (Ste 230) read "Term not disclosed". The same applies to the
inspector ("Sep 1, 2016 – not disclosed"), the timeline and the expiry legend ("Term not disclosed
17,200"). safe.ts:58 says "so neither stands out", but both stand out (segmentText.ts:101,
BlockPanel.tsx:131, lenses.ts:213).
X4 Accessibility of interaction: 2.5/3: Strong overall:
- Skip link, focus rings everywhere, a polite live region that announces only pins ("Floor 8 open").
- The picker is one tab stop (roving tabindex; ↑ ↓ Home End Enter verified).
- The plate suites are one tab stop with arrow keys, Enter opens the inspector, and Esc returns focus to
  the suite.
- Reduced motion is honoured, and axe is clean on 7 states including light and prospect-safe.
−0.5:
(a) "Full floor plan" still drops focus to <body> (verified live: Enter on it, then activeElement is
BODY). This is round-11's bug, unchanged: BuildingView.tsx:179, actions.ts:24, and FloorView has no
focus target.
(b) The fact beside each floor ("9,300 SF available", "Expires Mar '27", "2 live deals") lives only in
the aria-hidden visuals of the role=img model. The picker's accessible names stay "Floor 12, 50.0%
leased" in every lens (MiniStack), so a screen-reader user never gets the lens fact.
(c) The model's label claims "The stack lists the same suites" (BuildingHero.tsx:214), but no stack is on
screen in the Building view.
X5 CRM workflows & differentiation: 4/4: Record actions sit under the floor's numbers: "New deal on
Floor 8", "Create availability", and "Log call with <next expiring tenant>". Availabilities match
inquiries with contacts, and deals show stage and owner. There are "Open record" actions, the renewal
worklist with last touch, "No activity" and "Call 40 d" badges, and the change history and stale
stamps. Inquiry-backed finds honour the type: `?inquiry=I02&fit=sublease` gives 0 options. VTS, CoStar,
Yardi and Prophia do not tie live pipeline and inquiries to the plan like this.
UX TOTAL: 18/20

ENGINEERING (informational): 8.5/10: The domain is pure TypeScript with 335 passing tests (33 files),
including vice.test.ts, which turns the contrast claims into assertions. Prospect-safe really is one
module of named questions and projections (safe.ts), and safeFloors removes quiet listings before
anything derives from them. The leakcheck script is a useful regression net. The dock is a small,
correct FLIP with WAAPI and a reduced-motion guard (BuildingView.tsx:73-86). Deductions:
- BuildingView couples a pointer-hover store to layout-changing text, which produces the quick-start
  misfire. No test exercises a pointer path through that hover. The BuildingView tests are logic-level.
- `floor = hovered ?? open` lets any incidental hover replace the pinned pane.
- For LWC, the hover store and the SVG model port fine. The FLIP uses getBoundingClientRect across two
  layouts, which will need care inside shadow DOM.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Stop the alone panel from reflowing on hover (BuildingView.tsx:155-156, building.css:21-23). Give
   `.sp-bview__alone .sp-floor__facts` a fixed `min-height` of three lines (4.5em at line-height 1.5), or
   render the hover facts in an absolutely positioned line that does not move `.sp-bview__starts`.
   Remove `onPointerEnter`/`onPointerLeave` from the quick-start buttons (line 161), since hovering a
   button need not preview. The quick starts then stop jumping. +0.5 U4, and it is also UX fix 1.
2. Use one daytime "Leased" colour on the model and the plate (vice.css:103/108). Either set
   `--tone-leased-fill` to the solid #9097cc by day, with text #111827 (check ≥4.5:1), or make the model
   use the fill with its #677097 edge. Then the legend swatch, the plate and the model agree. In the deals
   lens, add the most advanced stage to the floor tag (floorFact.ts:22-23): "LOI · 2 live deals".
   +0.5 U2.
3. Make docked-model floor numbers at least 11 px rendered. In BuildingHero, when `size="stage"` and the
   stage is under 420 px wide, scale the label font by `1/svgScale`, or render the numbers as HTML beside
   the SVG. Keep the leased % in the picker with the inspector open by narrowing the % text to 11 px
   instead of hiding it. +0.5 U3.
4. Clean up the transition edges. In the FLIP (BuildingView.tsx:81-85), clip the stage with
   `overflow: clip` on `.sp-bview__model` during the animation, so undock never starts off-card.
   Ignore `setHoverFloor` while `stageRef.current.getAnimations().length > 0`, so the pane does not flip
   to "Preview" mid-dock. +0.25 U4.
5. Tablet docked layout (building.css 761–1099 media block): put the model and picker in a row beside the
   floor head and KPIs, at a height of about 360 px, rather than a small centred figure over a full-width
   plate. At 768 px, left-align the toolbar's second row (search, Find space, Worklist) to the card's left
   padding. +0.5 U5.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Quick starts must open the floor they name on the first click (BuildingView.tsx:155-161). Apply UI
   fix 1. Add a Playwright check: for each quick start, `mouse.move` to its centre in 8 steps, then down
   and up, and expect `?floor=` to be that floor. Today the centre misses and the top quarter opens the
   floor above. +0.5 X2.
2. Keep the pinned floor in the pane while the pointer is on the docked model. Change
   BuildingView.tsx:51 to `floor = open` when pinned. Show a hovered floor only as a highlight on the
   model and the picker, plus a one-line hint in `.sp-bview__state` ("Floor 10 · 100.0% leased · click to
   switch"). Alternatively, preview only after 250 ms of dwell. Also move the picker to the right of the
   docked model, or into the floor head, so reaching it never crosses the model. +0.5 X2.
3. Focus after "Full floor plan" (actions.ts:24, FloorView.tsx). In FloorView, on mount with a
   `floor` param, focus the floor heading (`tabIndex={-1}`) or the Back button. On "Back" to Building,
   return focus to the "Full floor plan" button. +0.25 X4.
4. Put the lens fact in the picker's accessible name and title (MiniStack, using
   floorFact(f, lens, safe)): "Floor 6, 100.0% leased, Expires Mar '27". Change the model's aria-label
   to "Building model: 12 floors coloured by <lens>; the floor list beside it has the same facts."
   (BuildingHero.tsx:214). +0.25 X4.
5. In prospect-safe mode, render holdover and MTM terms like any other lease that has no public date:
   show "Leased" with no meta line for every lease, or show expiry for none. The point is that the two
   at-risk suites are no longer the only ones marked "not disclosed" (segmentText.ts:101,
   BlockPanel.tsx:131, lenses.ts:213, TimelineRows.tsx:252). Extend leakcheck to fail when "not
   disclosed" appears on fewer than all leases. +0.5 X3.

BUGS (with file:line):
- src/components/building/BuildingView.tsx:155-161. Hovering a "Most space" quick start sets the hover
  floor, which swaps the prompt for a longer three-line facts paragraph and pushes the buttons 19.5 px
  down. A click at a button's centre then misses, and a click in its top quarter opens the floor above:
  "Floor 8 · 7,400 SF" opens Floor 12, and "Floor 7" opens Floor 8. Reproduced at 1100, 1280, 1440 and
  1920 px. Keyboard Enter works.
- src/components/building/BuildingView.tsx:51. With a floor pinned, any hover over the docked model
  replaces the whole pane with another floor's preview. This includes the moment the model slides under a
  stationary pointer mid-dock: at t≈130–200 ms after clicking picker "8", the pane showed "Floor 10 ·
  Preview".
- src/components/building/BuildingView.tsx:179 with src/components/plan/actions.ts:24. "Full floor plan"
  leaves focus on <body> (round-11 bug, not fixed).
- src/components/building/BuildingView.tsx:81-85. Undock starts the stage at left = −45 px, outside the
  card, and covers the picker for the first ~120 ms.
- src/components/hero/BuildingHero.tsx:214. The aria-label references "the stack", which is not on screen
  in the Building view.
- src/domain/safe.ts:58 vs src/components/plan/segmentText.ts:101. "Term not disclosed" appears only on
  holdover and MTM leases in prospect-safe mode, which identifies them.
- src/styles/vice.css:103 vs :108. The daytime Leased tone differs between the model (#9097cc) and the
  legend and plate (#dfe3f0).

Round-11 fix check (read after scoring). These fixes landed:
- The prospect-safe floor tabs show Suites only.
- The picker stays visible with the inspector open and has roving tabindex.
- 761–1099 px is a one-column Building view.
- Quiet listings are dropped in safe mode, and the search is not echoed.
- Live-region chatter is gone.
- The model fits the measured viewport.
- Record actions sit under the floor numbers.
- Inquiry fit honours sublease.
- Preview, then search, now shows the match.
- The Building legend carries the over-allocation note.
- WALT shows two decimals, with the exact figure in its tooltip.
- In-place rent is weighted by recorded SF.
Not fixed: focus is still lost after "Full floor plan".
```
