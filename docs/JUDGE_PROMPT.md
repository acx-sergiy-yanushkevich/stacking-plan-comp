# Judge brief: Stax council

You are one of the independent judges (two to four a round) scoring the Stax prototype for AscendixRE. Be rigorous and skeptical: the target is 95/100 and it must be earned. **This is a read-only review: do not modify, create or delete any file in the repository, and do not run any build that writes inside it.**

Repo root: the root of this repository (if the path contains a space, quote it).

## Scenario

From round 9 the app is judged as a **standalone web app** with its glass skin in the Ascendix company palette (the default), not as a Salesforce Lightning record-page component. Score U4 against the standalone wording in BRIEF.md. `?skin=classic` shows the older flat look for the embedded scenario; it is not being scored. `?theme=dark` / `?theme=light` force a theme; the header also has a theme switch. Print and PDF intentionally stay plain white.

Prospect-safe by design: asking rents and asking prices on availabilities (including the for-sale condo unit) are marketing information and stay visible; the building's own sale listing shows only "Listed for sale" (price, $/RSF, cap rate and broker withheld).

Also read `docs/CHALLENGE_RULES.md` and the two Best UX judge personas, `docs/personas/wes.md` and `docs/personas/todd.md`. Score with the rubric in BRIEF.md, but test the product the way they would: Wes demos it live to a broker and hands a screen to a prospective tenant; Todd checks that the facts add up and that finding space is fast and deterministic.

