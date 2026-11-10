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

  it('shows no tenant name in prospect-safe mode', () => {
    const { html } = render(true);
    for (const l of property.leases) expect(html).not.toContain(l.tenant);
    expect(html).toContain('Term not disclosed');
  });

  it('names a floor header by its visible text (no separate aria-label)', () => {
    const { html } = render(false);
    const heads = html.match(/<button[^>]*class="sp-pfloor__head"[^>]*>/g) ?? [];
    expect(heads.length).toBeGreaterThan(0);
    for (const h of heads) expect(h).not.toContain('aria-label');
  });
});
