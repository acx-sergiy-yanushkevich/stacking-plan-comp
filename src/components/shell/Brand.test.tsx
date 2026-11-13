// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { StaxLockup, StaxMark } from './Brand';
import { Icon } from '../ui';

describe('StaxMark', () => {
  it('is a drawing of six floor bars, one of them the open suite, framed tight to the bars: no tile round it', () => {
    const html = renderToString(<StaxMark />);
    expect(html).toContain('viewBox="11 9 42 47"');
    // The bars fill the mark's box (40 px, the building card icon's size): the drawing is the whole mark.
    expect(html).toMatch(/<svg width="40" height="40"/);
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
    for (const hex of ['#00aff0', '#ff9c00']) expect(brand).toContain(hex);
    expect(brand).not.toMatch(/var\(--sp-color-brand/);
    // The bars are cyan in both themes: no theme repaints them.
    expect(brand).not.toMatch(/\[data-theme=[^\]]*\][^{]*\.sp-mark__bar/);
  });
  it('draws the mark with no tile and no border: the bars stand on the page, in either theme (Clara, Nov 12)', () => {
    const rules = [...brand.matchAll(/([^{}]*\.sp-mark(?![_\w-])[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]);
    expect(rules.length).toBeGreaterThan(0);
    for (const body of rules) expect(body).not.toMatch(/background|box-shadow|border|outline:/);
  });
  it('the building card\'s icon is drawn at the size Header gives it: no stylesheet resizes it', () => {
    for (const f of ['../../styles/glass.css', './shell.css']) {
      const sheet = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(sheet, f).not.toMatch(/\.sp-header[^{]*> \.sp-ministack \{[^}]*(width|height):/);
    }
  });
  it('follows the theme the way tokens.css does: an explicit data-theme, else the OS preference', () => {
    // Without data-theme (aurora, classic, print preview) the page is light unless the OS prefers dark, so the
    // dark variant must only apply under an explicit dark theme or inside a prefers-color-scheme: dark block.
    const outsideMedia = brand.replace(/@media \(prefers-color-scheme: dark\) \{[^}]*\}[^}]*\}/g, '');
    expect(outsideMedia).not.toMatch(/:root:not\(\[data-theme='light'\]\)/);
    expect(brand).toMatch(/:root\[data-theme='dark'\] \.sp-lockup__by/);
    expect(brand).toMatch(/@media \(prefers-color-scheme: dark\)/);
  });
});

describe('building card facts', () => {
  it('gives the sale listing no colour of its own: it reads like the facts beside it', () => {
    const css = readFileSync(new URL('./shell.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.sp-header__sale[^{]*\{[^}]*color:/);
  });
});

describe('palette icon', () => {
  it('exists in the icon set', () => {
    expect(renderToString(<Icon name="palette" />)).toContain('<path d="M12 3a9 9');
  });
});
