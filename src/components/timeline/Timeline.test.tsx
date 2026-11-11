// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { rollover } from '../../domain/rollover';
import { legendFor } from '../../domain/lenses';
import { findIssues, issueCounts, recentChanges } from '../../domain/issues';
import { timelineModel } from '../../domain/timeline';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import TimelineView, { litKeys } from './TimelineView';
import { MiniTimeline } from './MiniTimeline';
import { TimelineRows } from './TimelineRows';
import { TimelineAxis } from './TimelineAxis';
import { RolloverChips } from './RolloverChips';
import { BAR_PAD, barLabel, endedNameFits, EXT_PAD, labelText, MIN_NAMED_BAR, NAME_FONT, SUB_FONT, tagWidth, tenantOfEnded, VACATED, wrapLabel, type LabelLine } from './barLabel';
import { layoutStackedRows, packLanes, stackedLaneHeight, STACK_LANE_GAP, viewAxis } from './layout';
import type { TimelineBar } from '../../domain/timeline';
import { measure } from '../../lib/textFit';
import { buildModel as planModel } from '../inspector/testModel';
import { fmtDate } from '../../domain/dates';

// jsdom-free: the view guards ResizeObserver, but keep the global so the hook path is exercised.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function buildModel(asOf: string, safe: boolean): PlanModel {
  const today = TODAY;
  const floors = deriveFloors(property, asOf, today);
  const floorsToday = asOf === today ? floors : deriveFloors(property, today, today);
  const kpis = computeKpis(property, floors, asOf);
  const kpisToday = asOf === today ? kpis : computeKpis(property, floorsToday, today);
  const issues = findIssues(property, floors, today);
  return {
    property,
    today,
    asOf,
    safe,
    isProjected: asOf !== today,
    floors,
    segIndex: segmentIndex(floors),
    kpis,
    kpisToday,
    deltas: asOf === today ? null : kpiDeltas(kpis, kpisToday),
    roll: rollover(floors, asOf, 'rolling', 8),
    issues,
    counts: issueCounts(issues),
    changes: recentChanges(property, today, 30),
    legend: legendFor('status', safe, floors),
    req: null,
    fits: null,
    worklist: () => [],
    activeWorklist: null,
    searchReasons: null,
    searchMatches: null,
    bucketKeys: null,
    highlight: null,
    filterLabel: null,
    timeline: timelineModel(property, floors, asOf, today),
    selected: null,
    selectedFloor: null,
    anyEnlarged: false,
  };
}

const tenantNames = Array.from(new Set(property.leases.map((l) => l.tenant)));

