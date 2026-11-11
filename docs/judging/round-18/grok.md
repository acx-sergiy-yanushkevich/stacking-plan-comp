# Round 18 · Judge: Grok 4.7 · Live app at localhost:4180, round-18 shots and Chrome PDFs, and the area, legend, and prospect-safe code
UI 19/20 (U1 4.5, U2 4.5, U3 4, U4 3, U5 3) · UX 19/20 (X1 5, X2 3.5, X3 3.5, X4 3, X5 4) · Engineering 9/10

JUDGE: Grok 4.7
ROUND: round-18

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: Header, the two-group KPI bar, and one toolbar stay in that order, and the plan is the largest region in Stack, Building, Timeline, and Map. In `?mode=brief` the same six leasing figures (expiring SF, pipeline, WALT) still lead, so the location headlines sit under a full leasing chrome.
U2 Color & data encoding: 4.5/5: Status, expiration, rent, and deals each use a fill plus a pattern, badge, or word (dots, hatch, dashed, Holdover, MTM, Confidential, vacated). The legend prints exact SF. Independently rounded shares do not close: status 10.7+2.9+3.3+1.1+58.8+14.4+7.0+2.2 = 100.4, deals = 100.3, rent = 100.1, while recorded SF is 245,900 / 245,400 = 100.2.
U3 Typography & data density: 4/4: Live text had no ellipsis. Long names wrap whole (North American Asset Holdings, Preston Park Café). Print and both owner PDFs keep those names, suite, SF, and rate. Figures are tabular.
U4 Polish & platform fit: 3/3: The glass skin holds in the default dark theme, `?theme=light`, and `?palette=vice`. Color-by KPIs show a dot, underline, and `aria-pressed`; Open figures show an arrow and are not pressed. Sampled faint text on the card measured 5.5:1 or better.
U5 Mobile & print visual quality: 3/3: At 390 px and 420 px the header is one title and one control row (Safe, Export, issues behind “…”). The brief sheet is full height. The Chrome PDFs are 4 sections (owner) and 3 (prospect-safe), each ending on the location brief; the cover plan is white, labeled, and presentation-grade.
UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 5/5: Occupancy, expirations, the 12-month worklist, contiguous find (12,000 SF), block detail, prospect-safe export, direct versus sublease versus committed, as-of 2028 with reconciling deltas, the issues list, and the deal lens are all reachable. Area is on the toolbar in every view, and the Building panel opens on the 1-mile population, income, and nearest stop.
X2 Interaction & IA: 3.5/4: Stack, Timeline, Map, and Building share one selection model. Opening Area and then Location brief, then Escape, narrows to the charts and a second Escape closes the panel. A cold `?mode=brief` link leaves focus on the body, and Escape does nothing until the heading is focused.
X3 Trust & domain correctness: 3.5/4: RSF, holdover, MTM, the Floor 7 7,000 SF sublease, confidential rent, and the quiet Cirrus listing are handled exactly. Prospect-safe live text contained no tenant, contact, in-place rent, or the $68,500,000 listing; asking rents stay, and the building reads “Listed for sale”. Legend percents still do not add back to recorded SF (see Bugs).
X4 Accessibility of interaction: 3/3: Blocks and timeline bars are buttons with names; a history bar such as Cirrus at Jan 2028 is `aria-disabled` and a click does not change the selection. KPI color-by exposes `aria-pressed`. Contrast samples on the dark card cleared 4.5:1.
X5 CRM workflows & differentiation: 4/4: The deals lens, inquiry match, last-touch ages, the change log, and prospect-safe on screen and in the PDF use the lease, deal, inquiry, and activity records. The contiguous finder, exact RSF, and an as-of date that recomputes the KPIs are the gaps VTS, Prophia, and CoStar leave open. The location brief adds the client page none of them ship, and it is labeled sample ACS data.
UX TOTAL: 19/20

ENGINEERING (informational): 9/10: `npm test` passed 856 tests. Domain math for KPIs, finder, rollover, prospect-safe, timeline history, and the area brief is pure TypeScript with tests beside it. UI state is the URL. Styles are tokens in CSS, with a host adapter, which is the shape an LWC port can copy. The remaining gaps are presentation: legend shares are rounded one category at a time, and the brief’s focus effect does not run when the page loads already in that mode.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. In `mode=brief`, do not render `KpiStrip` (keep the header and a way back). The six leasing figures currently sit above the four location headlines, so a client page still opens on expiring SF and pipeline. Expected U1 +0.5.
2. In `Legend.tsx`, assign the 1-decimal shares by largest remainder so the non-overlay items sum to one decimal of recorded SF ÷ leasable (100.2 for this building), and keep the asking-rent overlay as SF only. Expected U2 +0.5.
TOP UX FIXES (ranked by points gained per effort, max 5):
1. When the first mode is already `brief`, focus the Area heading, and if Escape is pressed while focus is outside the panel and `mode` is `brief`, patch the mode to `area` before any later Escape closes it. A linked brief currently ignores Escape. Expected X2 +0.5.
2. Same largest-remainder change as UI fix 2, asserted in `Legend.test.tsx` against the mock building: status must print 100.2, not 100.4. Expected X3 +0.5.
BUGS (with file:line):
- `src/components/inspector/Inspector.tsx:95`: the focus effect treats the current mode as the previous mode, so a load of `?mode=brief` never focuses the panel. Confirmed: focus stays on `BODY`, and Escape leaves the URL at `?mode=brief`.
- `src/App.tsx:270`: the page Escape handler returns when it is not clearing a filter, and it never narrows a brief. Escape works only after focus is already inside `.sp-ins` (`Inspector.tsx:105`).
- `src/domain/format.ts:10` and `src/components/plan/Legend.tsx:55`: each share is rounded to 0.1% on its own. With recorded SF from `src/domain/lenses.ts:289`, status prints 100.4%, deals 100.3%, rent 100.1%, against 245,900 / 245,400 = 100.2%.
