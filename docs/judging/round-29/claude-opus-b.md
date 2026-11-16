# Claude Opus B, round 29

**UI 19/20 · UX 18.5/20 · Engineering 9/10 · total 93**

Fixed and confirmed: fitted rows keep names at 1470×830, 1440×1000, 1366×768; `asOf=2027-02-30` falls back; leakcheck 0; Map strip read-only.

- U2 4.5/5: Rent's "Gross < $28" and "$28–30.99" bands are hard to tell apart; the Rent legend leaves "For sale" alone on a second line at 1440 px.
- U3 3.5/4: "a rate stays before the suite number" fails in Chrome: owner Rent at 1470×830 (Ste 860, Ste 120), prospect-safe Rent at 1366×768 (Ste 850, Ste 860). Cause: `if (!compact) return NONE` (`Block.tsx:195`). Conner CPA drops to 10 px beside 12 px neighbors.
- X2/X3: "12k by Nov 5" reads Nov 5, 2026 (before the as-of date; the year rule compares months only, `query.ts:92`); "12k by 15 Jan 2027" becomes Jan 31; the bad-date sentence starts lowercase (`FilterBar.tsx:36`).
- X4 2.5/3: Details groups are named from `title` ("26,200 direct… Point at it…"), not "Available 33,200 SF" (`KpiStrip.tsx:289-291`).
- Engineering 9/10: the unit test passes at a chosen width; the verify check compares only 8 characters and never the rate; `realDayOrNull` duplicates `realDay`.

## Fixes asked
Keep the rate (allow 11/10 px steps for non-compact rows; make verify fail on `$` titles without `$` text); separate the two lowest Rent bands; one-line Rent legend at 1440; roll a year-less day to the next such day; read day-first dates; capitalize the bad date; name Details groups; whole-name verify.
