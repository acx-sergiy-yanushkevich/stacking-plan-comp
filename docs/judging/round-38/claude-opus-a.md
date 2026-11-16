# Round 38: Claude Opus A: 94/100

UI 19/20 · UX 19/20 · Engineering 9/10. Judged `1acfecd` on its own preview (port 4181); 1,084 tests and `tsc -b` on an export of HEAD, `verify`, `leakcheck` (0 leaks), `a11y`, about 100 phrasings through `readQuery` and `readPlace` and 23 in the live bar. All seven round-37 findings fixed.

Findings:
- [`query.ts:362`](../../../src/domain/query.ts): "12k or 15" offers "up to 12,000 SF"; "10k or 12k or 15k" is called impossible.
- [`usePlanModel.ts:198`](../../../src/model/usePlanModel.ts): "860, 870" says "1 match: Suite 860" without naming the missing 870; "floors 11-14" lights 11–12 without a note; "860 on floor 9" gets the name-search miss.
- `query.ts:409`: "fl. 8", "floors 3 and 5", "ste 860 on the 8th floor" and "available on floors 3-5" are not read.
- "12k approx" runs a 12,000 SF minimum while "about 12k" is a range; "12k sub-lease" lists "sub-lease" as unused; "12k sublease not ok" runs as sublease.
- [`Button.tsx:25`](../../../src/components/ui/Button.tsx): the phone More button is named "More8" and carries aria-pressed with aria-haspopup; the menu item is named "Data issues8" ([`Menu.tsx:84`](../../../src/components/ui/Menu.tsx)).
- [`FilterBar.tsx:44`](../../../src/components/stack/FilterBar.tsx): the live region is mounted with its first message.
- The phone's first floor card starts 454 px down at 390 × 844; narrow rows mix 10, 11 and 13 px names; the query reader wants a small tokenizer.
