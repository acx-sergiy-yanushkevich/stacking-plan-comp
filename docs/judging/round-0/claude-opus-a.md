# Round 0 · Judge: Claude Opus 5.5 (A)

UI 14.5/20 (U1 4, U2 3.5, U3 3, U4 2.5, U5 1.5) · UX 15/20 (X1 4, X2 3, X3 2.5, X4 2, X5 3.5) · Engineering 8/10

## Top UI fixes
1. Print layout: plan on page 1 (shorter rows), formatted rent roll cells, nowrap worklist columns. (+1 U5)
2. Keep hatch/dot patterns from under block text (backing rect). (+0.5 U2, +0.5 U3)
3. Dark expiration ramp ordered by lightness; dark legend contrast; opaque map floor fills; camera closer. (+0.5 U2)
4. Never drop a name: two-line names at tier 2; timeline labels beside narrow bars; cursor beneath labels. (+0.5 U3)
5. Phone: 2-column KPI grid, SF in every block ≥ 56 px, collapsible map legend, wrap worklist chips, formatted filter dates. (+0.5 U5, +0.5 U4)

## Top UX fixes
1. Close prospect-safe leaks: holdover/MTM badges, deal broker and size, industry/broker/last touch, renewal stage and live deals in print. (+1 X3)
2. Legend must use recorded SF, never pro-rated; footnote over-allocation. (+0.5 X3)
3. Live region announcing KPI changes after as-of moves; dark legend contrast; skip link. (+0.5 X4)
4. Multi-floor tenants: ring sibling units, total RSF; keep ended leases on the timeline; "Vacated" wording; holdover months in rent roll. (+0.5 X1)
5. Floor view: one back control, hide "Open floor plate" on the plate; finder near-misses; cursor steps from the date itself. (+0.5 X2)

## Bugs cited
segmentText badges in safe mode · DealList broker/size in safe · BlockPanel industry/broker/last touch in safe · PrintLayout renewal stage in safe · lenses legend pro-rating · print rent roll raw CSV values · exportCsv "-2" months · sublease row uses head-lease terms · "Vacates" for past dates · AsOfCursor steps from month start · ISO date in filter label · worklist chip clipping · no as-of live region · dark legend contrast · issues badge count mismatch.

## Status after the round-0 fix batch
All bugs above fixed except: timeline labels beside narrow bars, cursor halo, finder near-misses, collapsible mobile map legend, date-input locale.
