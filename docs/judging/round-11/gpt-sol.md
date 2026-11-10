# Round 11 · Judge: GPT-6.1 Sol · standalone Vice City skin, Building landing, cross-view workflows, mobile and PDF
UI 16.5/20 (U1 4, U2 3.5, U3 3.5, U4 2.5, U5 3) · UX 17/20 (X1 4.5, X2 3, X3 3.5, X4 2, X5 4) · Engineering 8.5/10

JUDGE: GPT-6.1 Sol
ROUND: round-11

UI SCORE

U1 Visual hierarchy & layout: 4/5: Header, KPIs and toolbar form a clear sequence. The default Floor 12 plate immediately explains the largest vacancy. However, Building view repeats floor facts across its heading, plate, four summary cards and suite list while showing only one floor's tenant detail. At 1280 × 800 with A02 selected, the plate reaches the viewport bottom and the floor summary falls below it. The large model and global chrome consume too much of the working viewport.

U2 Color & data encoding: 3.5/5: Leased blocks now have convincing separation from the purple surface. Sublease dots, committed hatching, explicit risk badges and exact legend totals are strengths. Expiration and rent use ordered ramps. Nevertheless, individual model faces still encode ordinary leased/expiring states, rent bands and deal stages through colour alone; the floor picker supplies occupancy percentages rather than the active lens's meaning. The selected floor's plate provides detail, but it does not make the whole-building encoding independently readable without colour.

U3 Typography & density: 3.5/4: Exact RSF, labelled rates, tabular figures and complete tenant names are handled carefully. Phone cards preserve names effectively. Desktop legends, floor-picker figures and secondary facts remain small, while narrow plate slices produce awkward multi-line labels—for example, S&P Enterprises in the selected A02 layout. The hierarchy between essential facts and explanatory repetition could be tighter.

U4 Polish & platform fit: 2.5/3: The night and daytime themes share a coherent visual language; controls, borders and selection treatments feel consistent. The neon palette itself is not a deduction. Lifted translucent floors, however, overlap into a visually busy mass when a lower floor is selected. This weakens the model's clarity precisely during inspection.

U5 Mobile & print visual quality: 3/3: The live 390 px layout has no horizontal page overflow, readable suite cards and practical sheet controls. The actual three-page owner PDFs render cleanly with complete names, exact areas, a rent roll and supporting analytics. Prospect-safe output retains legitimate asking information while withholding tenant rents and names.

UI TOTAL: 16.5/20

UX SCORE

X1 Persona job coverage: 4.5/5: Vacancy, rollover, availability timing, lease details, record-action stubs, owner reporting, time travel, issues and pipeline are all covered. The finder offers useful alternatives and distinguishes occupied space marketed for later. An inquiry-backed search cannot reliably complete a type-constrained requirement because changing Direct/Sublease does not affect its options.

X2 Interaction & IA: 3/4: Views and tools are discoverable, URL state is useful, and floor preview versus pinning is explained. Two interaction defects undermine the new landing experience: a remembered hover can keep an unrelated floor displayed after search, and opening an inspector removes the floor picker. Reproduced after fonts settled: preview Floor 6, leave it, search "Kinetic"; the filter reports the Floor 12 match while the large detail column remains on Floor 6.

X3 Trust & domain correctness: 3.5/4: Holdover, MTM, committed occupancy, confidential rents, asking rates and missing-unit issues receive explicit treatment. No prohibited tenant-name or in-place-rent disclosure was observed in the inspected safe states and supplied PDFs. However, inquiry type is silently forced to Any (`src/model/usePlanModel.ts:158`). Also, Building view omits the over-allocation explanation beside its raw-record legend (`src/components/building/BuildingView.tsx:62`): its occupied categories total 211,700 SF while the capped leased KPI is 211,200 SF. Stack and PDF explain this discrepancy; the landing screen should too.

X4 Accessibility of interaction: 2/3: Phone rows, plate keyboard navigation, popover focus handling and labelled controls show substantial care. Axe found no violations in the selected-A02 desktop state. Manual review finds a consequential gap: the floor picker becomes `display:none` with an inspector open (`src/components/building/building.css:31`), while model floors remain aria-hidden pointer targets without keyboard semantics (`src/components/hero/BuildingHero.tsx:175–182`). Changing floors then requires closing the panel or changing views.

