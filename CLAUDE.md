# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Stax is an interactive stacking plan for AscendixRE, a Salesforce CRM for commercial real estate brokers. It is a prototype entered in an internal tech challenge (rules and the November 18, 2026 deadline: `docs/CHALLENGE_RULES.md`): React 19, TypeScript, Vite and MapLibre, on mock data shaped like the CRM's records, with no backend.

## Commands

```bash
npm run dev                                # http://localhost:5173
npm test                                   # every unit test (Vitest)
npx vitest run src/domain/finder.test.ts   # one file
npx vitest run -t "largest block"          # tests whose name matches
npx tsc -b                                 # type check; npm run build = tsc -b + vite build to dist/
npm run lint                               # oxlint
```

`npm run lint` needs Node `^20.19` or `>=22.12`. On an older Node, npm skips oxlint's native binary and lint fails with "Cannot find native binding". That is the environment, not the code: `npx tsc -b` and `npm test` still gate.

**Browser checks** (Playwright driving the installed Google Chrome) run against the preview on port 4180, which serves `dist-judge/`, not `dist/`:

```bash
npx vite build --outDir dist-judge && npm run preview   # a preview may already hold 4180; it serves the rebuilt files
npm run verify        # smoke checks, keyboard, time travel, no console errors
npm run a11y          # axe-core on desktop and phone states
npm run leakcheck     # nothing withheld leaks in prospect-safe mode
npm run exportcheck   # the PNG and CSV exports
npm run pdfcheck      # the printed report's pages
node scripts/one.mjs "?view=map&safe=1" /tmp/map.png 1440 1100   # one screenshot
node scripts/osm-snapshot.mjs  # re-record live mode's copies of OpenStreetMap's stops and places (src/data/snapshots/)
```

`BASE=<url>` points any script at another server. Scratch screenshots go outside the repo. Every URL parameter is in the README's "Jump to any view" table.

## Architecture

**Read `docs/ARCHITECTURE.md` before changing state, the model, prospect-safe behavior, or anything that measures or listens to the page.** In short, `state/` (all state lives in the URL) feeds `model/usePlanModel.ts` (one derived `PlanModel`), which every view in `components/` draws; the rules live in `domain/`. These invariants are each held by a test or a check:

- **Prospect-safe** (`safe=1`: what a broker shows a prospect) is decided in `src/domain/safe.ts` alone. Components ask its named questions (`canShowDeals`, `rentVisible`, `tenantLabel`, …) or render its projections, so one file holds the whole policy. After touching anything a prospect could see, run `npm run leakcheck`.
- **Host boundary**: `src/lib/host.ts` (and `main.tsx`) is the only code that touches `window`, `document`, `matchMedia`, `requestAnimationFrame`, `ResizeObserver` and their kin; everything else calls the functions it exports (`lib/host.boundary.test.ts`). This keeps the app portable to a Salesforce host.
- **Pure domain**: `src/domain/` imports only from itself, with no React and no browser, so it ports unchanged to a Lightning web component.
- **State changes in one way**: `patch({…})` → `stepSession` → the URL. A new state field goes into `PlanState`, `DEFAULT_STATE`, `parseState` and `serializeState` (`state/planState.ts`) with tests, and into the README's URL table.
- **TODAY** is `2026-11-09` (`src/data/mock/property.ts`), fixed so screenshots repeat. Take today from it, never from the clock.
- **The mock data is load-bearing.** Preston Park's edge cases are deliberate, and tests, screenshots and the judge brief quote its figures. Change it on purpose and update whatever quotes it.

## Where things are written down

- `docs/BRIEF.md`: personas, their top jobs, the domain rules (RSF, holdover, month-to-month, availability is not vacancy, confidential rents, nothing invented) and the scoring rubric. Read it before changing what a state or a figure means.
- `docs/DESIGN.md`: the screen-by-screen specification.
- `docs/PLAN.md` §3: numbered requirements (FR-n, NFR-n), each with the test or check that proves it. When behavior changes, update its row.
- `docs/JUDGE_PROMPT.md` and `docs/judging/round-N/`: the council's brief and every past report.

## Conventions

- **American English, plain words, one name per thing** in everything a user, judge or voter reads: UI text, accessible names, the PDF, the CSV, the README and `docs/`. A renamed label also changes in `scripts/leakcheck.mjs`, which matches on labels (it drifted unnoticed for two rounds).
- **Anonymous**: no personal names, usernames or profile pictures in the app, the README, the docs or the screenshots (a challenge rule).
- **Color is never the only cue**: every state also carries a pattern, border or label. New or changed tones pass `src/styles/ascendix.test.ts` and `vice.test.ts`.
- Plain CSS on the tokens in `src/styles/tokens.css`, a stylesheet per component folder, no CSS-in-JS. Palettes override tokens only. Print stays white.
- Unit tests sit beside the code as `*.test.ts(x)` and run in Node without a DOM: render components with `renderToString`, and build a model with `components/inspector/testModel.ts`. Without a canvas, text measures 0.55 × the font size per character; choose test widths against that.
- Comments explain why, and name the judging round behind a rule ("round 19: …").
- Each change gets its own branch (`feat/…`, `fix/…`, `docs/round-N`) and merges by PR with a merge commit. Commit subjects read like `fix: round-22 findings: …`, `feat: …`, `docs: …`. Larger features get a spec in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/`.

## Judging rounds

The product improves in rounds: a council of four AI judges scores the build, and the fixes at least two judges agree on go into the next round.

1. **Prepare** on a `docs/round-N` branch. Write "New in round N" in `docs/JUDGE_PROMPT.md`. Add each new state to `STATES` in `scripts/shots.mjs` and to the brief's screenshot list, including every new overlay in every view (the Map too) and on a phone. Build `dist-judge` and run the preview. Run `npm run leakcheck` and `npm run a11y`, then `node scripts/shots.mjs docs/shots/round-N` and `node scripts/pdf.mjs docs/shots/round-N/pdf`.
2. **Judge.** Four independent, read-only judges (Claude Opus A and B, GPT Sol, Grok) each follow `docs/JUDGE_PROMPT.md` with `<ROUND>` set to `round-N` and return a report. Save the reports as `docs/judging/round-N/{claude-opus-a,claude-opus-b,gpt-sol,grok}.md`, with repo-relative file links.
3. **Score** as `docs/BRIEF.md` ("Scoring rubric") defines it: each judge's score is (UI /20 + UX /20 + Engineering /10) × 2, out of 100, and the round's score is their average; the target is an average of at least 95. Record the average and every judge's score in the README's review-council paragraph (under "Tools used").
4. **Fix** the agreed findings on `feat/round-N+1-fixes`.
