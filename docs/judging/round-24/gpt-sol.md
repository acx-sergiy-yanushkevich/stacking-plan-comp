JUDGE: GPT-6.1 Sol
ROUND: round-24

UI SCORE
U1 Visual hierarchy & layout: 5/5: Property, KPIs, tools and plan read in a clear order. The Building view’s aligned floor labels and the Map’s surroundings/Area split give each view a distinct purpose.
U2 Color & data encoding: 4.5/5: Expiration runs red first in both themes; hatching, dots, dashed borders and explicit labels distinguish leasing states. Map amenity categories still use identically shaped dots differentiated only by color.
U3 Typography & density: 4/4: Exact SF, tabular figures, readable floor summaries and complete tenant names support dense desktop views. Phone suite lists preserve the important facts without squeezing them into miniature blocks.
U4 Polish & platform fit: 2.5/3: The glass skin is coherent and legible in light and dark. Phone Map styling removes the “Sample places” disclosure while retaining the seeded places, making that state less complete than desktop.
U5 Mobile & print visual quality: 3/3: Phone controls, expandable legends and inspector sheets are readable. The actual owner PDFs render cleanly as four pages each; the prospect-safe PDF renders as three, with intact tables and location briefs.
UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 4.5/5: Vacancy, rollover, renewals, issues, inquiries, pipeline and exports are well covered. Legacy West’s 60,000 SF search correctly returns Floors 18–20 at 78,000 SF. Floor-specific size requests require manual inspection because search drops their floor constraint.
X2 Interaction & IA: 3.5/4: The supplied natural-language examples, reversed ranges, available-space search and legend Tab dismissal work. However, entering Map with a suite selected retains its lease inspector instead of opening Area; the surroundings lose their key and keyboard counterpart.
X3 Trust & domain correctness: 3/4: Occupancy, signed space, pipeline demand versus space in play, confidential rents and recorded-area discrepancies are explained carefully. A remaining Safe transition exposes an unpublished availability ID in the URL: select `CS-A06` in Cedar Springs, then enable Safe. The inspector also becomes empty. See [src/state/planState.ts:147](../../../src/state/planState.ts#L147). Phone maps additionally hide the sample-position disclosure at [src/components/map/map.css:129](../../../src/components/map/map.css#L129).
X4 Accessibility of interaction: 2.5/3: Roving navigation, named controls, keyboard-readable legends and Area-row highlighting are strong. MapLibre nevertheless exposes 86 identically named “Map marker” buttons in the accessibility tree, including decorative labels. Their inner content is hidden, but their wrappers remain exposed.
X5 CRM workflows & differentiation: 4/4: Inquiry matching, competing deals, renewal activity, verification issues and record-specific actions make this substantially more useful than a static stacking plan. Simulated Wes: “The broker-to-prospect story is convincing; fix the Safe transition before a client demo.” Simulated Todd: “The numbers reconcile; how will the production adapter enforce the same privacy boundary?”
UX TOTAL: 17.5/20

ENGINEERING: 8.5/10: All 929 tests across 67 files passed with caching disabled. Pure domain modules, centralized privacy policy, URL state, shared calculations and the host/data-source boundaries provide a credible LWC migration path. The remaining defects cross boundaries that isolated tests miss: projected safe segments versus serialized selection, selected-suite state versus Map entry, and third-party marker wrappers versus accessibility. The accessibility runner excludes the entire MapLibre subtree, leaving those semantics unchecked. Repository status remained clean; no build was run.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. Preserve a compact “Sample places” chip on phone maps. Hide the footprint metadata separately rather than hiding all `.sp-map-info__meta` at [src/components/map/map.css:129](../../../src/components/map/map.css#L129). Expected gain: +0.5 U4.
2. Give each amenity category a distinct glyph or shape, mirrored in its Area row. Extend [src/components/map/placeHighlight.ts:30](../../../src/components/map/placeHighlight.ts#L30) and render the redundant cue on each pin. Expected gain: +0.5 U2.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. Sanitize selection when entering Safe and loading safe links. Clear or remap selections pointing to unpublished availabilities before serializing state; return the inspector to a valid panel. Cover `CS-A06` selected → Safe → Copy link/reload. Start at [src/state/planState.ts:147](../../../src/state/planState.ts#L147). Expected gain: +0.5 X3.
2. Make clicking Map explicitly open Area even when a suite or floor is selected. Preserve the previous selection for returning to the plan, and use the Map panel default when switching buildings on Map. Update [src/components/shell/Toolbar.tsx:108](../../../src/components/shell/Toolbar.tsx#L108) and [src/state/planState.ts:165](../../../src/state/planState.ts#L165). Expected gain: +0.5 X2.
3. Keep “Sample places” visible beside the phone map, explicitly identifying the pins’ sample positions. Expected gain: +0.5 X3.
4. Parse floor constraints in size queries and carry them through requirement state and finder filtering. “5k direct on floor 8” should offer Floor 8’s 7,400 SF combination without presenting other floors as matches. Update [src/domain/query.ts:174](../../../src/domain/query.ts#L174). Expected gain: +0.5 X1.
5. Hide decorative marker wrappers from assistive technology and remove their generated button semantics; retain Area rows as the keyboard equivalent. Apply this after marker creation at [src/components/map/MapView.tsx:278](../../../src/components/map/MapView.tsx#L278). Test the wrappers instead of excluding the entire map at [scripts/a11y.mjs:46](../../../scripts/a11y.mjs#L46). Expected gain: +0.5 X4.

BUGS (with file:line):
- **P1 — Unpublished ID survives Safe transition:** Open `?building=P005&view=stack&select=CS-A06`, then enable Safe. The URL retains `select=CS-A06&safe=1`, and Block says nothing is selected. Segment projection changes the key, but state keeps the old ID. [src/domain/safe.ts:233](../../../src/domain/safe.ts#L233), [src/state/planState.ts:147](../../../src/state/planState.ts#L147).
- **P2 — Map entry depends on stale selection:** Select Cirrus Energy in Stack, then click Map. The map opens with Cirrus’s lease inspector and no Area panel. [src/state/planState.ts:167](../../../src/state/planState.ts#L167).
- **P2 — Phone sample disclosure disappears:** At 390 px, seeded pins remain visible while their “Sample places” label has a hidden ancestor. [src/components/map/map.css:129](../../../src/components/map/map.css#L129).
- **P2 — Size search silently ignores floor:** Enter “5k direct on floor 8” and press Enter. Results include Floors 3, 12 and 6 alongside Floor 8; the original floor constraint disappears. [src/domain/query.ts:178](../../../src/domain/query.ts#L178).
- **P2 — Repeated unnamed map semantics:** The default map exposes 86 wrappers as buttons named “Map marker”; hiding their child spans does not hide those wrappers. [src/components/map/MapView.tsx:278](../../../src/components/map/MapView.tsx#L278), [src/components/map/MapView.tsx:378](../../../src/components/map/MapView.tsx#L378).
