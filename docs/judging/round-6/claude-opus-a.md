# Round 6 · Judge: Claude Opus 5.5 (A)
UI 17/20 (U1 4.5, U2 4, U3 3.5, U4 2.5, U5 2.5) · UX 18.5/20 (X1 4.5, X2 4, X3 3.5, X4 2.5, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Deal-row collision in inspector Deals list: SF value drawn over "Updated …" (parts.tsx:70 nowrap span + inspector.css:51) → separate spans per part; `.sp-ins__row-end { align-self: flex-start }`.
2. Rent lens: Conner / BeachBody / Café drop the rate though lines are free → split lensShort into two lines ("$32/SF/yr" / "FSG") when capacity allows (Block.tsx:93).
3. Rent band labels share boundaries ("$28–31" / "$31–34") → "$28–$30.99" style (lenses.ts:233-236).
4. Phone: Floor 1 blocks drop SF; prefer tiny whole-word names over initials when three tiny lines fit; initials only < ~48 px.
5. Timeline labels over hatch/dots need a card-coloured halo; plate slices without a name need a state word/initials and the 3 px edge bar (Café colour-only).

## Top UX fixes
1. Esc from a tool panel focuses #sp-plan, not the KPI/toolbar button that opened it (App.tsx:138, Inspector.tsx:87).
2. Safe timeline: holdover/MTM bars stop exactly at the cursor and lose SF → singled out (TimelineRows.tsx:228-230); draw like any lease (label "Tenant · Ste 300 · 11,000 SF") or end at recorded expiry.
3. Owner PDF worklist omits at-risk tenants (Argosy holdover, Bowline MTM) → add "At risk" rows; keep out of the safe PDF.
4. Find-space inquiry select truncates "…15,000–22,000 S" → shorter option text + range below.
5. "Expiring 12 mo" KPI lights whenever the Expiration lens is on → only on worklist 12 mo / matching bucket.

## Bugs
parts.tsx:70 overlap; Block.tsx:93 rate dropped; lenses.ts:233-236 band labels; App.tsx:138 focus; TimelineRows safe bars; FloorPlate colour-only Café; phone Floor 1 SF; owner PDF worklist at-risk rows; inquiry select truncation.
