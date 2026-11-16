# Round 37: Claude Opus B: 95/100

UI 19/20 · UX 19.5/20 · Engineering 9/10. Judged `99f27d9` on its own preview (port 4182), reading code with `git show`.

Checked: 1,066 tests in an extract of `99f27d9`, `leakcheck` (0 leaks), `a11y`, `verify`, about 85 phrases through `readQuery` and 14 in the live box (all views, owner and Prospect-safe), a full keyboard walk, six phone and tablet sheet-history cases at 390 and 1024 px, a tap-every-card Prospect-safe scan at 390 and 320 px. All five round-36 findings fixed and confirmed live.

Findings:
- [`query.ts:267`](../../../src/domain/query.ts): "12k or 15k" runs as a 15,000 SF minimum.
- `query.ts:185`: "12000sqft" is used and also listed as unused (likewise "12k-ish").
- `query.ts:334`: "12k not direct only" runs as direct.
- "around 12k" and "~12k" drop the "about" silently; "greater than or equal to 12k" lists its words as unused.
- [`FilterBar.tsx:37`](../../../src/components/stack/FilterBar.tsx): the whole bar is `role="status"`, so its button text is announced with every message.
- The phone sheet's drag handle shows its focus ring after a touch tap.
- Not scored: the mock contact names are fictional CRM data; worth a deliberate decision against the anonymity rule.
