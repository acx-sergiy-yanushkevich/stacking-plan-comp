# One "Color by": the KPI strip takes the toolbar's lens picker

Date: 2026-11-12. Status: approved (team member, Nov 12).

## Intent

The page offers the same choice twice. The KPI strip's "Color by" group holds two switch cards (Leased, Pipeline) that set the lens; the toolbar's "Color by" segmented control (a dropdown on a phone) offers all four lenses. Two controls for one state look like a leftover, and the strip's two switches read as a subset of the toolbar's four. After this change there is one "Color by": the strip, with a card for every lens, and the toolbar keeps the views, search and tool buttons.

## Goals

- The KPI strip's "Color by" group has one switch card per lens, in the toolbar's order (the lenses a prospect is also offered first): Leasing, Rent, Expiration, Pipeline.
- Each card keeps a figure worth reading. "Expiring 12 mo" moves out of Details and becomes the Expiration card. Rent gets a new figure (below).
- The toolbar's lens control and its phone dropdown go, with their CSS.
- Details shrinks to Available, Largest block, Avg term.
- Everything else about a card stays: the dot, the underline and `aria-pressed` on the lens in use; still (not buttons) on the Map; a prospect never sees a withheld figure, not even as "Withheld".

## Non-goals

- No change to what any lens draws, to the legend, or to the URL (`lens=` keeps its four values).
- No change to the toolbar's other controls or to the Details cards' hover-to-light behaviour.
- No second row of KPIs on a desktop: the strip stays one row, now of seven.

## Anti-goals

- Nothing withheld in prospect-safe mode may appear in a Rent figure, a tooltip or an accessible name (in-place rents are withheld there; `npm run leakcheck` guards it).
- No "Withheld" placeholder cards.

## Constraints

- Sergiy split the strip into switches and details on Nov 12 (his task from the Nov 11 sync); this reworks the same component, so he is told before the PR opens. Code freeze is Fri Nov 13.
- Labels are matched by name in `scripts/leakcheck.mjs` and `scripts/verify.mjs` (which counts six cards): both follow the change.
- `docs/DESIGN.md` and `docs/PLAN.md` describe the strip and the toolbar: their rows follow.

## Approaches considered

1. **The strip becomes the one picker; the toolbar's control goes** (chosen). Every lens is a card with a figure, so the choice carries information, and the toolbar gets shorter. Costs a new Rent figure and a re-weighting of the strip's columns.
2. The toolbar keeps the picker; the strip's switches become plain details. Loses the figure-as-switch idea the Nov 12 review liked, and leaves the strip and toolbar still naming the same lenses.
3. Keep both and make the strip's two switches mirror the toolbar (highlight only). Still two controls; the repetition the request is about stays.

## The design

- **Cards.** Color by: Leasing (the "Leased" card renamed, so the card and the lens share one name), Rent, Expiration (the "Expiring 12 mo" figure, id `expiry`), Pipeline. Details: Available, Largest block, Avg term. Seven cards; the strip's two grid groups re-weighted 4 + 3 and the 1600 px breakpoint re-measured.
- **The Rent card (my call).** Owner: the SF-weighted average in-place rent of the largest lease type, `$42.10/SF/yr`, with the type as the note (`FSG · in place`) and every other type in the detail/tooltip. Prospect-safe: in-place rents are withheld but the Rent lens is still offered (it colors asking rents on vacancies), so the card stays as a switch and shows the asking-rent range of marketed space instead (`$34–$38/SF/yr`, note `asking · vacancies`), or "No asking rents" when there are none. No time-travel chip on the Rent card for now: a dollar delta against today would need both figures reconciled and is not worth the row's height.
- **Prospect-safe.** Color by: Leasing, Rent. Details: Available, Largest block. The phone's "not shown to prospects" line stays under Details.
- **Map.** All four switches still (`sp-kpi--still`), as the two are today; the tooltip text that says so is unchanged.
- **Phone.** Color by 2 × 2; Details three across (one row), the figures at the phone size already in use.
- **Toolbar.** The `sp-toolbar__lens` group, the `sp-toolbar__lens-select` dropdown, `TOOLBAR_LENSES` and the lens CSS go. `prospectFirst` stays in `toolbarRules.ts` and orders the strip's cards.
- **App.** `onKpi` takes four actions (`status`, `rent`, `expiry`, `deals`), each patching `{ lens, bucket: null }` as the two do now.

## Left to the builder

Exact column weights; whether the asking-rent range is computed in `domain/kpis.ts` (preferred, beside `rentByType`) or in the strip; test fixtures for the Rent figures against Preston Park's mock data.
