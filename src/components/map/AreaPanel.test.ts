import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { MockSource } from '../../data/sources/MockSource';
import { defaultState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import { AreaPanel } from './AreaPanel';

describe('AreaPanel', () => {
  it('renders the heading and skeleton bars before data arrives (effects do not run in SSR)', () => {
    const model = { property } as unknown as PlanModel;
    const html = renderToString(createElement(AreaPanel, { model, state: defaultState(TODAY), dataSource: new MockSource() }));
    expect(html).toContain('Area');
    expect(html).toContain('sp-skel');
    expect(html).not.toContain('Population');
  });
});
