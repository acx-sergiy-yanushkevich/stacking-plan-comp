// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FixedWidth, useWidth } from './useWidth';

function Probe({ fallback }: { fallback?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(fallback);
  return <div ref={ref} data-width={width} />;
}
const widthOf = (html: string) => Number(/data-width="(\d+)"/.exec(html)?.[1]);

describe('useWidth', () => {
  it('starts from its fallback until the element has been measured', () => {
    expect(widthOf(renderToString(<Probe fallback={1040} />))).toBe(1040);
    expect(widthOf(renderToString(<Probe />))).toBe(960);
  });

  it('inside FixedWidth is that width, whatever the fallback: nothing is measured', () => {
    expect(widthOf(renderToString(<FixedWidth value={1400}><Probe fallback={1040} /></FixedWidth>))).toBe(1400);
    expect(widthOf(renderToString(<FixedWidth value={1200}><div><Probe /></div></FixedWidth>))).toBe(1200);
  });

  it('a FixedWidth of null measures as usual', () => {
    expect(widthOf(renderToString(<FixedWidth value={null}><Probe fallback={700} /></FixedWidth>))).toBe(700);
  });
});