X5 CRM workflows & differentiation: 4/4: Inquiry matching, competing deals, renewal activity, broker ownership, published/quiet availability information, data repair links and change history meaningfully extend the stacking plan beyond a static rent-roll picture. These directly address the opportunities documented in COMPETITORS §§4–7. Intended record-action toast stubs receive no deduction.

UX TOTAL: 17/20

ENGINEERING (informational): 8.5/10: All 241 tests across 25 files pass using `npm test -- --cache=false`. Pure domain modules, a shared derived model, URL-backed state and data-source interfaces provide a sound structure. Privacy helpers and domain edge-case coverage are particularly useful. Current Building tests largely verify server-rendered output, so they miss CSS-hidden navigation and stateful hover/search precedence. LWC portability benefits from the separated domain logic, but global styles, document-level effects and React-specific interaction plumbing still require adaptation. No repository files were written and no build was run.

TOP UI FIXES (ranked by points gained per effort, max 5):

1. Add a compact active-lens fact to each floor-picker row: nearest expiry bucket, most advanced deal stage, or a clearly labelled rent summary. Add corresponding model hover/focus text. Preserve dots and hatching. This reduces colour-only interpretation across the building. Expected gain: +0.5 U2.
2. In the inspector-open Building layout, reduce model and plate height, move the schematic caption into a compact disclosure, and retain floor KPIs immediately beneath the plate. At 1280 × 800, make the plate and first summary row visible together. Expected gain: +0.5 U1.
3. Replace the overlapping lifted-floor treatment with separated outlines or a collapsed upper-floor silhouette carrying an explicit floor range. Keep the selected slab opaque and prominent. Expected gain: +0.5 U4.
4. Increase floor-picker text to 12 px and secondary legend text to 12 px; give narrow plate slices a suite/RSF/state label with the full tenant name in the adjacent list when wrapping becomes excessive. Expected gain: +0.5 U3.

TOP UX FIXES (ranked by points gained per effort, max 5):

1. Use `state.fit` when deriving an inquiry-backed requirement. Reproduce with `?inquiry=I02&mode=find&fit=sublease`: the direct Floor 6 option must disappear from Options. Add an interaction test that changes type while keeping the inquiry selected. Expected gain: +0.5 X1 and +0.5 X3.
2. Keep a keyboard-operable floor selector visible whenever the inspector opens; a compact labelled select is sufficient. Preserve selection and inspector context when changing floors. Expected gain: +0.5–1 X4.
3. Make a new filter override remembered, unpinned hover history: resolve the displayed floor as active hover, explicit pin, matching floor, remembered floor, default. Verify preview Floor 6 → search Kinetic displays Floor 12. Expected gain: +0.5 X2.
4. Add the existing Stack over-allocation disclosure to Building's legend: recorded areas include Floor 7's 500 SF excess; leased occupancy is capped. Show it without requiring a floor selection or opening Issues. Expected gain: +0.5 X3.

BUGS (with file:line):

- `src/model/usePlanModel.ts:158`: Inquiry-backed requirements hard-code `type: 'any'`; the visible type control updates `state.fit` but leaves matching unchanged. Live reproduction: `?inquiry=I02&mode=find&fit=sublease` lists Floor 6 as Direct.
- `src/components/building/building.css:31` and `src/components/hero/BuildingHero.tsx:175`: Opening an inspector hides the keyboard floor picker while the remaining model targets are aria-hidden and pointer-only. Live A02 inspection exposes zero visible picker buttons.
- `src/components/building/BuildingView.tsx:48`: `lastId` precedes the matching floor. After previewing Floor 6, searching Kinetic leaves Floor 6 displayed despite the filter identifying Floor 12.
- `src/components/building/BuildingView.tsx:62`: Building's legend receives no over-allocation note, although `src/domain/lenses.ts:266–269` deliberately sums recorded SF. The landing screen therefore presents occupied-category totals 500 SF above its capped leased KPI without explaining the difference.

Synthesis check: the `type: 'any'` override at `src/model/usePlanModel.ts:158` was confirmed in the source.
