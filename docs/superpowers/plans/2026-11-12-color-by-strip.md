# One "Color by" in the KPI strip: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The KPI strip holds one switch card per lens (Leasing, Rent, Expiration, Pipeline) and the toolbar's lens picker goes.

**Architecture:** A new per-type asking-rent figure in `domain/kpis.ts` feeds a new Rent card. `KpiStrip` builds its Color-by group from `prospectFirst(LENSES)` so prospect-safe keeps the cards that stay in place; `App.onKpi` patches the lens for all four. `Toolbar` loses its lens group, select and CSS. Scripts and docs that count or name the cards follow.

**Tech Stack:** React 19, TypeScript, Vitest (renderToString, no DOM), plain CSS, Playwright scripts against `dist-judge`.

**Spec:** `docs/superpowers/specs/2026-11-12-color-by-strip-design.md`

## Global Constraints

- American English, one name per thing: the card label is the lens label from `LENSES` ("Leasing", "Rent", "Expiration", "Pipeline"); "Expiring 12 mo" stays the Expiration card's note/detail wording where it describes the figure.
- Prospect-safe policy lives in `src/domain/safe.ts` alone; nothing withheld (in-place rent, deals, lease terms) reaches a Rent figure, tooltip or name in safe mode. Run `npm run leakcheck` after.
- `src/domain/` stays pure (no React, no browser).
- Tests beside the code, rendered with `renderToString`.
- Comments say why, naming the review ("team review, Nov 12") where a rule comes from.
- Commit subjects: `feat: …`, `docs: …`.

## Review Focus

1. A building with no rents on record (every lease confidential or rate null): the Rent card must still render as a switch, with "No rent on record" and no NaN. (Task 1 test, Task 2 test.)
2. Prospect-safe with no marketed space: the Rent card shows "No asking rents", never an in-place figure. (Task 1 and 2 tests.)
3. A URL with `lens=rent` or `lens=expiry`: the matching card is pressed and no other. (Task 2 test.)
4. Prospect-safe with `lens=deals` in the URL: App already falls back to `status`; the Leasing card is pressed and Pipeline is absent. (Task 2 test.)
5. Map view: all four switches are still (`sp-kpi--still`), not buttons. (Task 2 test.)

---

### Task 1: Asking rent by type in the domain

**Files:**
- Modify: `src/domain/kpis.ts` (interface `Kpis`, `computeKpis`)
- Modify: `src/domain/safe.ts:165-168` (`safeKpis`)
- Test: `src/domain/kpis.test.ts`, `src/domain/safe.test.ts`

**Interfaces:**
- Produces: `export interface AskingByType { type: LeaseType; low: number; high: number; sf: number }` and `Kpis.askingByType: AskingByType[]` (annual $/SF low/high across marketed vacancies of that type, `sf` the SF of those listings, sorted largest `sf` first). `safeKpis(k, true)` returns `rentByType: []` (in-place rent is withheld) and leaves `askingByType` as is.

- [ ] **Step 1: Write the failing tests** in `src/domain/kpis.test.ts` beside the rent-by-type tests:

```ts
it('asking rent by type covers the marketed vacancies (direct and sublease), lowest low to highest high, largest share first', () => {
  const listed = floors.flatMap((f) => f.segments).filter((s) => s.availability && (s.kind === 'available' || s.kind === 'sublease'));
  expect(listed.length).toBeGreaterThan(0);
  expect(k.askingByType.map((a) => a.sf)).toEqual([...k.askingByType.map((a) => a.sf)].sort((a, b) => b - a));
  for (const a of k.askingByType) {
    const own = listed.filter((s) => s.availability!.leaseType === a.type);
    expect(a.sf).toBe(own.reduce((t, s) => t + s.size, 0));
    expect(a.low).toBe(Math.min(...own.map((s) => annualRate(s.availability!.rentLow, s.availability!.rateUnit))));
    expect(a.high).toBe(Math.max(...own.map((s) => annualRate(s.availability!.rentHigh, s.availability!.rateUnit))));
  }
});
```

And in `src/domain/safe.test.ts`, with the file's existing `Kpis` fixture or `computeKpis` on the mock:

```ts
it('safeKpis withholds in-place rent by type and keeps asking rents (a prospect may see what is on offer)', () => {
  const safe = safeKpis(k, true);
  expect(safe.rentByType).toEqual([]);
  expect(safe.askingByType).toEqual(k.askingByType);
  expect(safeKpis(k, false)).toBe(k);
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/kpis.test.ts src/domain/safe.test.ts` → FAIL (`askingByType` undefined).

- [ ] **Step 3: Implement.** In `computeKpis`, after `rentByType`: one pass over `all` for segments with `availability` and kind `available` or `sublease`, a `Map<LeaseType, {low, high, sf}>`, rates through `annualRate`. In `safeKpis`, add `rentByType: []` when `!canShowInPlaceRent(safe)` and widen the early return accordingly.

- [ ] **Step 4: Run** the two files → PASS. Run `npx tsc -b` → clean (the test model in `components/inspector/testModel.ts` may need the new field if it builds `Kpis` by hand; add `askingByType: []`).

- [ ] **Step 5: Commit** `feat: asking rent by type in the KPIs, withheld in-place rent in prospect-safe`.

---

### Task 2: The strip's four switches and three details

**Files:**
- Modify: `src/components/kpis/KpiStrip.tsx`
- Modify: `src/components/kpis/kpis.css` (grid weights)
- Test: `src/components/kpis/KpiStrip.test.tsx`

**Interfaces:**
- Consumes: `Kpis.rentByType`, `Kpis.askingByType` (Task 1); `LENSES`, `LensId` from `domain/lenses`; `prospectFirst` from `components/shell/toolbarRules`; `canUseLens`, `canShowInPlaceRent` from `domain/safe`; `dollars`-style formatting: export `export const rate = (v: number) => …` from `domain/format.ts` only if nothing there already prints `$42.10`; otherwise reuse `rateRangeShort`/`rateRange`.
- Produces: `export type KpiAction = LensId` (`'status' | 'expiry' | 'deals' | 'rent'`). Card ids (`data-kpi`): switches `status`, `rent`, `expiry`, `deals` in that order; details `find`, `find-largest`, `timeline`.

