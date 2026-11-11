// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { StaxLockup, StaxMark } from './Brand';
import { Icon } from '../ui';

describe('StaxMark', () => {
  it('is a 64-unit drawing of six floor bars, one of them the open suite', () => {
    const html = renderToString(<StaxMark />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html.match(/<rect /g)).toHaveLength(6);
    expect(html.match(/class="sp-mark__bar sp-mark__bar--open"/g)).toHaveLength(1);
    expect(html).toContain('x="39" y="22" width="13" height="9"');
    // Colour comes from CSS, keyed to the theme, never inline.
    expect(html).not.toMatch(/fill="#/);
  });
});

describe('StaxLockup', () => {
  it('reads "Stax" then "by Ascendix", with the mark first', () => {
    const html = renderToString(<StaxLockup />);
    const text = html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
    expect(text).toBe('|Stax|by Ascendix|');
    expect(html.indexOf('sp-mark')).toBeLessThan(html.indexOf('Stax'));
  });
});

describe('brand CSS', () => {
  const css = readFileSync(new URL('./shell.css', import.meta.url), 'utf8');
  const brand = css.slice(css.indexOf('/* ── Brand'));
  it('uses the fixed hex colours and no palette token', () => {
    for (const hex of ['#00aff0', '#ff9c00', '#1e2d3c', '#15212d']) expect(brand).toContain(hex);
    expect(brand).not.toMatch(/var\(--sp-color-brand/);
    // The bars sit on a navy square in both themes, so no theme may repaint them navy.
    expect(brand).not.toMatch(/\[data-theme='light'\][^{]*\.sp-mark__bar/);
  });
});

describe('palette icon', () => {
  it('exists in the icon set', () => {
    expect(renderToString(<Icon name="palette" />)).toContain('<path d="M12 3a9 9');
  });
});
