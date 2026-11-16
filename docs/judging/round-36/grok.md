# Round 36: Grok 4.7: 97/100

UI 19.5/20 · UX 19.5/20 · Engineering 9.5/10. Judged on its own preview (port 4184); 1,058 tests, `leakcheck` (0 leaks); the round-36 phrases checked live; sheet history at 390, 768, 1024 and 1099 px.

Findings:
- [`FilterBar.tsx:100`](../../../src/components/stack/FilterBar.tsx): the empty-state regression ("Showing Nothing for sale on Floor 5.. Other space is dimmed.").
- "850-860", "ste 850-860" and "1200-1250" match nothing; "8th floor ste 860" matches nothing.
- [`FilterBar.tsx:73`](../../../src/components/stack/FilterBar.tsx): the offer bar's Clear leaves `fit=direct`.
- [`query.ts:255`](../../../src/domain/query.ts): two ceilings or two floors keep the first ("under 20k max 15k" is up to 20,000). A Unicode minus is not a range.