- [ ] **Step 1: Update the tests.** In `KpiStrip.test.tsx`:
  - groups test: `ids(lens)` → `['status','rent','expiry','deals']`, `ids(open)` → `['find','find-largest','timeline']`; dots 4, lens buttons 4, detail divs 3, labels 7, labels list `['Leasing','Rent','Expiration','Pipeline','Available','Largest block','Avg term']`.
  - notes test: keys `status, rent, expiry, deals, find, find-largest, timeline`; `expiry` note stays `'16.7% of leased · 4 leases'`; `rent` note `'FSG · in place'`; `rent` detail starts `'FSG $<avg>/SF/yr on <sf> SF'` followed by ` · <type> $…` for each other type (compute from `kpis.rentByType` in the test, with `avg.toFixed(2)`); `spoken(kpiOf(html,'status'))` starts `'Leasing 86.1%'`.
  - add: `it('the Rent card shows the largest lease type's in-place average, every other type in its detail')` asserting the figure `$${kpis.rentByType[0].avg.toFixed(2)}` with unit `/SF/yr`.
  - add: `it('prospect-safe: the Rent card stays as a switch and shows the asking range of marketed space, no in-place figure')`: ids `['status','rent','find','find-largest']`; rent figure `$${low}–$${high}` (integers printed without cents) unit `/SF/yr`, note `'asking · vacancies'`; `html` does not contain any `rentByType[i].avg.toFixed(2)`; still a `<button … aria-pressed`.
  - pressed test: add `?lens=rent` → `['rent']`, `?lens=expiry` → `['expiry']`; `?safe=1&lens=deals` → `['status']` (parseState/App fallback: if `parseState` alone keeps `deals`, assert the strip falls back itself: `canUseLens` guard in the card's `active`).
  - time-travel chips: count 6 (no chip on Rent), ids without `rent`.
  - prospect-safe test: ids `['status','rent','find','find-largest']`; the `gone` list keeps `'Pipeline','Expiring 12 mo','Avg term','SF-weighted','of leased'` and adds `'in place'`.
  - names test: full id list of 7; safe count 4.
  - Map test: assert all four switches are `sp-kpi--still` divs.
  - add Review Focus 1: a model whose `rentByType` is `[]` (spread the real kpis with `rentByType: []`) renders the Rent card with value `'No rent on record'`, no `NaN`.

- [ ] **Step 2: Run** `npx vitest run src/components/kpis/KpiStrip.test.tsx` → FAIL.

- [ ] **Step 3: Implement `KpiStrip`.**
  - `KpiAction = LensId`; `KpiId = KpiAction | 'find' | 'find-largest' | 'timeline'`.
  - Build `switches: Record<LensId, Kpi>`: `status` (today's `leased`, label `'Leasing'`), `expiry` (today's expiry card, id `expiry`, label `'Expiration'`, title ending `'Click to color the plan by lease expiration.'`, `static` when `!canShowRollover(safe)`), `deals` (as today, label from LENSES), `rent` (below). Order with `prospectFirst(LENSES).map((l) => switches[l.id])`, then `.filter(shown)`.
  - Rent card, owner (`canShowInPlaceRent(safe)`): `top = k.rentByType[0]`; value `top ? \`$${top.avg.toFixed(2)}\` : 'No rent on record'`, unit `top ? '/SF/yr' : undefined`, note `top ? \`${top.type} · in place\` : 'No rents on record'`, detail `rentByType.map((r) => \`${r.type} $${r.avg.toFixed(2)}/SF/yr on ${num(r.sf)} SF\`).join(' · ')`, title `'Average in-place rent of the largest lease type, each lease weighted by its recorded SF; never blended across types. Click to color the plan by rent.'`, `delta: null`, `active: state.view !== 'map' && state.lens === 'rent'`.
  - Rent card, prospect-safe: `top = k.askingByType[0]`; value `top ? \`${money(top.low)}–${money(top.high)}\` : 'No asking rents'` where `money` prints integers without cents (reuse `dollars` by exporting it from `format.ts`), unit `'/SF/yr'` when `top`, note `'asking · vacancies'`, detail from every `askingByType` row `\`${type} ${low}–${high}/SF/yr on ${num(sf)} SF\``, title `'Asking rent on the space on offer. Click to color the plan by rent.'`.
  - `active` for every switch: `state.view !== 'map' && canUseLens(state.lens, safe) && state.lens === id` (keeps a safe `lens=deals` link from pressing nothing: Leasing is pressed, as App draws).
  - Button `onClick={() => onAction(c.id as KpiAction)}` for switches (the id is a lens id).
  - Details: `opens` keeps `find`, `find-largest`, `timeline`.
- [ ] **Step 4: CSS** in `kpis.css`: `.sp-kpis` → `minmax(0, 3.6fr) minmax(0, 3.4fr)` (four cards against three; re-measure at 1440 after Task 6 and adjust); `.sp-kpis__group--lens` → four `minmax(0, 1fr)` columns weighted `0.95 1 1.05 1`; `.sp-kpis__group--open` → three (`1.09 1.16 0.82`); the 1600 px rule likewise; `.sp-kpis--safe` → `minmax(0, 2fr) minmax(0, 2fr)`, lens `repeat(2, …)`, open `repeat(2, …)`; phone: lens `repeat(2, …)`, open `repeat(3, …)`, and change the `nth-child` hairline rules so the open group's three-across row has hairlines between all three and no border-top (`.sp-kpis__group--open .sp-kpi:nth-child(n + 3) { border-top: 0 }`, `.sp-kpis__group--open .sp-kpi + .sp-kpi::before { display: block }`). Update the comments ("six" → "seven", "3 × 2" → "2 × 2 and 3").

- [ ] **Step 5: Run** the strip tests → PASS; `npx tsc -b` → errors only in `App.tsx` (`onKpi` switch) and `Toolbar` untouched. Fix App in Task 3.

- [ ] **Step 6: Commit** `feat: the KPI strip is the one Color by: a switch card per lens`.

---

### Task 3: App wires the four switches

**Files:**
- Modify: `src/App.tsx:229-239` (`onKpi`)
- Test: none new (the strip tests cover pressed state; `npm run verify` clicks cards)

- [ ] **Step 1:** Replace the `switch` with `const onKpi = (lens: KpiAction) => patch({ lens, bucket: null });` keeping the comment about an open panel staying (round 18).
- [ ] **Step 2:** `npx tsc -b` → clean. `npx vitest run src/App.test.tsx` if it exists → PASS.
- [ ] **Step 3: Commit** `feat: every Color-by card sets its lens`.

---

### Task 4: The toolbar loses its lens picker

**Files:**
- Modify: `src/components/shell/Toolbar.tsx` (remove `TOOLBAR_LENSES`, the `lens`/`lenses` consts, the two lens blocks, the `Segmented` lens use, the `SelectField`, `LENSES`/`LensId`/`canUseLens` imports if unused)
- Modify: `src/components/shell/shell.css` (remove `.sp-toolbar__lens`, `.sp-toolbar__lens-select` rules at ~200, 207-211, 251-252)
- Modify: `src/components/shell/toolbarRules.ts` (keep `prospectFirst`; its doc comment now names the KPI strip)
- Test: `src/components/shell/Toolbar.test.tsx`

- [ ] **Step 1: Update the tests.** Remove `lensTabs` and the per-view "lens tabs" test; keep `prospectFirst` tests. Add: `it('offers no lens picker: the KPI strip is the one Color by (team review, Nov 12)')` asserting `render('?view=stack')` contains neither `aria-label="Color lens"` nor `sp-toolbar__lens`. The prospect-safe "says nothing" test keeps its `Expiration|Deals` assertion.
- [ ] **Step 2: Run** `npx vitest run src/components/shell/Toolbar.test.tsx` → the new test FAILS.
- [ ] **Step 3: Implement** the removals. Confirm `Segmented` is still used for the view tabs.
- [ ] **Step 4: Run** the toolbar tests, then `npx vitest run` → all PASS; `npx tsc -b` clean; `npm run lint` clean.
- [ ] **Step 5: Commit** `feat: the toolbar's Color by goes; the KPI strip has it`.

---

### Task 5: Scripts, print test and docs follow the cards

**Files:**
- Modify: `scripts/verify.mjs:17` (`=== 6` → `=== 7`, message `'7 KPI cards'`), `:18,46-47` (first card is now Leasing: rename the variables/messages to "Leasing KPI")
- Modify: `scripts/leakcheck.mjs:408,418` (unchanged labels; verify) and any `.sp-kpi` selector that assumes six
- Modify: `src/components/print/PrintLayout.tsx` / `.test.tsx`: no change (the cover keeps "Leased"; it prints a figure, not a switch). Leave as is.
- Modify: `docs/DESIGN.md` §2.2 (seven figures in two groups: "Color by" Leasing · Rent · Expiration · Pipeline, each a switch; "Details" Available · Largest block · Avg term, read-only; the table gains a Rent row `Rent | $<avg>/SF/yr | FSG · in place | Rent lens` and the Leased row becomes Leasing; phone "2 × 2 switches and three details"), §2.3 (drop "Color by" from the toolbar's contents), the breakpoints line 141 ("lens becomes a select" → gone).
- Modify: `docs/PLAN.md` FR-7 ("Seven figures … four are the Color-by switches, one per lens; three are details").
- Modify: `README.md` if it lists the toolbar's lens control (grep "Color by").

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** `grep -rn "six figures\|six KPI\|3 × 2\|Color lens" docs README.md scripts src --include=*.md --include=*.mjs --include=*.tsx --include=*.ts` → only the print cover's "six" (it still prints six) and past judging reports remain.
- [ ] **Step 3: Commit** `docs: the KPI strip's seven cards and the toolbar without Color by`.

---

### Task 6: Browser verification and the column weights

**Files:**
- Modify: `src/components/kpis/kpis.css` (weights, from measurement)

- [ ] **Step 1:** `npx vite build --outDir dist-judge && npm run preview` (background), then `npm run verify`, `npm run a11y`, `npm run leakcheck` → each ends without a failing check.
- [ ] **Step 2:** Screenshots to the scratchpad: `node scripts/one.mjs "?view=stack" <scratch>/stack-1440.png 1440 1100`, the same at 1280 and 1024 wide, `"?view=stack&safe=1"` at 1440, `"?view=stack"` at 390 × 844, `"?view=map"` at 1440. Look at each: no note cut, no label wrapped, the strip one row on desktop, the Rent figure legible, the toolbar on one row at 1440.
- [ ] **Step 3:** Adjust the grid weights until Step 2 holds; re-run the strip tests.
- [ ] **Step 4: Commit** `feat: KPI strip columns sized for seven cards`.
- [ ] **Step 5:** Push the branch and open a PR to `main` with the spec's intent in the body; name the Sergiy heads-up in the message to the user.
