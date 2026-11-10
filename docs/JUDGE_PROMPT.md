# Judge brief: Stacking Plan v2 council

You are one of three independent judges scoring a from-scratch rebuild of the AscendixRE "Stacking Plan". Be rigorous and skeptical: the target is 95/100 and it must be earned. **This is a read-only review: do not modify, create or delete any file in the repository, and do not run any build that writes inside it.**

Repo root: `/Users/serhiiyanushkevych/Documents/Projects/Stacking Plan/stacking-plan-v2` (the path contains a space; quote it).

## Scenario

From round 9 the app is judged as a **standalone web app** with its glass skin (the default), not as a Salesforce Lightning record-page component. Score U4 against the standalone wording in BRIEF.md. `?skin=classic` shows the older flat look for the embedded scenario; it is not being scored. `?theme=dark` / `?theme=light` force a theme; the header also has a theme switch. Print and PDF intentionally stay plain white.

Prospect-safe by design: asking rents and asking prices on availabilities (including the for-sale condo unit) are marketing information and stay visible; the building's own sale listing shows only "Listed for sale" (price, $/RSF, cap rate and broker withheld).

## Read first

1. `docs/BRIEF.md`: the product, personas, top 10 jobs, domain rules, and the **scoring rubric** you must use (UI /20, UX /20, Engineering /10).
2. `docs/DESIGN.md`: what the team intended. Score what was built against the rubric, not against this document, but use it to judge coherence.
3. `docs/COMPETITORS.md` §4–§7: what competitors do and don't do, for X5.
4. Reference images of what is being replaced: `docs/reference/legacy-stacking-plan.png` (2015 widget) and `docs/reference/v1-redesign-*.png` (the 2026 prototype that plateaued at UI 17.3).
5. Screenshots of this round: `docs/shots/<ROUND>/`:
   - 00–03: Stack view in the four lenses (status, expiration, deals, rent)
   - 04–05: a selected lease (occupied but marketed for later) and a selected divisible availability, with the inspector
   - 06: data issues · 07: as-of date moved to 2028 with KPI deltas · 08: find 12,000 SF · 09: rollover bucket 1–2 yr highlighted
   - 10: prospect-safe · 11: search "vantage" · 12: 12-month renewal worklist · 13: unaccounted area traced to a lease without units
   - 14: matching an open inquiry · 15: at-risk worklist (holdover and MTM)
   - 16–17: Timeline view (today; 2028 with the expiration lens)
   - 18–20: Map view with the building extruded floor by floor on OpenStreetMap (status, expiration, Area panel with demographics)
   - 21–22: Floor plate drill-in (Floor 6 full-floor tenant; Floor 1 podium with retail, for-sale condo and lobby)
   - 23–25b: phone (390 px): stack, block sheet, timeline, map
   - 26–27: dark theme · 28: print emulation · 29: multi-floor tenant selected · 30: floor summary · 31–32: prospect-safe with a block selected, prospect-safe timeline
   - `pdf/`: real Chrome PDFs, landscape Letter (owner report, owner report with the expiration lens, prospect-safe report). This is the actual print output.
6. Code: `src/domain/` (pure TypeScript, tests alongside), `src/model/usePlanModel.ts`, `src/components/**`, `src/styles/tokens.css`, `src/data/mock/property.ts` (the mock building; its edge cases are deliberate: holdover, MTM, committed, sublease, over-allocation, lease without units, lease without floor, confidential lease, for-sale condo, stale record).
7. Live build: http://localhost:4180/. URL params: `view=stack|timeline|map|floor`, `lens=status|expiry|deals|rent`, `asOf=YYYY-MM-DD`, `select=<segKey>` (e.g. `L13-U1`, `A02`, `F2-gap`), `floor=F6`, `safe=1`, `req=12000&max=15000&by=2027-06-01&fit=direct`, `window=risk|90|180|12|24`, `bucket=0..8`, `inquiry=I02`, `q=text`, `mode=building|block|floor|find|worklist|issues|area`, `theme=dark`, `print=1`. You may drive it with Playwright (`node_modules/playwright`, `chromium.launch({ channel: 'chrome' })`); write scratch screenshots to `/tmp`, never into the repo. Run `npm test` if you like (read-only). Do not run `npm run build`.

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

ENGINEERING (informational): xx/10: <one paragraph>

TOP UI FIXES (ranked by points gained per effort, max 5):
1. <what, where, why, expected UI points gained>
TOP UX FIXES (ranked by points gained per effort, max 5):
1. <what, where, why, expected UX points gained>
BUGS (with file:line):
- ...
```
