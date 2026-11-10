# Round 9 · Judge: Claude Opus 5.5 (B) · standalone app, glass skin
UI 17.5/20 (U1 4.5, U2 4.5, U3 3.5, U4 2.5, U5 2.5) · UX 19/20 (X1 5, X2 3.5, X3 4, X4 2.5, X5 4) · Engineering 8.5/10

## Top UI fixes
1. FloorPlate.tsx:226-229: when no line places, draw a glyph or one-word state at 11 px (phone Floor 1 Café and For sale are colour-only).
2. Hover and popovers: block hover is nearly invisible (glass.css:162 brightness 0.97) → border-strong stroke + lift; `--sp-glass-float` to 0.98 / 0.97 so menus do not ghost; `.sp-menu { min-width: 300px }` (Export items wrap beside hints).
3. Phone: leased % under the floor number in the gutter; tenant name at 10 px on tiles ≥ 64 px before dropping it; timeline title on its own row; "< 12 mo" not "<1 yr".
4. Text rhythm: wrapped name lines need full pitch (NAAH, Conner, BeachBody, Café); worklist subtitle "4 leases · 35,300 SF" nowrap (orphan "SF").
5. Dark expiry ramp: 2–3 yr / 3–5 yr / 5+ yr ≥ 8 L* apart.

## Top UX fixes
1. Accessible names (Block.tsx:210-214): no glyph in the name; ", " between name and drawn lines; drop a badge title when its short text is already said.
2. Inquiry mode: "N inquiry fits" chips count only the selected inquiry (Floors 8 and 7 claim a fit while matching Harbor Freight).
3. Change row with null `from`: "Linked to Suite 600" not "— → Suite 600" (BlockPanel.tsx:180).
4. Lumen committed tile on phone reads "Jan '34" vs "Moves in Feb 2027" on desktop.
5. Map rail tie-break: Floor 12 at 50.0% says "Leased" under a green roof → "Half available".

## Bugs
FloorPlate no fallback; glyph in aria; badge title repeated, no separator; null-from change row; hover invisible; menu min-width + float opacity; worklist orphan "SF"; Building inspector Pipeline section cut at the panel bottom; phone Lumen date; phone timeline "<1 yr" + clipped labels; inquiry-mode chips; 3D building washed out (light) / white (dark); mini rail stubs carry no information.
