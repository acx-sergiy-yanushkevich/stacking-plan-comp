# Round 9 · Judge: Grok 4.7 · standalone app, glass skin
UI 18/20 (U1 4.5, U2 5, U3 3.5, U4 3, U5 2) · UX 18.5/20 (X1 4.5, X2 3.5, X3 3.5, X4 3, X5 4) · Engineering 8.5/10

## Top UI fixes
1. Phone tiles that cannot share name and SF show SF + date only (café, bank, NAAH) → keep the name. (Block.tsx:193)
2. Phone timeline: 640 px minimum inside a 372 px scroller cuts bars on the first screen (TimelineView.tsx:24, :38).
3. Desktop blocks under ~90 px: stop at name + SF (BeachBody, Conner, café run to 3–4 lines).
4. Move the "Floor 7 records exceed…" sentence out of the legend into Data issues.

## Top UX fixes
1. Prospect-safe shows sale economics: header "For sale $68,500,000 · $279.14/RSF · 6.4% cap" + broker in the tooltip (Header.tsx:70); Sale availability price $1,027,000 in block title/aria, inspector, rent roll and safe PDF (safe.ts:22, segmentText.ts:132, BlockPanel.tsx:160, exportCsv.ts:152).
2. Phone search field hidden: shell.css:72 `display: none` at ≤ 760 px, never re-enabled (:80).
3. Finder with one hit and near misses: say so in the banner and ring the hit (near misses A08, A06, A07, L14-U2 are undimmed beside L13-U1 under "other space is dimmed").

## Bugs
Header.tsx:70 no safe check; safe.ts:22 Sale price visible; shell.css:72/:80 phone search; Block.tsx:196 phone name dropped.

## Round-9 council average (three judges)
UI (17.5 + 17.5 + 18)/3 = 17.7 · UX (19.5 + 19 + 18.5)/3 = 19.0 (round 8: 17.7 / 18.8)