New in round 24 (judge these as part of the product; everything from earlier rounds, listed after, is still in scope):
- **The Map is the building's surroundings; its floors are the Building tab's.** It opens top-down, framed on the one-mile ring, with the half-mile walk (where the amenities are counted) shaded. The building is drawn in the brand color with its name; a click opens its floors in the Building tab. Transit stops (bus and train badges) and amenities (a dot per place, colored by category) are pinned; a pin shows its name and distance on hover. Live sources pin only the positions they record; the demo buildings' places are placed at positions seeded from the building's id, inside the distance they were counted in, and the map card says "Sample places". The Map has no lens legend, floor list or "Color by" by design: nothing on it is colored by a lens, and a KPI Color-by switch pressed there opens the Building tab in that color. "Show in 3D" leans in on the building in one color among its neighbours; Present orbits it (the floor time-lapse is gone with the floors); Record films that. The card links to the building's floors, Google Maps and Street View (Google's Maps URLs: no key, no embed).
- **The Area panel is the Map's panel.** `?view=map` opens it, arriving at the map opens it, and leaving puts it away. Beside the map it leads with the stops and the amenities; each row is a tab stop that lights its pins on hover or focus, and a pin clicked on the map lights its row. The pins are not tab stops (there may be dozens): the rows are the keyboard way to the same places. On a phone or tablet the panel stands under the map, in the page.
- **Fixes from round 23.** The search box reads a needed-by date anywhere ("12k by Jun 2027 direct", "20k contiguous SF, Q2, direct"), a "k" on its own number, a reversed range, and state words inside a longer query ("available space"; "available" lights direct and sublease, the KPI's 33,200 SF); its placeholder mentions sizes. One name for space with no lease or listing: "No lease or listing" for the owner, "Not on the market" for a prospect, dashed, everywhere. The owner PDF's Pipeline card says "57,800 SF in play" and states what the deals request (75,800 SF). Cedar Springs says "Under contract" (owner: with the listing figures; prospect: alone), on screen and in the PDF. Find space stacks up to four adjacent floors (Legacy West, 60,000 SF: Floors 18–20, 78,000 SF). The Expiration ramp runs red first in both themes. A signed lease reached through its Lease Out deal reads "Signed · Lumen Analytics" and "Lease signed". The phone filter bar wraps; no inquiry-fit badges for a refused range; a building switch forgets the old building's search; "Latest change" never sits alone on the card; the Expiration legend fits one row at 1440 px; the legend's ⓘ note closes on Tab. A prospect-safe leak found while checking (an unpublished Cedar Springs listing's record id in its block and the address) is fixed, and the leak and accessibility checks cover all four buildings.

Round 23 (still in scope, except where round 24 changed it; the Map's legend, floor list and "Color by" are gone on purpose):
- **Four buildings open.** The switcher opens Preston Park Financial Center (the default), Legacy West Tower II (22 floors, `?building=P002`), Cedar Springs Exchange (8 floors, under contract, `?building=P005`) and Bluebonnet Office Park (4 floors, L-shaped, `?building=P007`); the other entries are samples and say so. Each has its own leases, availabilities, deals, inquiries, history and area figures. Switching drops the selection, search and panel of the building left; the Building view thins its floors when a tall tower would not fit.
- **The search box finds space.** A size ("12000 sf", "12k direct by Jun 2027", "12-15k") is read as a requirement: the bar above the plan offers "Find 12,000 SF of space", and Enter runs it in Find space with the size, type and date filled in. State words light that space: "sublease", "signed", "available", "for sale", and for the owner "holdover", "month-to-month" or "MTM" (a prospect is never searched for tenant risk). The no-match message suggests a suite, a floor or a size.
- **The legend's overlays work in every view.** On the Map the ⓘ note and the entry tooltips open above the map and the floor list; tooltips wrap inside their box and, for entries in the right half, hang from the right edge; the note keeps focus until Escape or a click outside closes it. The phone Timeline's opened legend has its ⓘ, and on touch the ⓘ has a 44 px hit area.
- **Prospect-safe Rent reads like the KPI.** Its legend is Occupied 196,700 · Signed, not yet in 8,000 · Not on the market 5,400 (plus the asking-rent bands), not a "Leased" figure that disagreed with the 86.1%.
- **One name for floor area with no lease or listing**: "No lease or listing" in every legend, the inspector and the matching issue ("No record" on a block too narrow for it); a prospect is told "Not on the market".
- **Pipeline in plain words.** Floor 4's signed lease reads "Lease drafted · Lumen Analytics", the Building and Map floor label ends "lease drafted" with a matching swatch, and the legend's Lease drafted swatch is hatched as the suite is drawn. The KPI note is "57,800 SF in play"; its detail adds that the deals request 75,800 SF in all.
- **Smaller fixes.** "Signed, not yet in" everywhere (badge, KPI detail, PDF total and footnote, inspector, timeline); the phone "Issues" button is named by its words; dimmed phone rows keep full-contrast badges; Find space refuses a maximum below the minimum (Max SF marked invalid, nothing searched); the legend is a named group; the expiration legend's last entry is "For sale"; the building card's listing and Latest change wrap together; the PDF subtitle names the sale listing as the header does. `npm run a11y` now also checks six phone states.

Round 22 (still in scope, except where round 23 changed it):
- **The legend without a mouse.** Every legend entry is a tab stop: hover or focus shows its SF and share in a tooltip, and a screen reader reads them with its name. The ⓘ is a real button that opens the note in a popover (click, tap, Enter or Space; Escape or a click outside closes it); in the Stack, Building and Timeline views it sits on the card's title line ("as of Nov 9, 2026 · 245,400 RSF leasable ⓘ"). Map and Timeline legends start with their lens name; the phone's folded legends say which lens ("Expiration legend · 11 states") and, opened, list each entry's SF and share.
- **Plain labels to the end.** "Signed, not yet in" replaces "Committed" in the rent roll (CSV and PDF) and the Building panel; the missing-expiry issue counts the lease in "Avg term", not WALT.
- **Prospect-safe rent says nothing rather than "Withheld".** A dash in the rent roll's rent column, no rent line on a leased block in the Rent lens, and "Leased" for that legend entry.
- **Expiration lens: Available apart from unrecorded space.** Direct availabilities have their own "Available" entry (26,200 SF), so "Vacant, not listed" is the 5,400 SF with no record (a prospect sees "Not on the market").
- **Area panel and building card.** The Area panel's expand icon is now a labelled button beside Close: "Location brief" opens the full-page brief, "Show plan" brings the plan back. The building card is one line on desktop and tablet (the mark, the name, then the facts, wrapping where they don't fit), since the name is already in the switcher above it; the name is one solid color.
- **The prospect-safe leak check (`npm run leakcheck`) follows the renamed UI again** and reports 0 leaks.

Round 21 (still in scope, except where round 22 changed it):
- **A clarity pass over the whole app (no features added or removed).** Lenses are Leasing · Rent · Expiration · Pipeline, and each legend is titled with its lens. On screen the legend shows the state names; SF and share show on hover and focus, and the notes (which end of a ramp is which, what the shares add up to, Floor 7's 500 SF) sit behind the legend's ⓘ in every view. The PDF keeps the full figures. The KPI groups are "Color by" and "Details", and WALT reads "Avg term". Plain words throughout: "Signed, not yet in", "Holdover / month-to-month", "Vacant, not listed", "Lease drafted" (the CRM's Lease Out stage), "Gross < $28", "Net or modified gross". The building card ends its facts with a green "Latest change"; unverified records are listed in Data issues, which the toolbar opens. Prospect-safe leaves out the figures it withholds instead of showing "Withheld" cards, on screen and in the PDF; on a phone one line says what is not shown, so the bar keeps its height. The Area panel's sample figures are marked "Sample figures", and the PDF footnote says the prototype uses sample data. Floor actions are short ("New deal", "Log call · Kinetic Ventures"), with the full action in the tooltip and the accessible name.
- **Fixes from round 20.** The toolbar's search and tools wrap to a row of their own below the room they need, so nothing covers the lens tabs (1180–1365 px is two rows). Floor plate keys move between selectable suites only, never the lobby. A slice's accessible name starts with what it draws, in drawn order. Building, Timeline and Map legends carry the same shares note as the Stack.

Round 20 (still in scope, except where round 21 changed it):
- **Data issues is back in reach.** A toolbar button after Worklist, in every view and on phones ("Issues"), carries the issue count and opens the panel (in the bottom sheet below 1100 px). Prospect-safe withholds it and keeps its place, as it does Worklist. The header's freshness chip turns amber and says how many records have gone unverified for 120+ days ("1 unverified since Jun 2"); a prospect is told neither.
- **Legend shares are rounded once each**, as the KPI bar rounds them, so one SF figure reads the same in every lens and mode (round 19 apportioned them, which changed single shares). Where the shares shown do not add up to 100.0%, the legend says why: the suites on record cover 245,900 SF of 245,400 leasable (the owner is told it is Floor 7), and each share is rounded on its own. The PDF cover carries the same note.
- **The phone product bar is one row at 420 px and under**: the Stax mark, the building switcher, the date, Prospect-safe (its icon alone under 380 px) and a "…" menu holding Export, Colors and the theme.
- **Fixes from round 19.** The renewal worklist counts every suite a lease holds on a floor (Infinity 700 and 720) and leases once each, agreeing with the Expiring KPI. Escape from an empty toolbar field closes an open tool. A floor slice's accessible name holds the short fact it draws. Prospect-safe shows no verified date on availabilities and no owner-broker on the PDF cover. "Latest change" sits on the building card's title line, and the facts are one line from 1180 px. The docked floor picker keeps its numbers with the inspector open. Ramp notes say the legend's order ("from the soonest expiry to the latest"), true in both themes. Sample buildings in the switcher are announced as samples and take no hover or tab stop. Demo education figures are plausible for "bachelor's as highest degree" (37% within 1 mile).

Round 19 (still in scope):
- **Header buttons, as agreed by the team.** The product bar's controls are one right-hand group: As of, Prospect-safe, Export, the Colors menu and the theme switch. As of, Export and the building switcher are text buttons with a small caret. Prospect-safe is a button with a half-filled circle; it takes the brand fill when it is on (it is still a switch to assistive technology). The bar is one row from 1024 px.
- **A portfolio in the switcher.** The building switcher lists ten buildings. Each has its own mini stacking-plan icon, and the open building is the highlighted row. The other nine are sample entries and say so; only the open building opens.
- **Fixes from round 18.** The education measure is named for what it is: "Bachelor's as highest degree", 61.0% against the US 21.6%. Live rings use the benchmark's ACS 2020–2024 vintage. Bus stops draw a bus and say "Bus" or "Rail". Leased and Pipeline are plain Color-by switches. Area, Find space and Worklist open beside the Floor view and beside a docked floor. Changing the view, lens or search while the brief is open narrows it to the panel. Escape works on any open tool panel wherever focus is. Map labels no longer overprint at 1180–1320 px. The expanded phone sheet stops under the product bar. Computed style and observers go through the host adapter.

Round 18 (still in scope; everything from earlier rounds is too, including the Ascendix company palette as the default, Vice City at `?palette=vice`, the quiet KPI bar above every view, the single floor label shared by the Building view and the Map, the "Largest block" tag and hover, and the round-17 changes: floor labels that say what each figure is, the Map column, the bottom sheet, prospect-safe positions, the phone header and the host adapter):
- **The area around the building is easy to find.** An internal team review found the area data (demographics, transit, amenities) worth having but hidden behind a Map-only button. The Area button is now in the toolbar in every view, after Find space. The Building panel (the default side panel in Stack, Timeline and Map) opens with "Around the building": the 1-mile population, median household income and nearest transit stop, with "See area details" opening the Area panel.
- **Area panel as charts.** Population and households by distance; one ring, chosen with a 1 / 3 / 5 mi switch, compared with the US in median household income, bachelor's share, median age and mean commute (a bar for the ring, a tick for the US, both figures and the difference in words); amenities within half a mile as ranked bars; transit stops.
- **Location brief.** A small toggle beside the panel's Close button (the expand icon, named "Location brief") widens the Area panel to the full page; the plan is put away, not unmounted, and comes back as it was. It is what a broker shows a client or decision maker: four headline figures, "What stands out" (a sentence for each measure at least 10% above or below the US, said as a plain fact, then the top amenities and the transit), ranked amenity bars, every ring beside the US, and the stops. Escape narrows it, a second Escape closes the panel; on a phone or tablet the sheet opens to full height; `?mode=brief` links to it. It holds no tenant data, so prospect-safe mode shows it whole. The US figures are fixed national ACS 5-year 2020–2024 figures in the same measures as the rings (`src/domain/areaBrief.ts`); the demo area figures are sample data and say so.
- **PDF.** The location brief is the last section of the owner report and of the prospect-safe report (4 and 3 sections).
- **KPI bar in two groups.** "Color by" switches (Leased, Pipeline) with a dot and underline; "Details" figures (Available, Largest block, Expiring 12 mo, WALT) with an arrow and no pressed state.
- **Also since round 17**: an ended lease's timeline bar shows the lease itself (vacated tone, its own dates) and selects nothing; the phone header is one row at 420 px and under; the sheet handle can be dragged; floor plates stay legible with the inspector open and Floor 7 shows its 7,000 SF sublease; rent legend shares add to 100%; the prospect-safe search is named for what it finds; everything users read is in American English ("Color by", "Colors and theme"); the product is named Stax.

## Read first

1. `docs/BRIEF.md`: the product, personas, top 10 jobs, domain rules, and the **scoring rubric** you must use (UI /20, UX /20, Engineering /10).
2. `docs/DESIGN.md`: what the team intended. Score what was built against the rubric, not against this document, but use it to judge coherence.
3. `docs/COMPETITORS.md` §4–§7: what competitors do and don't do, for X5.
4. Screenshots of this round: `docs/shots/<ROUND>/`:
   - 00–03: Stack view in the four lenses (status, expiration, deals, rent)
   - 04–05: a selected lease (occupied but marketed for later) and a selected divisible availability, with the inspector
   - 06: data issues · 07: as-of date moved to 2028 with KPI deltas · 08: find 12,000 SF · 09: rollover bucket 1–2 yr highlighted
   - 10: prospect-safe · 11: search "vantage" · 12: 12-month renewal worklist · 13: unaccounted area traced to a lease without units
   - 14: matching an open inquiry · 15: at-risk worklist (holdover and MTM)
   - 16–17: Timeline view (today; 2028 with the expiration lens)
   - 18, 20: the Map (the building's surroundings, the Area panel beside it) · 63: Bluebonnet's Map · 59: a place row of the Area panel lighting its pins · 64: the building in 3D
   - 21–22: Floor plate drill-in (Floor 6 full-floor tenant; Floor 1 podium with retail, for-sale condo and lobby)
   - 23–25b: phone (390 px): stack, block sheet, timeline, map
   - 26: night palette, expiration lens · 27: dark map · 28: print emulation · 29: multi-floor tenant selected · 30: floor summary · 31–32: prospect-safe with a block selected, prospect-safe timeline
   - 33: Building view, no floor open · 34: Floor 8 open · 35: find 12,000 SF · 38: a suite selected (inspector open) · 39: expiration lens, no floor open
   - 36–37: daytime theme (Building, Stack) · 40: daytime, Floor 3 open · 41: daytime map · 42–43: tablet (1024 px) Building view, alone and with Floor 8 open · 44–45: the Vice City palette (Building, Stack)
   - 46: the Area panel (charts) beside the Stack view · 47: the Area panel widened to the location brief · 48: phone (390 px), the location brief in the full-height sheet
   - 52: Data issues opened from the toolbar · 53: daytime, the expiration lens
   - 49: the Area panel beside the Floor view (Floor 6) · 50: light, prospect-safe on (the header's pressed Prospect-safe button) · 51: tablet (1024 px), Floor 6 with the Area panel
   - 54: the expiration legend's first entry focused from the keyboard (its figures in a tooltip) · 55: the legend's ⓘ note opened · 56: phone (390 px), the expiration legend unfolded with figures
   - 57: "12k direct by jun 2027" typed in search (the bar offers Find space) · 58: prospect-safe, Rent lens · 60: Find space with a maximum below the minimum
   - 61: Legacy West Tower II, Building view (22 floors) · 62: Cedar Springs Exchange, Stack · 63: Bluebonnet Office Park, Map
   - `pdf/`: real Chrome PDFs, landscape Letter (owner report, owner report with the expiration lens, prospect-safe report), each ending with the location brief. This is the actual print output.
5. Code: `src/domain/` (pure TypeScript, tests alongside), `src/model/usePlanModel.ts`, `src/components/**`, `src/styles/tokens.css`, `src/data/mock/property.ts` (the mock building; its edge cases are deliberate: holdover, MTM, committed, sublease, over-allocation, lease without units, lease without floor, confidential lease, for-sale condo, stale record).
6. Live build: http://localhost:4180/. URL params: `view=building|stack|timeline|map|floor`, `lens=status|expiry|deals|rent`, `asOf=YYYY-MM-DD`, `select=<segKey>` (e.g. `L13-U1`, `A02`, `F2-gap`), `floor=F6`, `safe=1`, `req=12000&max=15000&by=2027-06-01&fit=direct`, `window=risk|90|180|12|24`, `bucket=0..8`, `inquiry=I02`, `q=text`, `mode=building|block|floor|find|worklist|issues|area|brief`, `theme=dark`, `print=1`. You may drive it with Playwright (`node_modules/playwright`, `chromium.launch({ channel: 'chrome' })`); write scratch screenshots to `/tmp`, never into the repo. Run `npm test` if you like (read-only). Do not run `npm run build`.

## Return exactly this structure

Score UI and UX **separately**, each against its own rubric in BRIEF.md. Whole or half points only. Every fix must be specific enough to implement without asking you anything. Do not penalise mock data or the toast stubs where a Salesforce record action would go; that is intended for a prototype. Do penalise anything invented that xRE does not know, anything rounded, any colour-only encoding, any truncated name, any leak in prospect-safe mode, and any job a persona cannot finish.

```
JUDGE: <your model name>
ROUND: <ROUND>

UI SCORE
U1 Visual hierarchy & layout: x/5: <evidence>
U2 Color & data encoding: x/5: <evidence>
U3 Typography & density: x/4: <evidence>
U4 Polish & platform fit: x/3: <evidence>
U5 Mobile & print visual quality: x/3: <evidence>
UI TOTAL: xx/20

UX SCORE
X1 Persona job coverage: x/5: <evidence>
X2 Interaction & IA: x/4: <evidence>
X3 Trust & domain correctness: x/4: <evidence; cite file:line for any bug>
X4 Accessibility of interaction: x/3: <evidence>
X5 CRM workflows & differentiation: x/4: <evidence>
UX TOTAL: xx/20

ENGINEERING: xx/10: <one paragraph>

TOP UI FIXES (ranked by points gained per effort, max 5):
1. <what, where, why, expected UI points gained>
TOP UX FIXES (ranked by points gained per effort, max 5):
1. <what, where, why, expected UX points gained>
BUGS (with file:line):
- ...
```
