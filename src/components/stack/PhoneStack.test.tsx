// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { legendFor } from '../../domain/lenses';
import type { PlanModel } from '../../model/usePlanModel';
import { parseState } from '../../state/planState';
import { segmentText } from '../plan/segmentText';
import { PhoneStack } from './PhoneStack';

function render(safe: boolean) {
  const floors = deriveFloors(property, TODAY, TODAY);
  const model = { floors, legend: legendFor('status', safe, floors), asOf: TODAY, filterLabel: null, partial: null, highlight: null } as unknown as PlanModel;
  const state = parseState(safe ? '?safe=1' : '', TODAY);
  const html = renderToString(
    <PhoneStack
      model={model}
      state={state}
      patch={() => undefined}
      title="Occupancy"
      legendNote={null}
      highlight={null}
      textFor={(seg, f) => segmentText(seg, { safe, asOf: TODAY, today: TODAY, lens: 'status', floorName: f.floor.name })}
    />,
  );
  return { html, floors };
}

describe('PhoneStack', () => {
  it('renders one row per suite and one card per floor; the lobby is not a suite', () => {
    const { html, floors } = render(false);
    const suites = floors.reduce((t, f) => t + f.segments.length, 0);
    expect(html.match(/data-key="/g)?.length).toBe(suites);
    expect(html.match(/class="sp-pfloor /g)?.length).toBe(floors.length);
    expect(html).toContain('Lobby and building use');
  });

  it('gives every suite row its name, suite and SF', () => {
    const { html } = render(false);
    expect(html).toContain('Conner CPA Group');
    expect(html).toContain('Ste 740');
    expect(html).toContain('2,400 SF');
  });

  // Round 15: "Ste 1250 · 9,300 SF ·" ended a line on its separator before the rate wrapped under it.
  it('writes each separator in front of the fact it introduces, never after one: a line cannot end on it', () => {
    const { html } = render(false);
    const runs = [...html.matchAll(/<span class="sp-psuite__facts sp-dotrun"><span class="sp-dotrun__in">(.*?)<\/span><\/span><\/span>(?=<\/span>)/g)].map((m) => m[1]);
    expect(runs.length).toBeGreaterThan(20);
    for (const run of runs) {
      const parts = [...run.matchAll(/<span class="sp-dotrun__part sp-psuite__part">(.*?)<\/span>(?=<span class="sp-dotrun__part|$)/g)].map((m) => m[1]);
      expect(parts.length).toBeGreaterThan(0);
      // The first part has no separator; every later one starts with it; none ends with one.
      expect(parts[0]).not.toContain('sp-dotrun__dot');
      for (const part of parts.slice(1)) expect(part).toMatch(/^<span class="sp-dotrun__dot"> · <\/span>/);
      for (const part of parts) expect(part.replace(/<[^>]+>/g, '').trimEnd()).not.toMatch(/·$/);
    }
    // Read as text the row is what it was: the facts joined by " · ".
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    expect(text).toContain('Ste 1250 · 9,300 SF');
    expect(text).not.toMatch(/· ·|·\s*·/);
  });

  it('names a sublease on its floor\'s header, as every floor label does', () => {
    const { html } = render(false);
    expect(html).toContain('<span class="sp-pfloor__avail">7,000 SF sublease available</span>');
    expect(html).toContain('<span class="sp-pfloor__avail">9,300 SF available</span>');
  });

  it('shows no tenant name in prospect-safe mode', () => {
    const { html } = render(true);
    for (const l of property.leases) expect(html).not.toContain(l.tenant);
    // No lease shows its term: nothing says when one ends, and none is marked as the one without a date.
    expect(html).not.toMatch(/Term not disclosed|\bExp(ired)? [A-Z][a-z]{2}|Month-to-month|Holdover/);
    expect(html).toContain('Leased');
  });

  it('names a floor header by its visible text (no separate aria-label)', () => {
    const { html } = render(false);
    const heads = html.match(/<button[^>]*class="sp-pfloor__head"[^>]*>/g) ?? [];
    expect(heads.length).toBeGreaterThan(0);
    for (const h of heads) expect(h).not.toContain('aria-label');
  });
});