describe('TimelineView', () => {
  it('renders the slider, one row per floor and tenant names', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<TimelineView model={model} state={parseState('', TODAY)} patch={() => {}} />);
    expect(html).toContain('role="slider"');
    expect(html.match(/class="sp-tl-row"/g)?.length).toBe(12);
    expect(model.timeline.rows.length).toBe(12);
    expect(html).toContain('Cirrus Energy');
    // Rollover band: nine columns (8 buckets + tail), the first labelled "< 12 mo".
    expect(html.match(/class="sp-tl-band__col/g)?.length).toBe(9);
    expect(html).toContain('&lt; 12 mo');
    // The handle shows the month and the slider the full date.
    expect(html).toContain('Nov 2026');
    expect(html).toContain('aria-valuetext="Nov 9, 2026"');
  });

  it('hides every tenant name in prospect-safe mode', () => {
    const state = parseState('?safe=1', TODAY);
    const html = renderToString(<TimelineView model={planModel(state)} state={state} patch={() => {}} />);
    for (const name of tenantNames) expect(html, name).not.toContain(name);
  });

  it('prospect-safe: no lease bar says when it began or ends, there is no rollover band and the date cannot be moved', () => {
    const state = parseState('?safe=1&view=timeline', TODAY);
    const html = renderToString(<TimelineView model={planModel(state)} state={state} patch={() => {}} />).replace(/<!-- -->/g, '');
    // The cursor is a marker, not a slider; the band and its periods are gone.
    expect(html).not.toContain('role="slider"');
    expect(html).toContain('aria-label="Plan as of Nov 9, 2026"');
    expect(html).not.toMatch(/sp-tl-band__col|sp-tl-roll|&lt; 12 mo|Rollover/);
    expect(html).toContain('the date cannot be moved');
    // No lease date in any tooltip or accessible name: no "Leased since", no "moves in", no year of a commencement.
    expect(html).not.toMatch(/Leased since|[Mm]oves in|Vacated/);
    // No bar says how long anything has left. A sublease's end is its sublandlord's lease end, so it is
    // withheld like every other lease date (domain/safe.ts, rule 2): the sublet suite is space on offer.
    const left = [...html.matchAll(/aria-label="([^"]*\d+ (?:mo|yr)[^"]* left)"/g)].map((m) => m[1]);
    expect(left).toHaveLength(0);
    expect(html).not.toContain('Sublease thru');
    const leaseDates = new Set(property.leases.flatMap((l) => [l.commencement, l.expiration, l.termination]).filter((d): d is string => !!d));
    for (const a of property.availabilities) {
      // Space on offer keeps the date it is offered from, and only that one.
      if (a.availableFrom) leaseDates.delete(a.availableFrom);
      if (a.subleaseExpiration) leaseDates.add(a.subleaseExpiration);
    }
    for (const d of leaseDates) expect(html, d).not.toContain(fmtDate(d));
    // A link that asks for a later date draws the same chart.
    const later = parseState('?safe=1&view=timeline&asOf=2028-01-01', TODAY);
    expect(renderToString(<TimelineView model={planModel(later)} state={later} patch={() => {}} />).replace(/<!-- -->/g, '')).toBe(html);
  });

  it('shows the Today marker, holdover and projected extensions when time-travelling', () => {
    const asOf = '2028-01-01';
    const model = buildModel(asOf, false);
    const html = renderToString(<TimelineView model={model} state={parseState(`?asOf=${asOf}&lens=expiry`, TODAY)} patch={() => {}} />);
    expect(html).toContain('>Today<');
    expect(html).toContain('Jan 2028');
    expect(html).toContain('sp-tl-bar--projected');
  });

  it('marks the selected bar and dims the rest of a highlight set', () => {
    const base = buildModel(TODAY, false);
    const first = base.timeline.rows.flatMap((r) => r.bars)[0];
    const model: PlanModel = { ...base, highlight: new Set([first.segKey]) };
    const html = renderToString(<TimelineView model={model} state={{ ...parseState('', TODAY), select: first.segKey }} patch={() => {}} />);
    expect(html).toContain('is-selected');
    expect(html).toContain('is-dim');
  });

  // Round 15: pointing at "Largest block" or "Available" lit the inspector's small model only; the bars did not answer.
  it('lights the bars of what is pointed at (a KPI, a finder option) before the filter in force, as the Stack view does', () => {
    const filter = new Set(['A01']);
    const pointed = new Set(['A02', 'A03']);
    expect(litKeys(pointed, filter)).toBe(pointed);
    expect(litKeys(null, filter)).toBe(filter);
    expect(litKeys(pointed, null)).toBe(pointed);
    // Nothing pointed at and no filter: every bar at full strength.
    expect(litKeys(null, null)).toBeNull();
  });

  it('dims every bar outside the largest block when its suites are the lit set, and none of the block\'s own', () => {
    const base = buildModel(TODAY, false);
    const largest = base.kpis.maxContiguous.keys;
    expect(largest.length).toBeGreaterThan(0);
    const html = renderToString(<TimelineView model={{ ...base, highlight: litKeys(new Set(largest), null) }} state={parseState('', TODAY)} patch={() => {}} />);
    const bars = [...html.matchAll(/<g class="([^"]*sp-tl-bar[^"]*)"[^>]*data-seg="([^"]+)"/g)].map((m) => ({ cls: m[1], seg: m[2] }));
    expect(bars.length).toBeGreaterThan(largest.length);
    for (const b of bars) expect(b.cls.includes('is-dim'), b.seg).toBe(!largest.includes(b.seg));
  });
});

