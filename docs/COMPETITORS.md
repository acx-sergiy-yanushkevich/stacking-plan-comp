# Stacking Plan Competitor Analysis — CRE Software (Nov 2026)

**Purpose.** Input for the AscendixRE Stacking Plan tab rebuild. Covers how each competitor draws, colours, filters, times, exports and edits a stacking plan, what users complain about, and where a Salesforce-native plan can win.

**Method and caveats.** Primary sources were vendor product pages, help centres, release notes, a design case study from a VTS product designer, a Stevenson Systems patent, and review sites (Software Advice, TrustRadius, Gartner, Capterra/G2 snippets). Capterra, G2 and Reddit block automated fetching, so complaints from those sites are quoted only where a search snippet surfaced them. Vendor marketing claims are reported as claims. Anything I could not confirm from a source is marked **(unverified)**. Much of the public documentation for VTS (2017) and Yardi (2018) is old; both products have been updated since, but the vendors publish little detail, so "current" behaviour is partly inferred.

---

## 1. Product-by-product findings

### 1.1 VTS (VTS Lease / VTS Platform)

**Who / price.** Landlord and agency leasing teams; enterprise, quote-based; aggregator sites put the floor near $20k/yr and note pricing "by the square foot" ([RFP.wiki](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/vts-lease), [TrustRadius](https://www.trustradius.com/products/vts/reviews?qs=pros-and-cons)). VTS still lists "Stacking Plans — visualize occupancy and leases floor by floor" under Leasing ([vts.com](https://www.vts.com/)).

**Drawing.** 2D floor rows; suites as blocks. A VTS product designer's case study of the Oct 2021–Feb 2022 rebuild says the hardest problem was "supporting many building types" and that the solution was "percentages and min/max width logic, applied both in-platform and on export" — i.e. proportional widths with a minimum readable block ([Clark Cushman case study](https://www.clarkcushman.cc/stacking-plans)). The 2017 release added "a tooltip that shows key info on small spaces without expanding them", "better space layout", "vibrant colors", "visual indication of available spaces" and "a new options symbol" ([VTS blog, May 2017](https://www.vts.com/blog/welcome-to-the-improved-stacking-plan-on-vts)).

**Lenses.** Expiration lens ("forecasts the RSF and number of leases expiring in the next 8+ years") and Deal Stage lens ("turns the stack into a dynamic leasing activity report"). Each lens has its own legend; expanded blocks show Unit, size, in-place lease, in-place total rent, LXD, and a Details row with deal count, committed leases, executed deals, option type ([VTS blog, 2017](https://www.vts.com/blog/welcome-to-the-improved-stacking-plan-on-vts)). Site plans with "merchandising mix and occupancy cost" lenses were announced for retail (same source).

**Time controls.** No as-of date or slider is documented. Future state is shown as a "Committed Badge" on a vacant space that has a signed-but-not-commenced lease; the space stays drawn as vacant "reflecting physical occupancy" (same source).

**KPIs.** Expiring RSF and lease count by year (via lens). Rounded numbers are a complaint: "the numbers are all rounded, which is not useful" — exact vacant area required adding suites manually (asset manager, Jul 2018, [Software Advice](https://www.softwareadvice.com/property/vts-profile/reviews/)).

**Side panel.** "Review space info, leases, deals, budgets, and options without having to leave the stacking plan" ([VTS blog](https://www.vts.com/blog/welcome-to-the-improved-stacking-plan-on-vts)).

**Search.** By unit name, committed lease name, executed deal name (same source). Contiguous-block finder: **(unverified / not found)**.

**Exports.** Exports exist and were a redesign driver: "100% increase in exports since launch"; users had been "building their own internally using Excel" because the feature "lacked product investment for several years" ([Clark Cushman](https://www.clarkcushman.cc/stacking-plans)). Format is not documented publicly; Excel exports generally draw complaints — "The actual excel product can be difficult to edit to a presentable material" (Oct 2018, [Software Advice](https://www.softwareadvice.com/property/vts-profile/reviews/)); "Excel export polish draw recurring complaints" ([RFP.wiki](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/vts-lease)). Confidential/owner mode: **(unverified)**.

**Editing from plan.** Not documented; reviewers want "more control over adjusting stacking plans" (Jun 2019, Software Advice).

**Mobile.** Strong: "being able to look up a stacking chart or a lease option immediately is key for me" ([TrustRadius](https://www.trustradius.com/products/vts/reviews?qs=pros-and-cons)); "Stacking plans are also very helpful when walking buildings (through the App)" (Jun 2019, Software Advice).

**Complaints.** Data-sync accuracy ("stacking plans and spaces available / not available aren't accurate even if I send our stacking plans and updates to support"; "inconsistencies (suite #, SF, etc) when a lease is executed in the deal tracking section, as compared to the spaces and stacking plan section" — [Gartner reviews](https://ls.dmbx.aws.gartner.com/reviews/154799/vts)); "Lag time when you make changes and it takes a while to show up" (Oct 2018); "improvements to the stacking plan feature and how it interfaces in multi-building parks" ([Capterra](https://www.capterra.com/p/154799/VTS/reviews/)); vacant/available state changes "less intuitive" ([RFP.wiki](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/vts-lease)).

### 1.2 Prophia

**Who / price.** Owners and asset managers (RXR, Nuveen, Spear Street); stacking plan included in the "Essentials" tier for property-level users; pricing not public ([prophia.com/essentials](https://prophia.com/essentials), [prophia.com/stacking-plan](https://www.prophia.com/stacking-plan)).

**Drawing / colour.** 2D; "color-coded stacking plan makes it easy to identify leases by expiration year"; vacancy has its own colour ([stacking-plan page](https://www.prophia.com/stacking-plan), [blog, Jul 2024](https://www.prophia.com/blog/dynamic-stacking-plan-better-leasing)). Proportional widths: **(unverified)**.

**Time controls.** A "date dropdown menu" switches the plan to future months, and the KPIs re-compute for that month: "projected WALT, average in-place rent, and occupied square footage for upcoming months" ([blog](https://www.prophia.com/blog/dynamic-stacking-plan-better-leasing)). The KB lists "View future stacking plans — see upcoming changes to occupancy, suites, or floor layouts from planned leases, renewals, or move-outs" ([Prophia KB](https://support.prophia.com/kb/guide/en/customizing-the-stacking-plan-BcEnwQiJVH/Steps/3432646)). It is a dropdown, not a slider (the "time slider" description in our brief is **unverified**).

**KPIs.** Rentable SF, vacant SF, SF by lease type (NNN / MG / gross), occupancy and vacancy totals and %, WALT, average in-place rent ([stacking-plan page](https://www.prophia.com/stacking-plan)).

**Side panel / click.** "Expand on each space to view specific details about encumbrances"; encumbrance count per space; subtenancy; "each data point… is linked back to the source document" (same page). Data is populated by AI lease abstraction rather than typed.

**Editing.** KB: "Adjust suites or floors", "Edit suites — update or delete suites, or change floor square footage" ([KB](https://support.prophia.com/kb/guide/en/customizing-the-stacking-plan-BcEnwQiJVH/Steps/3432646)). No drag-resize documented.

**Exports.** Not documented and a complaint: "the stacking plan is not quite usable" / asked for "export to Excel" ([G2 snippet](https://www.g2.com/products/prophia)); "stacking plan is not printable" ([GetApp snippet](https://www.getapp.co.nz/software/2053405/prophia)); TrustRadius notes "a common concern among reviewers is the usability of the stacking plan feature" ([TrustRadius](https://www.trustradius.com/products/prophia/reviews)).

**Filtering, mobile, 3D.** Not documented **(unverified)**.

### 1.3 Yardi (Voyager Commercial / Deal Manager / CommercialEdge Floorplan Manager)

**Who / price.** Owner-operators on Voyager plus their internal and external brokers; Deal Manager is sold as part of Yardi Elevate / CommercialEdge; pricing not public ([Yardi Deal Manager](https://www.yardi.com/me/product/deal-manager/)).

**Drawing.** 2D "two-dimensional visual representation of a building" ([Yardi blog, Mar 2018](https://www.yardi.com/blog/building-dimensions)). Floorplan Manager (Dec 2023) lets clients "draw unit boundaries", reuse AutoCAD drawings, and "create floor and stacking plans with real-time lease metrics and instant area calculations" ([Mann Report](https://www.mannpublications.com/mannreport/2023/12/18/yardi-launches-floorplan-manager-to-optimize-space-management/)).

**Lenses.** The richest documented set: "overlay configurable performance measures" — expirations in specific years, rent per area, encumbrances, options, proposals, unit types, and retail tenant performance (sales per area, YoY sales variance, foot traffic) ([Yardi blog](https://www.yardi.com/blog/building-dimensions)). Floorplan Manager: "color-code spaces by lease metrics" ([Mann Report](https://www.mannpublications.com/mannreport/2023/12/18/yardi-launches-floorplan-manager-to-optimize-space-management/)). CommercialEdge says the plan "utilizes color coding to indicate when leases will expire" ([CommercialEdge blog](https://commercialedge.com/blog/commercial-real-estate-stacking-plans)).

**Time controls.** Not documented **(unverified)**.

**Side panel / click.** Expiration dates and notice history; outstanding proposals on vacant units; open lease abstract; lease start/end, rent per area, rent steps, options ([Yardi blog](https://www.yardi.com/blog/building-dimensions)).

**Editing / actions from plan.** Unique: "initiate the proposal process for renewals, relocations, expansions" directly from the plan when integrated with CRM/accounting (same source). Encumbered spaces "block brokers from creating new deals on that space" ([Yardi blog, Apr 2026](https://www.yardi.com/blog/?p=53525)).

**Exports.** "Interactive, printable stacking plans"; plans "can be printed and include detailed tenant profiles" ([Deal Manager](https://www.yardi.com/me/product/deal-manager/), [Yardi blog 2026](https://www.yardi.com/blog/?p=53525)). Formats beyond print: **(unverified)**.

**Privacy mode.** Unique and important: agents "can show prospective tenants a version that hides sensitive information and protects existing tenants' privacy while still showing available and occupied units" ([Yardi blog](https://www.yardi.com/blog/building-dimensions)).

**Mobile.** "Take the stacking plan into the field and view it on a mobile device"; Deal Manager app "view property stacking plans" ([Yardi blog](https://www.yardi.com/blog/building-dimensions), [Deal Manager](https://www.yardi.com/me/product/deal-manager/)).

**Complaints.** No stacking-plan-specific reviews found **(unverified)**; general Yardi complaints are about configuration complexity and cost.

### 1.4 CoStar (CoStar Suite / LoopNet)

**Who / price.** Market-data subscribers; quote-based; one 2026 review estimates $350–$1,400/mo by geography and warns of auto-renewal and "export limits — downloads to Excel are capped" ([RealEstateSkills](https://www.realestateskills.com/blog/costar-reviews)).

**Drawing / colour.** Research-derived plan of *other people's buildings*; "Available Space is highlighted in gold"; navigation via "the slide bar located on the 'mini' stack" (a thumbnail minimap for tall towers) ([CoStar help](https://product.costar.com/LeaseComps/Help/en-US/Stacking_Plan.htm)). Blocks show tenant, lease expiration and "who represents them" ([RealEstateSkills](https://www.realestateskills.com/blog/costar-reviews)). CoStar markets "floor plans, stacking plans and more" to tenant-side users ([CoStar blog](https://costarmanager.com/blog/find-commercial-real-estate-for-lease-better-with-costar)).

**Lenses, time, KPIs, side panel, editing, exports.** Not documented; the plan is read-only market intelligence, not an operating tool **(unverified)**. Data freshness is a known gripe ("occasional data inconsistencies") and the interface is "slow, prone to crashes… outdated" ([RealEstateSkills](https://www.realestateskills.com/blog/costar-reviews)). LoopNet has no stacking plan of its own **(unverified; none found)**.

### 1.5 Buildout (Buildout Marketing, Rethink CRM, Apto CRM)

**Who / price.** Brokerages; Buildout Showcase listed at ~$199/broker/mo plus platform fee ([CRE Software review](https://cresoftware.tech/products/sharplaunch/)); Rethink and Apto are both Salesforce-platform CRMs now owned by Buildout.

**Apto.** "Automatically generate stacking plans" from Space records on Office and Multifamily properties; Floor and Suite fields drive placement; "color coded by time until lease expiration"; hover "shows a small highlight with more information" ([Apto help, Feb 2024](https://apto.help.buildout.com/en/articles/8038587-using-stacking-plans)). Proportional widths, export, editing: **(unverified)**.

**Rethink.** Stacking plan built from Space/Unit records; displayed fields are configured via Salesforce Field Sets on the Space/Unit object; Winter 2019 added "add a space, create a deal, and toggle between a group of floors"; Summer 2022 "Improved Look of Stacking Plan & Stacking Plan PDF" ([Rethink help: customizing](https://rethink.help.buildout.com/en/articles/7920140-customizing-stacking-plan), [Winter 2019](https://rethink.help.buildout.com/en/articles/7920207-rethink-winter-2019-release-notes), [Summer 2022](https://rethink.help.buildout.com/en/articles/7920204-rethink-summer-2022-release-notes-v3-19)). Buildout's CRM tour lists "stacking plans" as a core feature ([buildout.com/tour/crm](https://www.buildout.com/tour/crm)). This is our closest like-for-like competitor (Salesforce-native, broker-facing).

**Buildout Marketing / OMs.** No stacking-plan page type found in the document editor help; "stacking" hits refer to layer order ([help.buildout.com search](https://help.buildout.com/en/?q=stacking+plan)). OMs are assembled from page templates ([Buildout blog](https://www.buildout.com/blog-posts/create-oms-that-close-deals)). Rendering a live stacking plan into an OM: **(unverified; not found)** — brokers appear to paste images.

### 1.6 MRI Software / RealPage

**MRI Commercial Management.** Product page mentions no stacking plan, visual occupancy or floor view ([MRI](https://www.mrisoftware.com/products/commercial-management/)); a site search returns only a functional-spec page. A 2026 listicle ranks MRI #2 for "repeatable stacking plan scenarios" ([ZipDo](https://zipdo.co/best/stacking-plan-software/)) — low-trust SEO content **(unverified)**. Treat MRI as having no broker-facing stacking plan unless proven otherwise.

**RealPage Commercial.** Product page lists lease admin, accounting, reporting; no stacking plan ([RealPage](https://www.realpage.com/commercial/)). RealPage acquired Hipercept/FUEL in 2019 ([RealPage](https://realpage.com/news/realpage-to-acquire-hipercept)); FUEL's "Tenancy" widget is the best-documented *time-projected* stacking plan I found: each floor is a row, "tenant bars are sized by suite area", settings include **Number of years** (scroll bar at the bottom), **Start date** ("shows each floor as it stood in January 2019"), **Select Columns / Summary** toggle, **Size to text** (text in small blocks vs. an index number with an expand arrow), and **Include Future Commencements** ([Fuel help](https://help.fuelcre.com/hc/en-us/articles/360045224371-Creating-a-Stacking-Plan)). Aimed at valuation/asset-management analysts, not brokers.

### 1.7 Lease-administration tools (Leasecake, Occupier, Lease Harbor, Visual Lease, Re-Leased, Kato)

- **Leasecake** — homepage mentions portfolio/location views and AI "Cakebot" abstraction, not stacking plans ([leasecake.com](https://leasecake.com/), [Newswire](https://www.newswire.com/news/leasecake-advances-ai-capabilities-with-new-release-of-cakebot-for-22272161)). Aggregator claims of "dynamic, real-time stacking plans" **(unverified)**.
- **Occupier** — tenant-side; "Critical Dates" dashboard with countdowns and "Sync to Calendar"; no stacking plan ([occupier.com](https://www.occupier.com/)).
- **Visual Lease**, **Lease Harbor** — enterprise lease accounting; no stacking plan found ([visuallease.com](https://visuallease.com/), [RFP.wiki](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/lease-harbor)) **(unverified)**.
- **Re-Leased** (ANZ/UK PM) — Stacking Plan tab is a "Pro package" feature; article is login-gated ([Re-Leased help](https://help.re-leased.com/hc/en-au/articles/30829881540500-Stacking-Plan)).
- **Kato** (UK agency CRM) — users filed a request for "sub-lettings and break options in the properties stacking plan" ([Kato Featurebase](https://kato.featurebase.app/p/sub-lettings-and-break-options-in-the-properties-stacking-plan)), i.e. sublease and break-option visibility is a recognised gap.

### 1.8 Investment-side (Argus, Dealpath, Juniper Square, Dottid)

- **ARGUS (Altus).** Jun 2026 Portfolio Manager release adds "Tenant Analytics": "lease expiry concentration — upcoming expiries grouped by tenant", tenant exposure, below-market-rent flags ([Altus release](https://www.altusgroup.com/product-releases/argus-portfolio-manager-jun26/)). No stacking plan. Rollover charts in practice come from Excel models: "a tenant rollover schedule, a graph illustrating cumulative expiration of net rentable area by year, and a column chart" ([A.CRE](https://www.adventuresincre.com/all-in-one-walkthrough-8-tenancy-analysis/)).
- **Dealpath.** Pipeline/IC visualisation (2019) and AI extraction from rent rolls; no lease-expiration chart or stacking plan documented ([Dealpath blog](https://www.dealpath.com/blog/new-release-data-visualization-for-pipeline-insights-ic-meeting-management/)) **(unverified)**.
- **Juniper Square.** Lease roll is fed from third-party abstraction exports (Lextract) — no native stacking plan ([Lextract](https://lextract.io/integrations/juniper-square)) **(unverified)**.
- **Dottid** (owner leasing platform). Suite selector shows vacancy status and "time remaining to lease expiration" in colour-coded pills that "match the rent roll and stacking plan"; tracks holdovers (month-to-month) on the suite card; Excel export with Group-By tabs ([Dottid, Dec 2023](https://dottid.squarespace.com/dev-updates/2023/holdover-exports)).

### 1.9 Standalone tools and templates

- **StackPlanner.io** (Springbord, launched 11 Dec 2025, from $99/mo billed annually). Claims: colour-coded occupancy and expiries, "time-based views for future and historical analysis", "expiration heat maps", branded templates, "embeddable live widgets", one-click PDF export, Yardi/MRI API sync ([stackplanner.io](https://stackplanner.io/), [features](https://stackplanner.io/features-of-real-estate-stacking-plan-software/), [Bisnow](https://www.bisnow.com/biswire/springbord-2025-12-10-132269)). Vendor claims only; no independent reviews yet.
- **Savills Stacker** (free iOS/iPad, v3.5.3 Nov 2025). "View, edit, and export stacking plans in real time from a mobile device"; portrait export; comps and market panels ([App Store](https://apps.apple.com/us/app/id1516444309)). Shows a top-5 brokerage considered a mobile stack worth building in-house.
- **Cloud Stacking Plan** (Precision Business Technology). The most configurable legacy tool: ~20 optional data elements per block; colour schemes **Standard, Red-Green-Blue, Blues, Black & White, Vacant, Suite Category**; "show only vacant suites"; hide legend / SF% / floor summary; sort suites by Suite, Sqft, Lease Exp or Name; per-cell formatting; print to PDF/BMP/HTML with a print cart ([formatting](https://m1sys.screenstepslive.com/s/13612/m/50928/l/477254-formatting-editing-a-stacking-plan), [printing](https://m1sys.screenstepslive.com/s/13612/m/50928/l/470954-printing-the-stacking-plan)).
- **WorkSpace** (Property & Facility) — "Export Portrait / Export Landscape" to PDF ([WorkSpace help](https://workspace.helpjuice.com/properties/exporting-a-stacking-plan)).
- **Stevenson Systems patent** (CA2964355C). Boxes "sized in proportion to its area"; drag boxes within/between floors; reorder floors; zoom/pan "similar to online mapping tools"; colour by *any* attribute (industry, expiry year) with per-value swatches; legend showing SF and % per value; a box is split into two colour segments when user-entered and certified areas disagree; click opens a card with tenant, suite, floor plan, documents ([Google Patents](https://patents.google.com/patent/CA2964355C/en)).
- **Excel/PowerPoint.** Paid templates at $12 ([eFinancialModels](https://www.efinancialmodels.com/downloads/stacking-plan-excel-template-233100/), [Eloquens](https://www.eloquens.com/tool/93q1fR2e/finance/real-estate/stacking-plan)); the standard DIY recipe is a pivot table feeding a *stacked bar* (true SF widths) or *100% stacked bar* (every floor full width) chart, which needs manual refresh, one file per building, and macros that corporate email strips ([RealClear](https://realclear.software/make-a-building-stacking-plan-with-excel/)). Pasted charts in PowerPoint become static images.
- **3D / marketing.** Planpoint (residential sales, 360° + 3D), Springbord services ("2D and 3D stacking plan renderings") ([GetApp Planpoint](https://www.getapp.com.au/software/2104588/planpoint), [Springbord](https://springbord.com/services-we-offer/real-estate-marketing-services/stacking-plan.html)). No CRE operating tool uses 3D for the working plan.

### 1.10 2025–2026 newcomers / AI

- **AI "skills"** rather than apps: A.CRE "Stacking Plan Builder" generates *text-based* stacks from a rent roll with occupancy/rollover metrics, "contiguous availability — the most valuable insight for leasing", tenant concentration and a "prospect pipeline overlay" ([A.CRE Intelligence](https://intelligence.adventuresincre.com/skills/stacking-plan-builder)); MetaProp publishes a similar skill ([MetaProp](https://skills.metaproplabs.com/asset-management/asset-performance-reporting/stacking-plan-builder)).
- An Jul 2026 practitioner guide describes the emerging pattern — AI parses the rent roll, colours by expiry year, computes % RSF and % rent expiring per year, flags "contiguity for expiring suites that could be combined into a larger block", and models "the cost of holding a suite vacant to assemble a full-floor block", while warning "a stacking plan is a decision tool, not a legal record" ([AI Consulting Network](https://www.theaiconsultingnetwork.com/blog/ai-stacking-plans-office-leasing-rollover-2026)).
- **VTS AI** (abstraction, Asset Intelligence, Proposal AI) feeds the plan but no new plan UI is documented ([vts.com](https://www.vts.com/)). **Floorwire** "Managed Central" claims overlays, 3D views and branded templates ([Floorwire, Nov 2023](https://floorwire.com/blog/commercial-real-estate-goodbye-to-excel-with-dynamic-stacking-plans)) **(unverified)**. No funded 2025–26 startup with a stacking plan as its core UI was found.

### 1.11 Baseline: current AscendixRE plan

Skeleton from "Floors number and an Average Floor Size"; leases and availabilities added as records; "By default, all available space is in yellow", leases colour-coded by expiration with a legend "under the LDX title"; shows SF, expiration, tenant, occupancy/vacancy %; "move the date forward or back to see how tenants and vacancies change over time"; Excel or PDF export; Enterprise tier at no extra cost ([Ascendix blog](https://ascendix.com/blog/stacking-plan-software/), [help](https://help.ascendix.com/1160683-ascendixre-stacking-plan-overview)). Not documented: lenses beyond expiry, deal-stage, side panel, search, contiguous finder, privacy mode.

---

## 2. Feature matrix

✓ documented · ◐ partial / claimed by vendor · ✗ not present / not found · ? unverified

| Feature | VTS | Prophia | Yardi DM | CoStar | Rethink/Apto | FUEL (RealPage) | StackPlanner | Cloud Stacking Plan | Excel DIY | AscendixRE today |
|---|---|---|---|---|---|---|---|---|---|---|
| Proportional block widths | ✓ (min/max) | ? | ? | ? | ? | ✓ | ? | ◐ (width factor) | ✓ | ✓ |
| Min readable block / tooltip for tiny suites | ✓ | ✗ | ? | ✗ | ✗ | ✓ (index # + expand) | ? | ✗ | ✗ | ✗ |
| Expiration-year colour lens | ✓ | ✓ | ✓ | ◐ | ✓ | ? | ◐ | ✓ | ✗ | ✓ |
| Deal-stage / pipeline lens | ✓ | ✗ | ◐ (proposals) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Rent / $PSF lens | ◐ (in block) | ◐ (KPI) | ✓ | ✗ | ✗ | ✗ | ✗ | ◐ (field) | ✗ | ✗ |
| Tenant industry / category lens | ✗ | ✗ | ◐ (unit type) | ✗ | ✗ | ✗ | ✗ | ✓ (Suite Category) | ✗ | ✗ |
| Colour by any field, user palette | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ◐ (6 schemes) | ✗ | ✗ |
| As-of date / future view | ◐ (committed badge) | ✓ (month dropdown) | ? | ✗ | ✗ | ✓ (start date + years bar) | ◐ | ✗ | ✗ | ✓ |
| KPIs on plan (occupancy, WALT, in-place rent) | ◐ | ✓ | ◐ | ✗ | ✗ | ◐ (summary cols) | ◐ | ◐ (floor summary) | ✗ | ◐ |
| Rollover-by-year chart next to plan | ✓ (lens legend) | ✗ | ? | ✗ | ✗ | ✗ | ◐ | ✗ | ✓ | ✗ |
| Contiguous-block finder | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Search by suite / tenant / deal | ✓ | ? | ? | ✗ | ✗ | ✗ | ? | ◐ (sort) | ✗ | ✗ |
| Side panel (lease, deal, options, budget) | ✓ | ✓ (encumbrances, source doc) | ✓ | ✗ | ◐ (hover) | ◐ | ? | ✓ (suite detail) | ✗ | ◐ |
| Start deal / proposal from plan | ✗ | ✗ | ✓ | ✗ | ✓ (create deal) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create availability from plan | ? | ◐ (edit suites) | ? | ✗ | ✓ (add space) | ✗ | ? | ✓ | ✗ | ✓ |
| Drag-resize / move suites | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Encumbrances / options / subtenancy shown | ✓ (options icon) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ◐ (lease option) | ✗ | ✗ |
| Prospect-safe / confidential mode | ? | ✗ | ✓ | n/a | ✗ | ✗ | ✗ | ◐ (hide fields, vacant only) | ✗ | ✗ |
| PDF export | ✓ | ✗ (complaint) | ✓ (print) | ✗ | ✓ | ? | ✓ | ✓ | ✓ | ✓ |
| Excel export | ◐ (poor) | ✗ (requested) | ? | ◐ (capped) | ✗ | ? | ✗ | ✗ | n/a | ✓ |
| PNG / PowerPoint-ready export | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ (embed) | ✓ (BMP) | ◐ | ✗ |
| Branded / embeddable plan | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ◐ (logo, image) | ✗ | ✗ |
| Multi-building / campus view | ✗ (complaint) | ◐ (portfolio) | ◐ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ |
| Mobile | ✓ | ? | ✓ | ✗ | ◐ (SF mobile) | ✗ | ? | ✗ | ✗ | ◐ |

---

## 3. Best-in-class per feature

- **Lenses:** Yardi — the widest documented overlay set (expirations by year, rent/area, encumbrances, options, proposals, unit type, retail sales/foot traffic) ([Yardi](https://www.yardi.com/blog/building-dimensions)). VTS is second with the only true **deal-stage lens** ([VTS](https://www.vts.com/blog/welcome-to-the-improved-stacking-plan-on-vts)).
- **Time control:** FUEL — explicit start date plus a years scroll bar and an "Include Future Commencements" switch ([Fuel](https://help.fuelcre.com/hc/en-us/articles/360045224371-Creating-a-Stacking-Plan)); Prophia is best at recomputing KPIs (WALT, in-place rent, occupied SF) for the selected future month ([Prophia](https://www.prophia.com/blog/dynamic-stacking-plan-better-leasing)).
- **Data provenance:** Prophia — every block value links back to the abstracted source document ([Prophia](https://www.prophia.com/stacking-plan)).
- **Actions from the plan:** Yardi — start renewal/relocation/expansion proposals from a suite; encumbered suites block new deals ([Yardi 2026](https://www.yardi.com/blog/?p=53525)). Rethink — "add a space, create a deal" from the plan ([Rethink](https://rethink.help.buildout.com/en/articles/7920207-rethink-winter-2019-release-notes)).
- **Prospect-safe view:** Yardi alone documents a mode that hides tenant-sensitive data while still showing occupied vs. available ([Yardi](https://www.yardi.com/blog/building-dimensions)).
- **Small-suite legibility:** VTS (tooltip + min/max width) and FUEL ("Size to text" vs. index number) ([Clark Cushman](https://www.clarkcushman.cc/stacking-plans), [Fuel](https://help.fuelcre.com/hc/en-us/articles/360045224371-Creating-a-Stacking-Plan)).
- **Tall-building navigation:** CoStar's minimap "slide bar on the mini stack" ([CoStar](https://product.costar.com/LeaseComps/Help/en-US/Stacking_Plan.htm)).
- **Print/formatting control:** Cloud Stacking Plan — field pick-list, six colour schemes, vacant-only, sort orders, paper sizes ([PBT](https://m1sys.screenstepslive.com/s/13612/m/50928/l/477254-formatting-editing-a-stacking-plan)).
- **Colour-by-anything + legend with SF/%:** Stevenson patent design ([patent](https://patents.google.com/patent/CA2964355C/en)).
- **Mobile:** VTS and Yardi apps; Savills built its own ([TrustRadius](https://www.trustradius.com/products/vts/reviews?qs=pros-and-cons), [Savills Stacker](https://apps.apple.com/us/app/id1516444309)).
- **Sharing / embedding:** StackPlanner's embeddable live widget and branded templates (claimed) ([StackPlanner](https://stackplanner.io/features-of-real-estate-stacking-plan-software/)).

## 4. Gaps nobody fills

1. **Contiguous-block finder.** No product documents "show me 25–40k SF contiguous, available within 18 months". A.CRE's AI skill calls contiguity "the most valuable insight for leasing" ([A.CRE](https://intelligence.adventuresincre.com/skills/stacking-plan-builder)); the 2026 guide wants flags for "expiring suites that could be combined into a larger block" ([AI Consulting Network](https://www.theaiconsultingnetwork.com/blog/ai-stacking-plans-office-leasing-rollover-2026)).
2. **Exact numbers.** VTS rounds ("numbers are all rounded, which is not useful") ([Software Advice](https://www.softwareadvice.com/property/vts-profile/reviews/)). Brokers need exact RSF in-block and on export.
3. **Presentable exports.** VTS Excel "difficult to edit to a presentable material"; Prophia "not printable", "export to Excel" requested; CoStar caps Excel downloads ([Software Advice](https://www.softwareadvice.com/property/vts-profile/reviews/), [G2](https://www.g2.com/products/prophia), [RealEstateSkills](https://www.realestateskills.com/blog/costar-reviews)). Nobody offers a PowerPoint-native or high-res PNG export sized for an OM page.
4. **Multi-building parks / campuses.** Explicit VTS complaint ([Capterra](https://www.capterra.com/p/154799/VTS/reviews/)); no vendor shows several buildings side by side with shared KPIs.
5. **Subleases, break options, holdovers on the plan.** Kato request ([Kato](https://kato.featurebase.app/p/sub-lettings-and-break-options-in-the-properties-stacking-plan)); only Prophia (subtenancy) and Dottid (holdover) touch this.
6. **Future state that is honest.** VTS keeps a committed space drawn as vacant with a badge; Excel makes "a lease expiring in 18 months look identical to one expiring in 60 months" ([StackPlanner blog](https://stackplanner.io/blog/why-making-stacking-plans-in-excel-is-a-time-waster-for-cre-teams/)). Nobody shows *both* physical occupancy and committed/pipeline occupancy at once.
7. **Trust / staleness.** "stacking plans… aren't accurate even if I send… updates to support"; "lag time when you make changes" ([Gartner](https://ls.dmbx.aws.gartner.com/reviews/154799/vts), [Software Advice](https://www.softwareadvice.com/property/vts-profile/reviews/)). No product shows "last verified" per suite or flags data conflicts (the Stevenson patent's split-block idea is the only precedent).
8. **Editing on the canvas.** Drag-to-resize/move and split/merge suites appear only in a patent, never in a shipped CRE tool.
9. **Tenant-rep and investment-sales views.** Every tool is landlord-centric; none offers a rep's "my client's options in this building" or an analyst's rollover-by-year with WALT overlay in the same screen.

## 5. What a CRM-native stacking plan can do that none of them can

Because the AscendixRE plan sits on Salesforce **Properties, Spaces/Availabilities, Leases, Deals, Inquiries, Contacts, Activities and Listings**:

- **Deal-stage lens with real pipeline** — colour suites by Deal stage and show the *prospect* name, broker and last activity in the side panel; VTS has the lens but not the broker's own Inquiry/Contact graph.
- **"Who is looking for this block?"** — match an available or expiring suite against open Inquiries (size, timing, use) and surface matches on hover; no competitor has demand-side records.
- **Activity recency per suite** — last call/email/tour on the tenant Contact or Deal shown as a dot/age on the block; drives renewal outreach ranking the 2026 AI guide describes.
- **One-click actions that create real records** — New Deal, New Availability, Log Call, Schedule Tour, Create Listing from a suite, with the record pre-filled; Yardi only starts a proposal, Rethink only a deal.
- **Listing status lens** — show which availabilities are published (Listing object) vs. quiet; feed the Buildout/marketing sync that brokers already run nightly.
- **Tenant-rep mode** — filter the plan to Contacts/Accounts the user represents, hide landlord-only fields; nobody offers a rep-side view.
- **Salesforce reports/dashboards** — rollover-by-year, WALT and expiring RSF become standard report types and dashboard widgets; exports inherit Salesforce sharing rules (a natural confidential mode).
- **Field-level security as privacy mode** — a prospect-safe export becomes a profile/permission set, not a special screen, beating Yardi's single hidden view.
- **Mobile for free** — Salesforce Mobile / LWC gives a responsive plan without a separate app (Savills built one; VTS and Yardi maintain theirs).
- **Audit trail** — Field History on Lease/Availability answers the "is this current?" complaint with "updated by X on date" per block.

## 6. Visual design observations

- **Palette.** Expiration is the default lens everywhere (Prophia, Apto, Yardi, VTS, AscendixRE). Common mistakes: (a) rainbow by year — hard to order visually; (b) red/green only for leased/available, which fails for colour-blind users and leaves no room for "committed"; (c) Cloud Stacking Plan's literal "Red-Green-Blue" scheme ([PBT](https://m1sys.screenstepslive.com/s/13612/m/50928/l/477254-formatting-editing-a-stacking-plan)). Better practice: a single sequential ramp for years-to-expiry, a reserved hue for available (yellow in AscendixRE, gold in CoStar), a hatched or outlined treatment for committed/under-negotiation, and grey for unaccounted/common area.
- **Block text density.** Tools cram tenant, suite, SF and LXD into every block; small suites truncate names. VTS solved it with tooltips and min/max widths; FUEL with "Size to text" fallback to an index number; the Stevenson patent with zoom/pan. Truncated names and rounded SF are the two most-cited legibility complaints.
- **Legend.** Best legends carry data: Stevenson's legend lists SF and % per colour value; VTS's expiration legend doubles as an 8-year rollover forecast. Most others are a static key.
- **Layout.** Floors as rows top-down; proportional widths in VTS/FUEL/Excel; CoStar adds a minimap for towers; Cloud Stacking Plan adds a floor-summary column. Multi-building layouts are absent.
- **3D.** Used only in marketing (Planpoint, Springbord renderings). Working tools are 2D; a 3D operating plan would be a gimmick.
- **Side panel vs. modal.** VTS, Prophia and Yardi use a side pane so the plan stays visible; Apto uses hover-only, which users find too thin for leasing work.
- **Export fidelity.** Rethink and WorkSpace render a dedicated PDF layout (portrait/landscape) instead of screenshotting the screen; this is the bar.

## 7. Top 15 recommendations (ranked)

1. **Ship a contiguous-block finder** (size range + available-by date, highlighting stackable floors) — beats every competitor; none has it.
2. **Deal-stage lens wired to real Deals and Inquiries**, with prospect name and last activity in the side panel — beats VTS, whose lens has no demand-side data.
3. **As-of date control that re-computes KPIs (occupancy, WALT, in-place rent, expiring RSF)** and distinguishes physical vs. committed occupancy with a badge/hatch — beats Prophia (dropdown only) and VTS (badge only).
4. **Exact RSF everywhere, never rounded; tooltip + minimum block width for small suites** — fixes VTS's rounding and truncation complaints.
5. **Side panel with lease, options/encumbrances, sublease and holdover flags, deal, activities, documents** — beats Prophia (no deals) and Kato (no subleases).
6. **One-click actions from a suite: New Deal, New Availability, Log Activity, Create Listing, Start Renewal** — beats Yardi (proposal only) and Rethink (deal only).
7. **Prospect-safe mode via permission set, applied to screen and export** — beats Yardi's single hidden view.
8. **Exports: PDF (portrait/landscape), high-res PNG/SVG sized for OM and PowerPoint, Excel with the rent roll on a second tab** — beats VTS (poor Excel) and Prophia (not printable).
9. **Colour-by-any-field lens (industry, broker, rent band, deal stage, listing status) with a legend that shows SF and %** — beats Cloud Stacking Plan's fixed six schemes.
10. **Rollover-by-year bar chart docked to the plan, clickable to highlight those suites** — beats VTS's legend-only forecast and Argus's table.
11. **Multi-building / campus view with shared KPIs and legend** — answers the explicit VTS multi-building complaint.
12. **"Last updated by / on" per suite and a stale-data flag** — answers VTS accuracy complaints; no competitor shows provenance except Prophia's document links.
13. **Search and filter by suite, tenant, broker, deal, size, expiry window; "vacant only" toggle** — matches VTS search and Cloud Stacking Plan's vacant-only, in one place.
14. **Drag to reorder floors, split/merge suites, inline SF edit on the canvas** — only exists in the Stevenson patent; no shipped product.
15. **Responsive LWC for Salesforce Mobile with the same lenses** — matches VTS/Yardi mobile without a separate app, beats Savills' view-only Stacker.

---

## 8. Sources

VTS: [2017 stacking plan post](https://www.vts.com/blog/welcome-to-the-improved-stacking-plan-on-vts) · [Behind the scenes](https://www.vts.com/blog/behind-the-scenes-how-the-vts-stacking-plan-was-rebuilt) · [vts.com](https://www.vts.com/) · [Clark Cushman redesign case study](https://www.clarkcushman.cc/stacking-plans) · [Software Advice reviews](https://www.softwareadvice.com/property/vts-profile/reviews/) · [TrustRadius](https://www.trustradius.com/products/vts/reviews?qs=pros-and-cons) · [Gartner](https://ls.dmbx.aws.gartner.com/reviews/154799/vts) · [Capterra](https://www.capterra.com/p/154799/VTS/reviews/) · [RFP.wiki](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/vts-lease)
Prophia: [stacking plan](https://www.prophia.com/stacking-plan) · [blog Jul 2024](https://www.prophia.com/blog/dynamic-stacking-plan-better-leasing) · [KB](https://support.prophia.com/kb/guide/en/customizing-the-stacking-plan-BcEnwQiJVH/Steps/3432646) · [Essentials](https://prophia.com/essentials) · [G2](https://www.g2.com/products/prophia) · [GetApp](https://www.getapp.co.nz/software/2053405/prophia) · [TrustRadius](https://www.trustradius.com/products/prophia/reviews)
Yardi: [Building Dimensions 2018](https://www.yardi.com/blog/building-dimensions) · [Deal Manager](https://www.yardi.com/me/product/deal-manager/) · [Renewals blog Apr 2026](https://www.yardi.com/blog/?p=53525) · [Floorplan Manager](https://www.mannpublications.com/mannreport/2023/12/18/yardi-launches-floorplan-manager-to-optimize-space-management/) · [CommercialEdge](https://commercialedge.com/blog/commercial-real-estate-stacking-plans)
CoStar: [help page](https://product.costar.com/LeaseComps/Help/en-US/Stacking_Plan.htm) · [RealEstateSkills review](https://www.realestateskills.com/blog/costar-reviews) · [CoStar blog](https://costarmanager.com/blog/find-commercial-real-estate-for-lease-better-with-costar)
Buildout: [Apto help](https://apto.help.buildout.com/en/articles/8038587-using-stacking-plans) · [Rethink customizing](https://rethink.help.buildout.com/en/articles/7920140-customizing-stacking-plan) · [Rethink Winter 2019](https://rethink.help.buildout.com/en/articles/7920207-rethink-winter-2019-release-notes) · [Rethink Summer 2022](https://rethink.help.buildout.com/en/articles/7920204-rethink-summer-2022-release-notes-v3-19) · [CRM tour](https://www.buildout.com/tour/crm) · [OM blog](https://www.buildout.com/blog-posts/create-oms-that-close-deals) · [help search](https://help.buildout.com/en/?q=stacking+plan)
MRI / RealPage: [MRI Commercial](https://www.mrisoftware.com/products/commercial-management/) · [ZipDo](https://zipdo.co/best/stacking-plan-software/) · [RealPage Commercial](https://www.realpage.com/commercial/) · [Fuel help](https://help.fuelcre.com/hc/en-us/articles/360045224371-Creating-a-Stacking-Plan) · [Hipercept acquisition](https://realpage.com/news/realpage-to-acquire-hipercept)
Lease admin: [Leasecake](https://leasecake.com/) · [Cakebot](https://www.newswire.com/news/leasecake-advances-ai-capabilities-with-new-release-of-cakebot-for-22272161) · [Occupier](https://www.occupier.com/) · [Visual Lease](https://visuallease.com/) · [Lease Harbor](https://www.rfp.wiki/specialty-industries/real-estate-property/real-estate-lease-management-software/lease-harbor) · [Re-Leased](https://help.re-leased.com/hc/en-au/articles/30829881540500-Stacking-Plan) · [Kato request](https://kato.featurebase.app/p/sub-lettings-and-break-options-in-the-properties-stacking-plan)
Investment: [Argus Portfolio Manager Jun 2026](https://www.altusgroup.com/product-releases/argus-portfolio-manager-jun26/) · [A.CRE tenancy analysis](https://www.adventuresincre.com/all-in-one-walkthrough-8-tenancy-analysis/) · [Dealpath](https://www.dealpath.com/blog/new-release-data-visualization-for-pipeline-insights-ic-meeting-management/) · [Lextract/Juniper Square](https://lextract.io/integrations/juniper-square) · [Dottid](https://dottid.squarespace.com/dev-updates/2023/holdover-exports)
Standalone: [StackPlanner](https://stackplanner.io/) · [features](https://stackplanner.io/features-of-real-estate-stacking-plan-software/) · [Excel blog](https://stackplanner.io/blog/why-making-stacking-plans-in-excel-is-a-time-waster-for-cre-teams/) · [Bisnow launch](https://www.bisnow.com/biswire/springbord-2025-12-10-132269) · [Savills Stacker](https://apps.apple.com/us/app/id1516444309) · [Cloud Stacking Plan formatting](https://m1sys.screenstepslive.com/s/13612/m/50928/l/477254-formatting-editing-a-stacking-plan) · [printing](https://m1sys.screenstepslive.com/s/13612/m/50928/l/470954-printing-the-stacking-plan) · [WorkSpace](https://workspace.helpjuice.com/properties/exporting-a-stacking-plan) · [realestatestackingplan.com](https://realestatestackingplan.com/) · [Floorwire](https://floorwire.com/blog/commercial-real-estate-goodbye-to-excel-with-dynamic-stacking-plans) · [Stevenson patent](https://patents.google.com/patent/CA2964355C/en) · [eFinancialModels](https://www.efinancialmodels.com/downloads/stacking-plan-excel-template-233100/) · [Eloquens](https://www.eloquens.com/tool/93q1fR2e/finance/real-estate/stacking-plan) · [RealClear Excel](https://realclear.software/make-a-building-stacking-plan-with-excel/) · [Planpoint](https://www.getapp.com.au/software/2104588/planpoint) · [Springbord](https://springbord.com/services-we-offer/real-estate-marketing-services/stacking-plan.html)
AI / 2026: [A.CRE skill](https://intelligence.adventuresincre.com/skills/stacking-plan-builder) · [MetaProp skill](https://skills.metaproplabs.com/asset-management/asset-performance-reporting/stacking-plan-builder) · [AI Consulting Network Jul 2026](https://www.theaiconsultingnetwork.com/blog/ai-stacking-plans-office-leasing-rollover-2026)
AscendixRE: [blog](https://ascendix.com/blog/stacking-plan-software/) · [help](https://help.ascendix.com/1160683-ascendixre-stacking-plan-overview)
Not retrievable (blocked): [CBRE Build "Quest for a Better Stacking Plan"](https://medium.com/cbrebuild/the-quest-for-a-better-stacking-plan-64e276a96146), Reddit r/CommercialRealEstate, Capterra/G2 full review pages.
