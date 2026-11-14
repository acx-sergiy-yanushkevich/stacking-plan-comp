# GPT Sol, round 28

**UI 18.5/20 · UX 18.5/20 · Engineering 9.5/10 · total 93**

## Scores
- U1 5/5, U2 5/5, U3 3/4 (compact Stack rows lose useful labels: North American Axon's name disappears while its "No activity" badge stays at 1280×800; some narrow suites lose their suite number; Rent KPIs lose their lease-type label below 1440 px), U4 3/3, U5 2.5/3 (on the 390×844 map about 490 CSS px precede the map canvas).
- X1 5/5, X2 3.5/4 (Back skips ordinary state changes), X3 3.5/4 (compact Rent KPI shows `$30.71/SF/yr` without FSG or "in place"), X4 2.5/3 (KPI explanations are native `title` only), X5 4/4.
- Engineering 9.5/10: history implementation misses a real interaction contract; the block-label solver needs browser-level regression coverage at compact heights.

## Top UI fixes
1. Keep `FSG · in place` / `FSG · asking` visible in compact Rent cards.
2. In compact Stack rows move informational badges into the tooltip before dropping the tenant name; keep the suite number with exact SF.
3. Reduce the phone map's chrome above the canvas (compact, expandable KPI summary).

## Top UX fixes
1. Add history entries for deliberate navigation (view, building, ring, turn, selection); replace only for normalization and coalesced typing; test Back/Forward.
2. Keep the rent basis and asking/in-place qualifier visible at every breakpoint.
3. Replace KPI native-title-only explanations with the accessible tooltip/popover (focus, touch, Escape).

## Bugs
- `src/lib/host.ts:187`: all URL updates use `replaceState`; Back skips the previous building turn.
- `src/components/kpis/kpis.css:98`: hiding KPI context below 1440 px removes the Rent figure's lease type and basis.
- `src/components/stack/Block.tsx:302`: badge-removal fallback excludes some compact blocks; badges survive while the tenant name disappears.
- `src/components/kpis/KpiStrip.tsx:305`: KPI explanations use native titles with no focus/touch disclosure.

**Wes:** "The space finder and prospect-safe handoff tell a strong client story. Keep the rent basis visible before putting this on a tenant's phone."
**Todd:** "Why does a URL-driven product still skip my previous state when I press Back?"
