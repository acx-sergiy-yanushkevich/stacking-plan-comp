JUDGE: gpt-6.1-sol
ROUND: round-20

UI SCORE
U1 Visual hierarchy & layout: 4.5/5: Property, KPIs, toolbar and plan form a clear hierarchy. Floor labels and the inspector preserve context. At 1280 px, however, the search field overlaps the Deals lens, visibly breaking the toolbar layout.
U2 Color & data encoding: 4.5/5: Exact SF, explicit state labels, sublease dots and committed hatching support the colors. Stack and PDF explain the independently rounded shares. Building, Timeline and Map omit that complete explanation despite displaying the same percentages.
U3 Typography & density: 4/4: Tabular figures, readable tenant names and sensible wrapping support dense analysis. Narrow floor slices use numbered keys rather than clipped names or rents. The reviewed screenshots and PDFs preserve exact RSF.
U4 Polish & platform fit: 3/3: A coherent standalone product in both themes. The Ascendix palette, restrained glass surfaces, pressed Prospect-safe control, selection treatments and clearly identified sample buildings feel deliberate.
U5 Mobile & print visual quality: 3/3: The 390 px product bar fits one row; floor cards remain readable and the expanded brief clears the bar. Actual PDFs have clean tables, intact labels and correct four-section owner/three-section prospect pagination.
UI TOTAL: 19/20

UX SCORE
X1 Persona job coverage: 5/5: The supplied evidence covers all ten jobs: occupancy, rollover, data maintenance, size/date matching, suite inspection, exports, availability distinctions, time travel, gaps and pipeline. Issues is now reachable directly on phones and desktops.
X2 Interaction & IA: 3.5/4: KPI actions, tool panels, floor drill-in and the location brief provide coherent paths. Phone brief Escape behavior worked in live checks. At 1280 px, clicking the center of Deals hits the search input instead, obstructing a primary lens control.
X3 Trust & domain correctness: 3.5/4: Recorded versus capped SF is distinguished, confidential rent is withheld, and the multi-suite worklist aggregation is covered by passing tests. Reviewed prospect-safe screens and PDFs withheld identities, terms, activity details and the owner-broker while retaining marketing asking rents. The round-20 share explanation is incomplete outside Stack/PDF: src/components/building/BuildingView.tsx:286, src/components/timeline/TimelineView.tsx:169 and src/components/map/MapView.tsx:334.
X4 Accessibility of interaction: 2.5/3: Named controls, roving navigation and focus restoration are extensively implemented. Live testing found that End on Floor 1's plate targets the noninteractive lobby, leaving every selectable suite at tabindex="-1"; the plate then has no Tab entry point.
X5 CRM workflows & differentiation: 4/4: Deal prospects, inquiry matching, renewal activity, record actions, change history and actionable data issues support real broker workflows. These directly address the differentiation opportunities in docs/COMPETITORS.md §4–§7. Intended record-action toast stubs incur no deduction.
UX TOTAL: 18.5/20

ENGINEERING (informational): 9/10: All 884 tests across 63 files passed using a scratch configuration with caches outside the repository. Pure domain modules, centralized prospect-safe policy, URL state, shared segment facts and the host adapter provide strong foundations. The remaining defects expose gaps in browser-level coverage: toolbar hit targets at intermediate widths, keyboard traversal around decorative slices, and consistent legend explanations across renderers. No build was run and no repository files were changed.

TOP UI FIXES (ranked by points gained per effort, max 5):
1. In src/components/shell/shell.css:174, increase the desktop search/tools wrapping basis from 440 px to approximately 600 px, accommodating the 128 px search minimum, tool buttons and gaps. Prevent the tools group from shrinking. At 1280 px the entire group should wrap below the view/lens controls instead of overflowing backward over Deals. Expected UI gain: +0.5 U1.
2. Pass the existing sharesNote output to Building, Timeline and Map legends, including their collapsed phone variants. Combine it with rampNote; preserve the lobby's separate non-leasable entry. Expected UI gain: +0.5 U2.

TOP UX FIXES (ranked by points gained per effort, max 5):
1. In src/components/floor/FloorPlate.tsx, derive keyboard traversal and the roving tab stop from interactive suites only. Exclude the lobby from Arrow, Home and End destinations; End on Floor 1 must focus A10 and retain exactly one selectable tabindex="0". Expected UX gain: +0.5 X4.
2. Correct the toolbar wrapping described above. Verify that pointer hit testing at the center of every lens reaches that lens at 1180, 1280 and 1320 px, with Prospect-safe both off and on. Expected UX gain: +0.5 X2.
3. Reuse sharesNote in every view so users can reconcile 245,900 recorded SF against 245,400 leasable SF and understand the displayed 100.4% total. Identify Floor 7 only outside prospect-safe mode. Expected UX gain: +0.5 X3.

BUGS (with file:line):
- src/components/shell/shell.css:174 and src/components/shell/shell.css:178: At 1280 px, the search/tools container accepts less width than its children require. The search input overflows left across Deals; live hit testing at the Deals button's center returns INPUT.
- src/components/floor/FloorPlate.tsx:382, src/components/floor/FloorPlate.tsx:413 and src/components/floor/FloorPlate.tsx:454: Keyboard indexing includes the nonfocusable lobby. Reproduce with ?view=floor&floor=F1, focus a suite and press End. Focus stays on the previous suite while all four selectable suites become tabindex="-1".
- src/components/building/BuildingView.tsx:286, src/components/timeline/TimelineView.tsx:169 and src/components/map/MapView.tsx:334: These legends omit sharesNote. Building retains only the older over-allocation sentence; Timeline and Map omit both the recorded-area reconciliation and independent-rounding explanation.