/**
 * Round 16, as of Jul 2029: the Floor 3 holdover's name ran from the bar into its extension, so the bar's
 * end edge was drawn through it ("Argosy|Partners"); and leases that had ended by then read "Preston Park
 * Café" and "BeachBody Workouts" beside neighbours that read "· vacated". A label is now written inside
 * one box or to the right of both, and an ended lease always carries the word.
 */
describe('timeline labels when the as-of date has moved on', () => {
  interface DrawnBar {
    cls: string;
    key: string;
    aria: string;
    /** The bar's own rectangle and, where it has one, its extension to the as-of line. */
    rect: { x: number; y: number; w: number };
    ext: { x: number; w: number } | null;
    texts: Array<{ place: string; x: number; name: string; sub: string }>;
  }
  const plain = (t: string) => t.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  /** Every bar of the wide chart as drawn: its boxes and its labels, read from the markup. */
  function drawn(asOf: string, query = ''): DrawnBar[] {
    const html = renderToString(<TimelineView model={buildModel(asOf, false)} state={parseState(`?asOf=${asOf}${query}`, TODAY)} patch={() => {}} />);
    return html
      .split('<g class="sp-seg sp-tl-bar')
      .slice(1)
      .map((chunk) => {
        const rect = /<rect class="sp-seg__rect" x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)"/.exec(chunk)!;
        const ext = /<rect class="sp-tl-bar__ext[^"]*" x="([\d.-]+)" y="[\d.-]+" width="([\d.-]+)"/.exec(chunk);
        return {
          cls: chunk.slice(0, chunk.indexOf('"')),
          key: /data-bar="([^"]+)"/.exec(chunk)![1],
          aria: plain(/aria-label="([^"]*)"/.exec(chunk)![1]),
          rect: { x: Number(rect[1]), y: Number(rect[2]), w: Number(rect[3]) },
          ext: ext ? { x: Number(ext[1]), w: Number(ext[2]) } : null,
          texts: [...chunk.matchAll(/<text class="sp-tl-bar__text[^"]*" data-place="(\w+)" x="([\d.-]+)"[^>]*>(.*?)<\/text>/g)].map((m) => ({
            place: m[1],
            x: Number(m[2]),
            name: plain(/<tspan class="sp-tl-bar__name">(.*?)<\/tspan>/.exec(m[3])?.[1] ?? ''),
            sub: plain(/<tspan class="sp-tl-bar__sub">(.*?)<\/tspan>/.exec(m[3])?.[1] ?? ''),
          })),
        };
      });
  }
  const widthOf = (t: { name: string; sub: string }) => measure(t.name, NAME_FONT) + (t.sub ? measure(t.sub, SUB_FONT) : 0);
  const DATES = ['2027-03-01', '2027-05-01', '2027-11-01', '2028-07-01', '2029-07-01', '2030-01-01', '2031-01-01', '2031-11-01'];

  it('says "vacated" on every lease that has ended, in what is drawn and in its accessible name', () => {
    let ended = 0;
    for (const asOf of DATES) {
      for (const bar of drawn(asOf).filter((b) => b.cls.includes('sp-tl-bar--projected'))) {
        ended += 1;
        const shown = bar.texts.map((t) => `${t.name}${t.sub}`).join(' ');
        expect(shown, `${asOf} ${bar.key}`).toMatch(/vacated/);
        expect(bar.aria, `${asOf} ${bar.key}`).toMatch(/ · vacated/);
        // The tenant is named with it: the word is never alone, and a name is never shown in part.
        expect(bar.texts[0].name, `${asOf} ${bar.key}`).not.toBe(VACATED);
      }
    }
    // The leases the judge named are among them.
    expect(ended).toBeGreaterThan(30);
    const jul29 = drawn('2029-07-01');
    const text = (key: string) => jul29.find((b) => b.key === key)!.texts.map((t) => `${t.name}${t.sub}`).join(' ');
    expect(text('tl-L12-U1')).toContain('BeachBody Workouts · vacated');
    expect(text('tl-L01-U1')).toMatch(/^Preston Park Café( · | )vacated/);
    expect(text('tl-hist-L13-U1')).toContain('Cirrus Energy · vacated');
  });

  it('writes a label inside the bar, inside its extension or to the right of both: never across the bar\'s end', () => {
    let checked = 0;
    for (const asOf of DATES) {
      for (const bar of drawn(asOf).filter((b) => b.ext)) {
        const barEnd = bar.rect.x + bar.rect.w;
        const extEnd = bar.ext!.x + bar.ext!.w;
        for (const t of bar.texts) {
          checked += 1;
          const right = t.x + widthOf(t);
          if (t.place === 'bar') expect(right, `${asOf} ${bar.key} "${t.name}" ends inside the bar`).toBeLessThanOrEqual(barEnd);
          else if (t.place === 'ext') {
            expect(t.x, `${asOf} ${bar.key} "${t.name}" starts inside the extension`).toBeGreaterThanOrEqual(bar.ext!.x);
            expect(right, `${asOf} ${bar.key} "${t.name}" ends inside the extension`).toBeLessThanOrEqual(extEnd);
          } else expect(t.x, `${asOf} ${bar.key} "${t.name}" starts after the extension`).toBeGreaterThanOrEqual(extEnd);
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    // Floor 3's holdover as of Jul 2029: its whole label, to the right of the rose extension.
    const argosy = drawn('2029-07-01').find((b) => b.key === 'tl-L06-U1')!;
    expect(argosy.texts).toHaveLength(1);
    expect(argosy.texts[0]).toMatchObject({ place: 'outside', name: 'Argosy Partners', sub: ' · Ste 300 · 11,000 SF' });
    expect(argosy.aria).toMatch(/^Holdover Argosy Partners · Ste 300 · 11,000 SF\. /);
  });

  it('keeps the lane to the right of an ended lease free when its bar is too short to say so on itself', () => {
    // As of May 2027 the café has been gone two months: its bar holds "Preston Park Café" and the dashed box
    // after it is a few px wide. The label goes right of the as-of line, and the for-sale bar takes another lane.
    const bars = drawn('2027-05-01');
    const cafe = bars.find((b) => b.key === 'tl-L01-U1')!;
    const forSale = bars.find((b) => b.key === 'tl-A10')!;
    expect(cafe.texts[0]).toMatchObject({ place: 'outside', name: 'Preston Park Café · vacated' });
    expect(forSale.rect.y).not.toBe(cafe.rect.y);
  });

  it('where the bar holds the tenant and the dashed box after it holds the word, writes one in each', () => {
    // Which date shows it depends on the chart's width, so every month is looked at: wherever a label is
    // in two pieces, the first is the tenant in the bar and the second is the word in the extension.
    let split = 0;
    for (let y = 2027; y <= 2031; y += 1)
      for (const m of ['01', '04', '07', '10'])
        for (const bar of drawn(`${y}-${m}-01`)) {
          if (bar.texts.length < 2) continue;
          split += 1;
          expect(bar.cls).toContain('sp-tl-bar--projected');
          expect(bar.texts.map((t) => t.place)).toEqual(['bar', 'ext']);
          expect(bar.texts[1].name).toBe(VACATED);
          expect(bar.texts[0].name).toBe(tenantOfEnded(`${bar.texts[0].name} · ${VACATED}`));
          expect(bar.aria).toContain(`${bar.texts[0].name} · ${VACATED}`);
          // Each piece inside its own box.
          expect(bar.texts[0].x + measure(bar.texts[0].name, NAME_FONT)).toBeLessThanOrEqual(bar.rect.x + bar.rect.w);
          expect(bar.texts[1].x).toBeGreaterThanOrEqual(bar.ext!.x);
          expect(bar.texts[1].x + measure(VACATED, NAME_FONT)).toBeLessThanOrEqual(bar.ext!.x + bar.ext!.w);
        }
    expect(split).toBeGreaterThan(0);
  });

  it('endedNameFits: whole in the bar, whole in the extension, or the tenant in the bar and the word after it', () => {
    const name = `Preston Park Café · ${VACATED}`;
    const nameW = measure(name, NAME_FONT);
    const tenantW = measure('Preston Park Café', NAME_FONT);
    const wordW = measure(VACATED, NAME_FONT);
    expect(tenantOfEnded(name)).toBe('Preston Park Café');
    expect(tenantOfEnded('Preston Park Café')).toBeNull();
    // (Half a pixel of slack on the side that fits: the widths are fractions.)
    expect(endedNameFits(name, nameW + BAR_PAD + 0.5, 0)).toBe(true);
    expect(endedNameFits(name, nameW + BAR_PAD - 1, 0)).toBe(false);
    expect(endedNameFits(name, 0, nameW + EXT_PAD + 0.5)).toBe(true);
    expect(endedNameFits(name, 0, nameW + EXT_PAD - 1)).toBe(false);
    // Split: the bar holds the tenant, the extension holds the word.
    expect(tenantW + BAR_PAD).toBeGreaterThanOrEqual(MIN_NAMED_BAR);
    expect(endedNameFits(name, tenantW + BAR_PAD + 0.5, wordW + EXT_PAD + 0.5)).toBe(true);
    expect(endedNameFits(name, tenantW + BAR_PAD + 0.5, wordW + EXT_PAD - 1)).toBe(false);
    expect(endedNameFits(name, tenantW + BAR_PAD - 1, wordW + EXT_PAD + 0.5)).toBe(false);
    // A bar too narrow to carry any name does not count, however short the name.
    expect(endedNameFits(`AB · ${VACATED}`, MIN_NAMED_BAR - 1, 0)).toBe(false);
  });

  it('packLanes: a bar that keeps its lane shares it with nothing that starts later', () => {
    const bar = (key: string, start: string, end: string | null, kind: TimelineBar['kind']): TimelineBar => ({ key, segKey: key, label: key, start, end, kind, sublease: false, committed: false });
    const ended = bar('ended', '2022-03-01', '2027-02-28', 'projected');
    const next = bar('next', '2029-07-01', null, 'available');
    const asOf = '2029-07-01';
    // An ended lease is drawn out to the as-of line; what starts there shares its lane.
    expect(packLanes([ended, next], asOf).map((l) => l.map((b) => b.key))).toEqual([['ended', 'next']]);
    expect(packLanes([ended, next], asOf, false, (b) => b.key === 'ended').map((l) => l.map((b) => b.key))).toEqual([['ended'], ['next']]);
    expect(packLanes([ended, next], asOf, false, () => false).map((l) => l.map((b) => b.key))).toEqual([['ended', 'next']]);
  });

  it('changes nothing as of today: no lease has ended, and the holdover is labelled as before', () => {
    const today = drawn(TODAY);
    expect(today.filter((b) => b.cls.includes('sp-tl-bar--projected'))).toHaveLength(0);
    const argosy = today.find((b) => b.key === 'tl-L06-U1')!;
    expect(argosy.texts.map((t) => `${t.name}${t.sub}`)).toEqual(['Argosy Partners · Ste 300 · 11,000 SF']);
    expect(argosy.texts[0].place).toBe('outside');
  });
});

describe('MiniTimeline', () => {
  it('renders a compact slider with bars and no text labels', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<MiniTimeline model={model} asOf={TODAY} onChange={() => {}} />);
    expect(html).toContain('role="slider"');
    expect(html).toContain('sp-cursor--compact');
    expect(html).not.toContain('Cirrus Energy');
    expect(html).toContain('width="300"');
    expect(html).toContain('height="56"');
  });
});

