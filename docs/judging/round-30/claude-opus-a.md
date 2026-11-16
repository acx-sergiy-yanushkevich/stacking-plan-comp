# Claude Opus A, round 30

**UI 18.5/20 · UX 19/20 · Engineering 9/10 · total 93**

Checks: 1,023 tests, verify, leakcheck (0), a11y, pdfcheck, exportcheck; probes of Back, fit over 4 buildings × 4 lenses × owner/safe at 10 sizes including 1366×650, 1440×790 and 1512×870, 18 search phrasings, KPI names, same-name stops.

- U2 5/5: the Rent bands read apart in dark.
- U3 3/4: names lost where verify does not look: Bluebonnet Pinnacle Staffing (161×55) at 1366×650 shows only "Email 175 d ago" and a lone "!"; Preston Park Bowline (194×43) at 1280×720/800; Legacy Coffee Roasters (131×43) at every desktop size; Maple Avenue Advisors and Frontier Private Bank at 1180×800.
- U4 2.5/3: micro and tiny lines start at a different left edge from the name; the bare "!" glyph in an empty holdover block reads as a fault.
- X2 3.5/4: **Back un-hides Prospect-safe** (`usePlanState.ts:8-9`, `:40`); "largest block", "biggest block", "12 floor" find nothing.
- X3 3.5/4: a size query drops unread words without saying so (`query.ts:201-207`): "15k nnn under $35", "5000 sf by end of year", "12k by 1/6/27".
- X4 3/3: KPI groups named; four same-name stop rows read alike.
- Engineering 9/10: verify covers three non-laptop viewports with a 140×48 exemption; `Block.tsx:325` placement ternary and `rateOnly` keep growing; no leak check for Back from Prospect-safe.

## Fixes asked
Risk badge to the bottom corner (or "87 d") on short rows; a wrapped two-line name before suite and term lines, then drop verify's exemption; real laptop viewports in verify; one left edge for a block's lines and no bare "!" when a badge names the state; Back never turns Prospect-safe off (with a leakcheck step); say what a search did not read; answer "largest block"; name same-name stops by bearing.
