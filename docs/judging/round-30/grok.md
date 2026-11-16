# Grok, round 30

**UI 19.5/20 · UX 19.5/20 · Engineering 9.5/10 · total 97**

Confirmed: Back returns to the view, building, floor, ring, quarter-turn and Prospect-safe it left (typing and suite choice replace the entry); date forms ("6/1/2027", "15 Jan 2027", "Nov 5" next year, "Nov 9" today); Available and Largest block named groups; four same-name Bluebonnet stops light four distinct pins; prospect-safe shows no name or rent.

- U3 3.5/4: at 1366×768 S&P Enterprises' "4,900 SF · $29.75/SF/yr FSG" is drawn to 177 px in a 172 px block: the text measure corrects digits but not `$`, `/` or `·` (`src/lib/textFit.ts:28`, `Block.tsx:149`).
- X4 2.5/3: the four same-name stop rows and accessible names are identical ("Bus stop, bus, under 0.1 miles"); keep the pole number or a bearing (`OverpassSource.ts:152`, `AreaPanel.tsx:198`).
- Bug: a bad day-first date reads "31 feb 2027" (`query.ts:122,129`).