/** The stacked chart's labels for a plot `plotWidth` wide, built the way TimelineView builds them. */
function stackedLabels(model: PlanModel, plotWidth: number) {
  const labels = new Map<string, LabelLine[]>();
  const whole = new Map<string, { name: string; sub: string; risk: string | null }>();
  for (const row of model.timeline.rows) {
    for (const bar of row.bars) {
      const seg = model.segIndex.get(bar.segKey);
      if (!seg) continue;
      const l = barLabel(bar, seg, { safe: model.safe, asOf: model.asOf, today: model.today, lens: 'status', floorName: row.floor.name });
      whole.set(bar.key, l);
      labels.set(bar.key, wrapLabel(l.name, l.sub, plotWidth, l.risk ? tagWidth(l.risk) + 5 : 0));
    }
  }
  return { labels, whole };
}

function renderStacked(model: PlanModel, plotWidth: number) {
  const { labels } = stackedLabels(model, plotWidth);
  const laid = layoutStackedRows(model.timeline.rows, 30, (bar) => labels.get(bar.key)?.length ?? 1);
  const axis = viewAxis(model.timeline, model.asOf, model.today);
  return renderToString(
    <svg>
      <TimelineRows rows={laid} segIndex={model.segIndex} start={axis.start} end={axis.end} asOf={model.asOf} today={model.today} lens="status" safe={model.safe} plotLeft={60} plotWidth={plotWidth} clipId="clip" highlight={null} selected={null} hovered={null} stacked={labels} onSelect={() => {}} onHover={() => {}} />
    </svg>,
  );
}

