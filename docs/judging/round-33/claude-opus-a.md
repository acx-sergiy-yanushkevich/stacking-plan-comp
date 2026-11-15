# Round 33: Claude Opus A: 95/100

UI 19/20 · UX 19.5/20 · Engineering 9/10. Judged HEAD `5a4c711`.

Checked: 1,033 tests, `leakcheck` (0 leaks), `a11y`, `verify` (nine sizes), the phone Color-by row at 320, 360, 375 and 390 px, 60 search phrasings.

Findings:
- [`query.ts:81`](../../../src/domain/query.ts): "12k before 6/15" gives May 31, 2027 (should be Jun 14); "before 11/10" gives Oct 31, 2026 and is thrown out as past.
- `query.ts:152`: "by 2/29" and "by 6/31" are listed as unused, not named as not-a-date; "by feb 29" is called impossible though 2028 has one.
- "under 15k", "max 15k", "up to 15k" and "12k or less" run as a minimum.
- [`kpis.css:120`](../../../src/components/kpis/kpis.css): at 320 px "Expiration" runs into Pipeline; `:122`: the phone drops units ("9", "35,300").
- Short rows still mix 13, 11 and 10 px names. A table of date forms should drive both `readBy` and `beforeBy`.
