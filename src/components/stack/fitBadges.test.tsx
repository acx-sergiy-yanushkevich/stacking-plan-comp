// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TODAY } from '../../data/mock/property';
import { parseState } from '../../state/planState';
import { FixedWidth } from '../../lib/useWidth';
import { buildModel } from '../inspector/testModel';
import FloorView from '../floor/FloorView';
import StackView from './StackView';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const FIT = /\d+ inquir(?:y fits|ies fit)/g;

const stack = (search: string) => {
  const state = parseState(search, TODAY);
  return renderToString(
    <FixedWidth value={1200}>
      <StackView model={buildModel(state)} state={state} patch={() => {}} bare rowHeight={40} />
    </FixedWidth>,
  );
};
const plate = (search: string) => {
  const state = parseState(search, TODAY);
  return renderToString(<FloorView model={buildModel(state)} state={state} patch={() => {}} />);
};

describe('inquiry-fit badges follow the search, not the typed requirement (round 23)', () => {
  it('a range the finder searches marks the suites inquiries fit', () => {
    expect(stack('?view=stack&req=5000&max=9000').match(FIT)?.length ?? 0).toBeGreaterThan(0);
    expect(plate('?view=floor&floor=F3&req=5000&max=9000').match(FIT)?.length ?? 0).toBeGreaterThan(0);
  });

  it('a range it refuses (maximum below the minimum) marks none: nothing was searched', () => {
    expect(stack('?view=stack&req=5000&max=3000').match(FIT)).toBeNull();
    expect(plate('?view=floor&floor=F3&req=5000&max=3000').match(FIT)).toBeNull();
  });
});
