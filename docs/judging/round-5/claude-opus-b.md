# Round 5 · Judge: Claude Opus 5.5 (B)
UI 16.5/20 (U1 4.5, U2 4.5, U3 3, U4 2.5, U5 2) · UX 18/20 (X1 4.5, X2 4, X3 3.5, X4 2.5, X5 3.5) · Engineering 8.5/10

## Top UI fixes
1. Never show a name fragment: Block drop sub line, then lens line, before cutting a name; else abbreviation + SF. FloorPlate: every wrapped name line places or no name ("Café"). Inspector deal names wrap.
2. Keep the lens fact at tier ≤1 when name takes two lines (rent lens: Preston Park Café, BeachBody); same in print plan (Conner, Café lose SF).
3. Phone: tier-2 three-line tiny names before SF+date; "Avail"/"For sale" always with SF; lobby labelled "Lobby"; phone timeline name before Holdover tag.
4. Collisions: worklist marketed chip own row (overlaps SF); Find alternatives meta flex (wrapped line starts with "·"); phone map controls below legend; timeline label knockout over Today line.
5. Encoding: no sublease dots under text; for-sale own legend entry in Deals/Rent lenses; dark exp-3/exp-4 ≥10 L* apart; MiniStack one-decimal %.

## Top UX fixes
1. Safe rent roll: holdover/MTM Expiration "—", Remaining "—" (CSV + display) via one `safeLeaseTerm()` in safe.ts; test no safe row expires before as-of. (exportCsv.ts:107,142,152)
2. Deals lens: forsale → own tone / "For sale, no deal" (lenses.ts:158,227). Safe expiry: neutral "Term undisclosed" grey instead of exp-5 (:152,:208).
3. aria-labels start with the full tenant/state name, never fragment/initials/glyph.
4. Per-record "Changes" section in BlockPanel from property.history; "since last report" markers.
5. Phone: tap opens sheet at 45% with name in title, selected block stays visible.

## Bugs
exportCsv safe holdover row "Leased · Aug 31, 2026 · 0 mo"; lenses forsale in Deals as "Leased, no deal"; safe expiry holdover/MTM as exp-5; Block rent lens two-line names drop rent; Block fragments "Preston…"/"Conner…" on desktop; FloorPlate "Café"; MiniStack rounding; Worklist chip overlap at 1440/1280; phone map zoom control over legend.
