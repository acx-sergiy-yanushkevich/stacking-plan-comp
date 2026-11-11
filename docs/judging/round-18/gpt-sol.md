# Round 18 · Judge: GPT-6.1 Sol · Examined round-18 screenshots, all three Chrome PDFs, live desktop and phone interactions, domain/model/component code, and tests
UI 19/20 (U1 5, U2 4.5, U3 3.5, U4 3, U5 3) · UX 18.5/20 (X1 5, X2 3.5, X3 3.5, X4 2.5, X5 4) · Engineering 9/10

JUDGE: GPT-6.1 Sol
ROUND: round-18

UI SCORE
U1 Visual hierarchy & layout: 5/5: Property, grouped KPIs, toolbar and plan form a clear hierarchy. Shared floor labels eliminate duplicate numbering. The location brief gives headline figures, findings and supporting detail distinct levels.
U2 Color & data encoding: 4.5/5: Patterns, explicit status labels, dates and numeric legends supplement color. Area bars include figures and labeled US ticks. Adjacent blue expiration bands remain harder to distinguish quickly in the building and map.
U3 Typography & density: 3.5/4: Exact RSF, tabular figures and wrapping tenant names work well. Dense desktop legends, explanatory notes and inspector metadata still demand close reading.
U4 Polish & platform fit: 3/3: Coherent standalone glass surfaces in light and dark, consistent selection treatments, and deliberate transitions between building, floor and inspector.
U5 Mobile & print visual quality: 3/3: Phone cards preserve readable names and figures. The location brief fits 390 px without page overflow. Actual owner and prospect-safe PDFs have clean tables, complete location sections and correct final section numbering.
UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 5/5: All ten jobs have concrete paths: occupancy, rollover, renewal outreach, requirement matching, inquiry matching, records, future projections, data repair and exports. Largest-block highlighting makes the headline actionable.
X2 Interaction & IA: 3.5/4: Area is discoverable across views and through the building preview. Expanding and narrowing preserves the open floor; phone Escape behavior works. The client-facing location brief remains concealed behind a small icon labeled only through its accessible name or tooltip.
X3 Trust & domain correctness: 3.5/4: Availability versus vacancy, committed space, holdover, MTM, confidential rents and over-allocation are explicitly handled. Reviewed safe screens and exports withhold tenant details while retaining marketing information. The US bachelor’s benchmark loses precision: 21.61% becomes 22% in `src/domain/areaBrief.ts:37`, repeated in the brief and PDF.
X4 Accessibility of interaction: 2.5/3: Accessible groups, named controls, keyboard floor selection and phone sheet behavior are substantial strengths. Opening Area from desktop Building fails to move focus into the newly mounted inspector; immediate Escape consequently does nothing.
X5 CRM workflows & differentiation: 4/4: Demand-side inquiries, competing deals, renewal stages, activity recency, provenance, repair actions and context-specific record actions provide meaningful advantages over a static stacking plan.
UX TOTAL: 18.5/20

ENGINEERING (informational): 9/10: `npm test` passed all 856 tests across 58 files. Pure domain functions, centralized privacy rules, shared area data and URL state give the views consistent behavior. The host adapter and boundary tests materially improve portability to a shadow-root host. Remaining weaknesses include the inspector’s initial-mount focus gap, duplicated percentage formatting and the unproven production Salesforce integration. No build was run and no repository files were intentionally changed.

TOP UI FIXES (ranked by points gained per effort, max 5):

1. Increase desktop legend and inspector secondary text to at least 12 px with corresponding line spacing; allow the legend to wrap rather than compress. Target the dense Stack and Timeline headers. Expected gain: +0.5 UI.
2. Give neighboring blue expiration bands greater lightness separation in both palettes, retaining existing dates and labels. Verify the building and map at their normal viewing sizes. Expected gain: +0.5 UI.

TOP UX FIXES (ranked by points gained per effort, max 5):

1. Focus the inspector heading on its initial mount when opened in a tool mode, while preserving focus during Area/brief resizing. Verify Building → Area → Escape closes immediately and restores the trigger. Expected gain: +0.5 UX.
2. Replace both whole-percent helpers with one shared formatter that preserves the benchmark’s 21.61%; use it in Area charts, brief tables and PDFs. Keep approximate narrative comparisons explicitly approximate. Expected gain: +0.5 UX.
3. Add visible “Location brief” text beside the expand icon on desktop and in the phone panel header; change it to “Back to area” when expanded. Expected gain: +0.5 UX.

BUGS (with file:line):

- `src/components/inspector/Inspector.tsx:94`: `prevMode` initializes to the current mode, so the focus effect skips a newly mounted Area inspector. Reproduced from desktop Building: activate Area, press Escape; the panel remains open with focus on the toolbar.
- `src/domain/areaBrief.ts:37` and `src/components/area/LocationBrief.tsx:15`: whole-percent formatting changes the stored US bachelor’s share from 21.61% to 22% throughout the charts, brief and report.