/** Text as React's server renderer writes it. */
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

describe('stacked timeline (narrow hosts)', () => {
  const PLOT = 296; // a 390 px phone

  it('writes every bar\'s whole label: no part dropped, no ellipsis, no line wider than the plot', () => {
    const model = buildModel(TODAY, false);
    const { labels, whole } = stackedLabels(model, PLOT);
    expect(labels.size).toBe(model.timeline.rows.flatMap((r) => r.bars).length);
    for (const [key, lines] of labels) {
      const { name, sub, risk } = whole.get(key)!;
      // Reassembled, the lines are the label: only the separator at a line break is gone.
      const flat = (t: string) => t.replace(/ · /g, ' ').replace(/\s+/g, ' ').trim();
      expect(flat(labelText(lines)), key).toBe(flat(`${name} ${sub}`));
      lines.forEach((line, i) => {
        const w = line.reduce((t, r) => t + measure(r.text, r.kind === 'name' ? NAME_FONT : SUB_FONT), 0);
        expect(w, `${key} line ${i}`).toBeLessThanOrEqual(PLOT - (i === 0 && risk ? tagWidth(risk) + 5 : 0));
      });
    }
    const html = renderStacked(model, PLOT);
    expect(html).not.toContain('…');
    // Every run of every line is in the markup as written.
    for (const lines of labels.values()) for (const run of lines.flat()) expect(html, run.text).toContain(esc(run.text));
    expect(html).toContain('North American Asset Holdings');
    // Holdover and MTM keep their word, not just their colour.
    expect(html).toContain('>Holdover <');
    expect(html).toContain('>MTM <');
  });

  it('wraps between facts, so a figure stays with its unit', () => {
    const narrow = measure('North American Asset Holdings', NAME_FONT) + measure(' · Ste 500 · 6,500', SUB_FONT) + 2;
    const lines = wrapLabel('North American Asset Holdings', 'Ste 500 · 6,500 SF', narrow);
    expect(lines.map((l) => l.map((r) => r.text).join(''))).toEqual(['North American Asset Holdings · Ste 500', '6,500 SF']);
    // A part wider than a whole line breaks between words, never inside one.
    const tight = wrapLabel('North American Asset Holdings', '', measure('North American', NAME_FONT) + 2);
    expect(tight.map((l) => l[0].text)).toEqual(['North American', 'Asset Holdings']);
  });

  it('gives each bar its own lane, tall enough for its label, without overlap', () => {
    const model = buildModel(TODAY, false);
    const { labels } = stackedLabels(model, 200); // narrow enough that some labels take two lines
    const laid = layoutStackedRows(model.timeline.rows, 30, (bar) => labels.get(bar.key)!.length);
    expect([...labels.values()].some((l) => l.length > 1)).toBe(true);
    let y = 30;
    for (const r of laid) {
      expect(r.top).toBe(y);
      expect(r.lanes.every((lane) => lane.length === 1)).toBe(true);
      expect(r.lanes.length).toBe(r.row.bars.length);
      r.lanes.forEach(([bar], i) => {
        const bottom = r.laneTop[i] + stackedLaneHeight(labels.get(bar.key)!.length);
        if (i + 1 < r.lanes.length) expect(r.laneTop[i + 1]).toBe(bottom + STACK_LANE_GAP);
        else expect(bottom).toBeLessThanOrEqual(r.height);
      });
      y += r.height;
    }
  });

  it('leaks no tenant name and no holdover or MTM tag in prospect-safe mode', () => {
    const html = renderStacked(buildModel(TODAY, true), PLOT);
    for (const name of tenantNames) expect(html, name).not.toContain(esc(name));
    expect(html).not.toContain('Holdover');
    expect(html).not.toContain('MTM');
    expect(html).toContain('term not disclosed');
  });

  it('shows the rollover buckets as buttons with every figure whole', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<RolloverChips buckets={model.roll.buckets} atRisk={model.roll.atRisk} asOf={TODAY} activeBucket={0} onBucket={() => {}} />).replace(/<!-- -->/g, '');
    expect(html.match(/<button/g)?.length).toBe(9);
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    for (const b of model.roll.buckets) if (b.sf > 0) expect(html).toContain(`${b.sf.toLocaleString('en-US')} SF`);
    expect(html).toContain(`At risk ${model.roll.atRisk.toLocaleString('en-US')} SF`);
    // Prospect-safe passes 0: the at-risk line is gone.
    expect(renderToString(<RolloverChips buckets={model.roll.buckets} atRisk={0} asOf={TODAY} activeBucket={null} onBucket={() => {}} />)).not.toContain('At risk');
  });

  it('folds the buckets behind one row that states the next 12 months and the SF at risk, exactly', () => {
    const model = buildModel(TODAY, false);
    const html = renderToString(<RolloverChips buckets={model.roll.buckets} atRisk={model.roll.atRisk} asOf={TODAY} activeBucket={null} onBucket={() => {}} />).replace(/<!-- -->/g, '');
    // Closed until it is opened: the nine periods cost one row, so the leases start in the top half of a phone.
    expect(html).toMatch(/^<details class="sp-tl-roll">/);
    expect(html).not.toMatch(/^<details[^>]* open/);
    const summary = /<summary[^>]*>(.*?)<\/summary>/.exec(html)![1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const next = model.roll.buckets[0];
    expect(summary).toContain(`${next.label.replace('<', '&lt;')} ${next.sf.toLocaleString('en-US')} SF`);
    expect(summary).toContain(`At risk ${model.roll.atRisk.toLocaleString('en-US')} SF`);
    // Every figure is still in the page, whole, for when the row is opened.
    for (const b of model.roll.buckets) if (b.sf > 0) expect(html).toContain(`${b.sf.toLocaleString('en-US')} SF`);
  });

  it('names the period that is highlighting leases on the folded row, so the filter is never out of sight', () => {
    const model = buildModel(TODAY, false);
    const active = model.roll.buckets.find((b, i) => i > 0 && b.sf > 0)!;
    const html = renderToString(<RolloverChips buckets={model.roll.buckets} atRisk={model.roll.atRisk} asOf={TODAY} activeBucket={active.key} onBucket={() => {}} />).replace(/<!-- -->/g, '');
    const summary = /<summary[^>]*>(.*?)<\/summary>/.exec(html)![1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(summary).toContain(`Showing ${active.label} ${active.sf.toLocaleString('en-US')} SF`);
    // The row is named by the text on it (no separate label to drift from it), then says the date and the count.
    expect(html).not.toMatch(/<summary[^>]*aria-label/);
    expect(summary).toContain('Rollover from Nov 9, 2026, 9 periods');
  });

  it('leaves the band out of the axis when the buckets are drawn as buttons', () => {
    const model = buildModel(TODAY, false);
    const axis = viewAxis(model.timeline, TODAY, TODAY);
    const html = renderToString(
      <svg>
        <TimelineAxis start={axis.start} end={axis.end} asOf={TODAY} today={TODAY} plotLeft={60} plotWidth={296} stripHeight={28} bandHeight={0} height={400} buckets={model.roll.buckets} atRisk={model.roll.atRisk} activeBucket={null} onBucket={() => {}} />
      </svg>,
    );
    expect(html).not.toContain('sp-tl-band__col');
    expect(html).not.toContain('At risk');
    expect(html).toContain('sp-tl-axis__year');
  });
});
