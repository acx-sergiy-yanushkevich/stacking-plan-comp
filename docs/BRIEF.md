# Stax: brief and scoring rubric

## What it is

A stacking plan draws a building floor by floor. Each floor is split into suites, and each suite's width is proportional to its square footage. A suite is leased, available, committed, or unaccounted for. In AscendixRE (xRE), a Salesforce CRM for commercial real estate brokers, the plan is a tab on the Property record.

The prototype is React, TypeScript and Vite with mock data shaped like the xRE objects.

**Scenario (from round 9): a standalone web app.** The stacking plan is judged as its own product that reads xRE data, not as a component on a Salesforce record page. It uses the glass skin (frosted panels over a gradient backdrop, light and dark, with its own theme switch), and the property name is the page title. Record actions still open the xRE record. The flat Lightning look remains available at `?skin=classic` for the embedded scenario (a later LWC port) and is not what is being scored.

## Who uses it, and for what

From the `cre-personas` skill:

| Persona | The job they need the stacking plan for | Questions it must answer in seconds |
|---|---|---|
| **Landlord rep / leasing agent** | Thursday leasing call with the owner, monthly owner report, renewal sweep at 90 / 180 / 365 days | Where is the vacancy, and what is the largest contiguous block? Who expires in the next 12–24 months? What is the asking rent? What is occupancy? Which deals are working each vacancy? |
| **Marketing / research coordinator** | Owns the plan's data: loads rent rolls, closes leased availabilities, splits floors, exports the plan | What is missing or wrong: a lease with no floor, a vacancy that overlaps a lease, floor SF that doesn't add up? |
| **Tenant rep** | Scouts target buildings for a requirement of N SF | Is there N SF of contiguous space, and on which floors? Direct or sublease? From what date? Which neighbours expire soon? |
| **Investment sales analyst** | Checks the rent roll behind a broker opinion of value (BOV) or an offer | How much SF rolls in each of the next 5 years? Occupancy and WALT? Does one tenant occupy several floors? In-place rents? |

## Top jobs, ranked

1. See leased vs vacant space by floor, with occupancy %.
2. See expirations and near-term rollover risk, measured in months from the as-of date.
3. Trust that the plan is current. Never double-count space; make data problems visible.
4. Find contiguous or available blocks by size, floor and date.
5. Identify any block's tenant, suite, SF and expiration, then open the record.
6. Produce an owner-ready view or export, including a prospect-safe mode that hides tenant names and rents.
7. Tell direct from sublease, available-now from available-later, and committed (signed, not commenced) from vacant.
8. Move the as-of date forward ("time travel") and watch the KPIs recompute.
9. Catch data gaps.
10. See the deal pipeline on each vacancy (tour → proposal → LOI → lease out).

## Domain rules

- Use RSF consistently and label the basis. Always show a rate with its unit (/SF/yr or /SF/mo) and lease type (FSG, MG or NNN).
- Holdover: past expiry with no termination date. Month-to-month (MTM): no expiration date. Each has its own explicit state.
- Availability is not vacancy. An availability can be occupied, with an available-from date in the future.
- Sublease space has its own visual state and an expiration date.
- `Confidential__c` leases never show their rent; prospect-safe mode hides every tenant name, contact and rent.
- Data that does not exist in xRE (lease options, ROFR, notice dates) must not be invented.
- **American English** in everything a user, judge or voter reads (UI text, tooltips, screen-reader labels, exports, README, plan): color, gray, center, labeled, behavior. Ascendix is a US company.

## Scoring rubric

Each judge gives two separate scores, **UI /20** and **UX /20**, plus an informational **Engineering /10**.

**Target: 95/100.** Defined as the combined UI + UX score, averaged across the three judges, of at least **38/40**, with neither UI nor UX averaging below **18.5/20**.

### UI score (/20): how it looks

| # | Criterion | Points |
|---|---|---|
| U1 | **Visual hierarchy and layout.** The eye lands on what matters first. Header, KPIs, controls and plan are clearly ordered. Spacing and alignment are deliberate. Nothing competes with the plan. | 5 |
| U2 | **Color and data encoding.** Restrained palette. Each lens has meaningful, colour-blind-safe colours; patterns, borders and labels carry meaning so colour is never the only cue. The legend is clear. | 5 |
| U3 | **Typography and data density.** Readable type scale, tabular figures, blocks show the right amount of text for their width without crowding or truncating what matters. | 4 |
| U4 | **Polish and platform fit.** Consistent details; hover, selected, dimmed, focused and empty states are clear. Reads as a polished, modern standalone web app with a coherent visual language of its own in light and dark (the glass skin); translucency must never cost legibility. | 3 |
| U5 | **Visual quality on mobile and print.** Phone layout is readable; print/PDF output is presentation-grade. | 3 |

### UX score (/20): how it works

| # | Criterion | Points |
|---|---|---|
| X1 | **Persona job coverage.** Each of the top 10 jobs can be done, and done fast. | 5 |
| X2 | **Interaction and information architecture.** Views, time travel, selection, the inspector, search, the space finder and the renewal worklist are discoverable and coherent, with feedback and empty states. | 4 |
| X3 | **Trust and domain correctness.** RSF, holdover, MTM, sublease, committed and confidential handled correctly. Nothing double-counted. Numbers exact. Data issues surface. Prospect-safe leaks nothing. | 4 |
| X4 | **Accessibility of interaction.** Keyboard paths, focus management, screen-reader labels, motion and contrast in practice. | 3 |
| X5 | **CRM workflows and differentiation.** Uses what only a CRM knows (deals, inquiries, activities, record actions, change history) to beat VTS, CoStar, Yardi and Prophia. | 4 |

### Engineering (/10, informational)

| # | Criterion | Points |
|---|---|---|
| E1 | Correct, tested domain logic | 4 |
| E2 | Component structure and state | 3 |
| E3 | Portability to Salesforce LWC (shadow DOM, styling hooks, Apex data shape) | 3 |
