# Round 37: Grok 4.7: 98/100

UI 20/20 · UX 19.5/20 · Engineering 9.5/10. Judged `99f27d9` on its own preview (port 4184); 1,066 tests, `leakcheck` (0 leaks), `verify`, `a11y`.

Findings:
- [`finder.ts:335`](../../../src/domain/finder.ts): a multi-floor stack over the maximum is kept when any one suite is divisible: Legacy West "Floors 18–19 … 52,000 SF split to 12,000" (Ste 1900 is an indivisible 26,000 SF); Bluebonnet "Floors 2–3 … split to 6,000" (its smallest is 6,900 SF).
- [`query.ts:279`](../../../src/domain/query.ts): "not greater than 15k" and "not above 15k" run as a minimum.
- "1200−1250" with a minus sign and "860 on floor 8" find nothing; "by 2/30" alone is a failed name search.
