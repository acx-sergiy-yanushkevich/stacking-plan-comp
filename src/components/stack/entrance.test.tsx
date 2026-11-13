// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TODAY } from '../../data/mock/property';
import { parseState } from '../../state/planState';
import { FixedWidth } from '../../lib/useWidth';
import { buildModel } from '../inspector/testModel';
import StackView from './StackView';
import { PhoneStack } from './PhoneStack';
import { segmentText } from '../plan/segmentText';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

/**
 * The entrance numbers each floor for its stagger (DESIGN.md §3.5): `--n` floors, and each floor's `--i`,
 * counted from the ground floor on the plan (it rises from the ground) and from the top on the phone's list
 * (it reads from the top).
 */
describe('the stack numbers its floors for the entrance', () => {
  const state = parseState('?view=stack', TODAY);
  const model = buildModel(state);
  const n = model.floors.length;

  it('counts the plan rows from the ground floor', () => {
    const html = renderToString(
      <FixedWidth value={1200}>
        <StackView model={model} state={state} patch={() => {}} />
      </FixedWidth>,
    );
    expect(html).toMatch(new RegExp(`<svg[^>]*style="--n:${n}"`));
    const rowStyle = (id: string) => html.match(new RegExp(`<g[^>]*data-row="${id}"[^>]*>`))?.[0].match(/--i:(\d+)/)?.[1];
    // Rows are drawn top floor first.
    expect(rowStyle(model.floors[0].floor.id)).toBe(String(n - 1));
    expect(rowStyle(model.floors[n - 1].floor.id)).toBe('0');
  });

  it('counts the phone list from the top', () => {
    const html = renderToString(
      <PhoneStack
        model={model}
        state={state}
        patch={() => {}}
        title="Occupancy"
        legendNote={null}
        highlight={null}
        textFor={(seg, f) => segmentText(seg, { safe: false, asOf: TODAY, today: TODAY, lens: 'status', floorName: f.floor.name })}
      />,
    );
    expect(html).toMatch(/<li[^>]*class="sp-pfloor[^"]*"[^>]*style="--i:0"/);
    expect(html).toContain(`--i:${n - 1}`);
  });
});
