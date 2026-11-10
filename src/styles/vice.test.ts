// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The Vice palette, checked against the card colours painted behind the plan (sampled from the browser
 * in both themes, at the typical spot and at the brightest / darkest part of the backdrop glow).
 * Every tone must separate from the card by its fill or by its 1 px edge (WCAG 1.4.11, 3:1), and carry
 * its own text at 4.5:1.
 */
const NIGHT_CARDS = ['#1f1041', '#1c1845', '#392c57'];
const DAY_CARDS = ['#fff5fa', '#e6f5f7', '#e8e4ec'];

const read = (name: string) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule for ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

function tokens(...blocks: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const b of blocks) for (const m of b.matchAll(/(--tone-[a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** CIE lightness, 0–100. */
const lightness = (hex: string) => 116 * Math.cbrt(lum(hex)) - 16;
/** Hue angle, 0–360 (0 for a grey). */
const hue = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
/** The shorter way round the hue circle between two colours, in degrees. */
const hueApart = (a: string, b: string) => {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
};
/**
 * Two fills a reader can tell apart at a glance without their edges: a different hue family (60° or
 * more) or a clear step in lightness (12 L* or more). Two pale pinks 13° and 8 L* apart are neither.
 */
const clearlyApart = (a: string, b: string) => hueApart(a, b) >= 60 || Math.abs(lightness(a) - lightness(b)) >= 12;

const vice = read('vice.css');
const night = tokens(block(vice, ":root[data-skin='glass'][data-palette='vice'][data-theme='dark']"));
// By day the palette sits on the light tokens and the light glass, and overrides what the pale card needs.
const day = tokens(block(read('tokens.css'), ':root'), block(read('glass.css'), ":root[data-skin='glass']"), block(vice, ":root[data-skin='glass'][data-palette='vice'][data-theme='light']"));

const tonesOf = (t: Map<string, string>) => [...t.keys()].filter((k) => k.endsWith('-fill')).map((k) => k.slice('--tone-'.length, -'-fill'.length));

describe.each([
  ['night', night, NIGHT_CARDS],
  ['day', day, DAY_CARDS],
] as const)('Vice palette, %s', (_name, t, cards) => {
  const get = (tone: string, part: 'fill' | 'text' | 'edge') => t.get(`--tone-${tone}-${part}`)!;

  it('defines every tone as an opaque colour (or a transparent fill)', () => {
    expect(tonesOf(t).length).toBeGreaterThan(25);
    for (const tone of tonesOf(t)) {
      expect(get(tone, 'fill'), `${tone} fill`).toMatch(/^(#[0-9a-f]{6}|transparent)$/);
      expect(get(tone, 'edge'), `${tone} edge`).toMatch(/^#[0-9a-f]{6}$/);
      expect(get(tone, 'text'), `${tone} text`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('separates every tone from the card by its fill or its edge, at 3:1 or more', () => {
    for (const tone of tonesOf(t))
      for (const card of cards) {
        const fill = get(tone, 'fill');
        const best = Math.max(contrast(get(tone, 'edge'), card), fill === 'transparent' ? 1 : contrast(fill, card));
        expect(best, `${tone} on ${card}`).toBeGreaterThanOrEqual(3);
      }
  });

  it('keeps the text of every tone at 4.5:1 or more on its fill', () => {
    for (const tone of tonesOf(t)) {
      const fill = get(tone, 'fill');
      for (const ground of fill === 'transparent' ? cards : [fill]) expect(contrast(get(tone, 'text'), ground), `${tone} text on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps leased calmer than the states that need attention', () => {
    const card = cards[0];
    const leased = contrast(get('leased', 'fill'), card);
    expect(leased).toBeLessThan(2);
    expect(contrast(get('available', 'fill'), card)).toBeGreaterThan(leased * 2);
    for (const loud of ['available', 'expiring', 'risk']) expect(contrast(get(loud, 'edge'), card), loud).toBeGreaterThan(contrast(get('leased', 'edge'), card) - 1);
    expect(get('neutral', 'fill')).toBe(get('leased', 'fill'));
  });
});

describe('Vice palette, night ramps', () => {
  const fill = (tone: string) => night.get(`--tone-${tone}-fill`)!;

  it('orders the rent ramp by lightness, with neighbours at least 12 L* apart', () => {
    const steps = [0, 1, 2, 3, 4].map((i) => lightness(fill(`rent-${i}`)));
    for (let i = 1; i < steps.length; i += 1) expect(steps[i] - steps[i - 1], `rent-${i - 1} to rent-${i}`).toBeGreaterThanOrEqual(12);
    expect(steps[4] - steps[0]).toBeGreaterThanOrEqual(35);
  });

  it('orders the expiration ramp from soonest (brightest) to latest', () => {
    const steps = [0, 1, 2, 3, 4, 5].map((i) => lightness(fill(`exp-${i}`)));
    for (let i = 1; i < steps.length; i += 1) expect(steps[i], `exp-${i}`).toBeLessThan(steps[i - 1]);
  });

  it('keeps the 1–2 yr step well away from the Holdover / MTM maroon', () => {
    expect(contrast(fill('exp-2'), fill('risk'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps Holdover / MTM clearly apart from every step of the expiration ramp, in hue or in lightness', () => {
    for (const i of [0, 1, 2, 3, 4, 5]) expect(clearlyApart(fill('risk'), fill(`exp-${i}`)), `risk against exp-${i}`).toBe(true);
  });

  it('orders the deal ramp by lightness', () => {
    const steps = [0, 1, 2, 3].map((i) => lightness(fill(`deal-${i}`)));
    for (let i = 1; i < steps.length; i += 1) expect(steps[i], `deal-${i}`).toBeGreaterThan(steps[i - 1]);
  });
});

describe('Vice palette, day', () => {
  // The building model paints the `-solid` colours as they are, next to the legend, the stack and the
  // plate, which paint the fill. The 3D map deepens each solid 45% toward the tone's edge (MapView).
  const MAP_DEEPEN = 0.45;
  const mix = (a: string, b: string, t: number) => `#${rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * t).toString(16).padStart(2, '0')).join('')}`;

  it('draws leased on the model in the legend\'s own colour, a step stronger', () => {
    for (const tone of ['leased', 'neutral', 'muted']) {
      const solid = day.get(`--tone-${tone}-solid`)!;
      const fill = day.get(`--tone-${tone}-fill`)!;
      expect(solid, tone).toMatch(/^#[0-9a-f]{6}$/);
      // Same hue as the swatch, a little darker (so the slab has body on the pale card), never far from it.
      expect(Math.abs(hue(solid) - hue(fill)), `${tone} hue`).toBeLessThanOrEqual(12);
      const step = lightness(fill) - lightness(solid);
      expect(step, `${tone} lightness step`).toBeGreaterThan(0);
      expect(step, `${tone} lightness step`).toBeLessThanOrEqual(10);
      // The model outlines each slab in the tone's edge, which must still separate it from the card.
      for (const card of DAY_CARDS) expect(contrast(day.get(`--tone-${tone}-edge`)!, card), `${tone} edge on ${card}`).toBeGreaterThanOrEqual(3);
    }
    expect(day.get('--tone-neutral-solid')).toBe(day.get('--tone-leased-solid'));
  });

  it('keeps a leased floor on the map apart from a light-grey basemap building', () => {
    const basemap = '#cfd4da';
    for (const tone of ['leased', 'neutral', 'muted']) {
      const wall = mix(day.get(`--tone-${tone}-solid`)!, day.get(`--tone-${tone}-edge`)!, MAP_DEEPEN);
      // Clearly darker than a basemap building, and tinted (blue above red), not a neutral grey.
      expect(lightness(basemap) - lightness(wall), `${tone} lightness`).toBeGreaterThanOrEqual(10);
      const [r, , b] = rgb(wall);
      expect(b - r, `${tone} tint`).toBeGreaterThanOrEqual(15);
    }
  });

  // Holdover / MTM is drawn in the at-risk tone beside the expiration ramp, in the same lens and the same
  // legend. In round 13 the 2–3 yr step was a pink 13° and 8 L* from it, and two floors read as one band.
  describe('expiration lens', () => {
    const fill = (tone: string) => day.get(`--tone-${tone}-fill`)!;
    const steps = [0, 1, 2, 3, 4, 5].map((i) => fill(`exp-${i}`));

    it('keeps Holdover / MTM clearly apart from every step of the ramp, in hue or in lightness', () => {
      steps.forEach((step, i) => {
        expect(clearlyApart(fill('risk'), step), `risk ${fill('risk')} against exp-${i} ${step}: hue ${hueApart(fill('risk'), step).toFixed(0)}° apart, ${Math.abs(lightness(fill('risk')) - lightness(step)).toFixed(1)} L* apart`).toBe(true);
      });
      // The check has teeth: the pink it replaced fails it.
      expect(clearlyApart(fill('risk'), '#ecbfd3')).toBe(false);
    });

    it('has no pink step: after red, orange and amber the ramp is lavender, periwinkle and pale blue', () => {
      const pink = hue(fill('risk'));
      for (const i of [3, 4, 5]) {
        expect(hue(steps[i]), `exp-${i} hue`).toBeGreaterThanOrEqual(190);
        expect(hue(steps[i]), `exp-${i} hue`).toBeLessThanOrEqual(280);
        expect(Math.min(Math.abs(hue(steps[i]) - pink), 360 - Math.abs(hue(steps[i]) - pink)), `exp-${i} from pink`).toBeGreaterThanOrEqual(60);
      }
      for (const i of [0, 1, 2]) expect(hue(steps[i]), `exp-${i} stays warm`).toBeLessThanOrEqual(45);
    });

    it('orders the ramp from soonest (darkest) to latest, the three cool steps 5 L* or more apart', () => {
      for (let i = 1; i < steps.length; i += 1) expect(lightness(steps[i]), `exp-${i} lighter than exp-${i - 1}`).toBeGreaterThan(lightness(steps[i - 1]));
      // Lavender, periwinkle and pale blue are neighbours in hue, so lightness is what separates them.
      for (const i of [4, 5]) expect(lightness(steps[i]) - lightness(steps[i - 1]), `exp-${i - 1} to exp-${i}`).toBeGreaterThanOrEqual(5);
    });

    it('tells every pair of steps apart: a different hue family, or 5 L* or more between them', () => {
      for (let i = 0; i < steps.length; i += 1)
        for (let j = i + 1; j < steps.length; j += 1) expect(hueApart(steps[i], steps[j]) >= 60 || Math.abs(lightness(steps[i]) - lightness(steps[j])) >= 5, `exp-${i} and exp-${j}`).toBe(true);
    });

    it('outlines every step at 3:1 or more on the day card, and carries dark or light text at 4.5:1', () => {
      for (let i = 0; i < steps.length; i += 1) {
        for (const card of DAY_CARDS) expect(contrast(day.get(`--tone-exp-${i}-edge`)!, card), `exp-${i} edge on ${card}`).toBeGreaterThanOrEqual(3);
        expect(contrast(day.get(`--tone-exp-${i}-text`)!, steps[i]), `exp-${i} text`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('draws leased as a tint, not as the white glass pane', () => {
    expect(day.get('--tone-leased-fill')).not.toMatch(/rgba|#fff/);
    expect(contrast(day.get('--tone-leased-fill')!, DAY_CARDS[0])).toBeGreaterThan(1.15);
  });
});
