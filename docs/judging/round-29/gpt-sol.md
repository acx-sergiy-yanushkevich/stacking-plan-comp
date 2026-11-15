# GPT Sol, round 29

**UI 19/20 · UX 19/20 · Engineering 9/10 · total 94**

Fixed and confirmed: all 24 laptop combinations (3 sizes × 4 lenses × owner/safe) keep block names; the date fixes; the Map's "Plan views" strip.

- U3 3.5/4: at 1470×830 the Rent lens omits rates from Ste 860, Ste 120 and the café. U5 2.5/3: on phones the header, KPI groups, toolbar and map key take much of the first screen.
- X4 2.5/3: the focusable KPI groups have a role and description but no explicit name; Chrome names them from the tooltip.
- Engineering 9/10: the numbered-stop test stops at parsing, not at map identity; the block solver is hard to reason about.

## Fixes asked
- UI: give Rent rows enough height for a whole rate; collapse the phone KPI summary.
- UX: name each KPI group (`aria-label`/`aria-labelledby`); carry a stable stop identity through `Place.id`, highlight keys, Area rows and tapped-pin state.

## Bugs
- `src/components/kpis/KpiStrip.tsx:292`: groups not named by figure.
- `src/domain/places.ts:103`, `src/components/map/AreaPanel.tsx:194`, `src/components/map/MapView.tsx:414`: numbered stops share the key `stop:Bus stop`; rows cannot target their own pin.
