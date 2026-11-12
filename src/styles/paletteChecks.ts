import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The checks every palette of the glass skin must pass, shared by `vice.test.ts` and `ascendix.test.ts`.
 *
 * A palette is checked against the card colours painted behind the plan, sampled from the browser in
 * both themes (the typical spot, and the darkest and brightest part of the backdrop glow). Every tone
 * must separate from the card by its fill or by its 1 px edge (WCAG 1.4.11, 3:1) and carry its own
 * text at 4.5:1; the ramps must be ordered and their steps told apart.
 */

export type Tokens = Map<string, string>;

const read = (name: string) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
export function block(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule for ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

/** Every custom property declared in the blocks, later blocks winning. */
export function tokens(...blocks: string[]): Tokens {
  const out: Tokens = new Map();
  for (const b of blocks) for (const m of b.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return out;
}

export const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
export const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** CIE lightness, 0–100. */
export const lightness = (hex: string) => 116 * Math.cbrt(lum(hex)) - 16;
/** Hue angle, 0–360 (0 for a grey). */
export const hue = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
/** The shorter way round the hue circle between two colours, in degrees. */
export const hueApart = (a: string, b: string) => {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
};
/**
 * Two fills a reader can tell apart at a glance without their edges: a different hue family (60° or
 * more) or a clear step in lightness (12 L* or more). Two pale pinks 13° and 8 L* apart are neither.
 */
export const clearlyApart = (a: string, b: string) => hueApart(a, b) >= 60 || Math.abs(lightness(a) - lightness(b)) >= 12;
/**
 * A colour as a viewer with deuteranopia (no green cones, the most common colour blindness) sees it:
 * Machado, Oliveira and Fernandes (2009), severity 1, applied in linear RGB.
 */
export const deuteranopia = (hex: string): string => {
  const [r, g, b] = rgb(hex).map(lin);
  const sim = [
    0.367322 * r + 0.860646 * g - 0.227968 * b,
    0.280085 * r + 0.672501 * g + 0.047413 * b,
    -0.01182 * r + 0.04294 * g + 0.968881 * b,
  ];
  const srgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055));
  return `#${sim.map((v) => Math.min(255, Math.max(0, srgb(v))).toString(16).padStart(2, '0')).join('')}`;
};
/** CIE L*a*b* (D65). */
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
/** How far apart two colours look (CIE76 ΔE): about 2 is just noticeable, 10 and more is plainly two colours. */
export const deltaE = (a: string, b: string): number => {
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
export const mix = (a: string, b: string, t: number) => `#${rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * t).toString(16).padStart(2, '0')).join('')}`;

export const tonesOf = (t: Tokens) => [...t.keys()].filter((k) => k.startsWith('--tone-') && k.endsWith('-fill')).map((k) => k.slice('--tone-'.length, -'-fill'.length));

/** The 3D map deepens each daytime solid 45% toward the tone's edge (MapView). */
export const MAP_DEEPEN = 0.45;
/** At night the 3D map lifts each fill 12% toward white (MapView). */
export const MAP_LIFT = 0.12;

/**
 * The expiration ramp's six steps are read off the building model and the 3D map by colour alone (a
 * slab has no month written on it), so two neighbouring steps must differ in both ways a reader can
 * use: 8 L* or more in lightness, which survives a colour-blind eye and a grey print, and a different
 * hue. One rule for every palette, by night and by day.
 */
export const EXPIRY_STEP_L = 8;
export const EXPIRY_STEP_HUE = 8;
/** On the map the walls are the fills lifted (night) or deepened (day): neighbours stay this far apart there. */
export const EXPIRY_WALL_STEP_L = 7;

export const expirySteps = (t: Tokens): string[] => [0, 1, 2, 3, 4, 5].map((i) => t.get(`--tone-exp-${i}-fill`)!);

/**
 * Every step of a ramp is a fill a reader can see: far enough from the card behind it, wherever the
 * backdrop glow puts the card, to read as a colour and not as the card showing through. The step at the
 * quiet end of a ramp is the one at risk: the latest expiry and the lowest rent are pale by day and dark
 * at night, like the card. Measured as CIE76 ΔE, where about 2 is just noticeable and 10 is plainly two
 * colours (in round 16 the daytime 5+ yr step was 0.9 from the card under the glow, and read as an empty
 * outline). One rule for every palette, by night and by day.
 */
export const RAMP_OFF_CARD = 8;
export const RAMPS: ReadonlyArray<readonly [name: string, steps: number]> = [
  ['exp', 6],
  ['rent', 5],
  ['deal', 4],
];

/** Every ramp step too close to a card colour, in words; empty when every step is a fill of its own. */
export function rampCardFaults(t: Tokens, cards: readonly string[]): string[] {
  const faults: string[] = [];
  for (const [name, steps] of RAMPS)
    for (let i = 0; i < steps; i += 1) {
      const fill = t.get(`--tone-${name}-${i}-fill`)!;
      for (const card of cards) {
        const d = deltaE(fill, card);
        if (d < RAMP_OFF_CARD) faults.push(`${name}-${i} ${fill} is ${d.toFixed(1)} ΔE from the card ${card} (${RAMP_OFF_CARD} or more needed)`);
      }
    }
  return faults;
}

/** Every pair of neighbouring expiration steps that breaks the rule, in words; empty when the ramp is sound. */
export function expiryStepFaults(steps: readonly string[]): string[] {
  const faults: string[] = [];
  for (let i = 1; i < steps.length; i += 1) {
    const dl = Math.abs(lightness(steps[i]) - lightness(steps[i - 1]));
    const dh = hueApart(steps[i], steps[i - 1]);
    if (dl < EXPIRY_STEP_L) faults.push(`exp-${i - 1} ${steps[i - 1]} and exp-${i} ${steps[i]} are ${dl.toFixed(1)} L* apart (${EXPIRY_STEP_L} or more needed)`);
    if (dh < EXPIRY_STEP_HUE) faults.push(`exp-${i - 1} ${steps[i - 1]} and exp-${i} ${steps[i]} are ${dh.toFixed(1)}° apart in hue (${EXPIRY_STEP_HUE}° or more needed)`);
  }
  return faults;
}

/**
 * An expiration ramp ordered from the hottest step to the quietest, as both Ascendix themes are (round 23):
 *  - the soonest step is the reddest, and the warm steps run from red toward yellow (hue rising);
 *  - the latest step is the quietest: the step closest in lightness to the card behind the plan.
 * Every break of it, in words; empty when the ramp is ordered so.
 */
export function hottestFirstFaults(steps: readonly string[], cards: readonly string[]): string[] {
  const faults: string[] = [];
  const warm = steps.filter((s) => hue(s) <= 60);
  for (let i = 1; i < warm.length; i += 1) if (hue(warm[i]) <= hue(warm[i - 1])) faults.push(`warm step ${warm[i]} (${hue(warm[i]).toFixed(0)}°) is not yellower than ${warm[i - 1]} (${hue(warm[i - 1]).toFixed(0)}°)`);
  if (warm[0] !== steps[0]) faults.push(`the soonest step ${steps[0]} is not a warm colour`);
  const off = (s: string) => Math.min(...cards.map((c) => Math.abs(lightness(s) - lightness(c))));
  const quiet = steps.reduce((a, b) => (off(b) < off(a) ? b : a));
  if (quiet !== steps[steps.length - 1]) faults.push(`the quietest step is ${quiet} (${off(quiet).toFixed(1)} L* from the card), not the latest ${steps[steps.length - 1]}`);
  return faults;
}

/** The colour of each expiration step's wall on the 3D map, as MapView paints it in the theme. */
export function expiryWalls(t: Tokens, theme: 'night' | 'day'): string[] {
  return expirySteps(t).map((fill, i) => (theme === 'night' ? mix(fill, '#ffffff', MAP_LIFT) : mix(fill, t.get(`--tone-exp-${i}-edge`)!, MAP_DEEPEN)));
}
/** A light-grey basemap building (mapStyle.ts, BUILDINGS_LIGHT). */
export const BASEMAP_LIGHT = '#cfd4da';

export interface PaletteUnderTest {
  /** As in the test names: "Vice", "Ascendix". */
  name: string;
  /** The stylesheet in this folder and the palette's name in `data-palette`. */
  file: string;
  id: string;
  /** Card colours behind the plan, measured in the browser: typical, then the extremes of the glow. */
  nightCards: readonly string[];
  dayCards: readonly string[];
  /**
   * How the night expiration ramp is ordered. 'brightest' (the default): the soonest step is the lightest
   * and every step is darker than the one before. 'hottest': the same way as by day, from the hottest step
   * to the quietest (`hottestFirstFaults`); its warm steps rise in lightness toward the yellow, so lightness
   * is not the order there.
   */
  nightExpiry?: 'brightest' | 'hottest';
}

export interface LoadedPalette extends PaletteUnderTest {
  night: Tokens;
  day: Tokens;
}

/** The palette's tokens as the browser resolves them: night is self-contained, day sits on the light tokens and the light glass. */
export function loadPalette(p: PaletteUnderTest): LoadedPalette {
  const css = read(p.file);
  const night = tokens(block(css, `:root[data-skin='glass'][data-palette='${p.id}'][data-theme='dark']`));
  const day = tokens(block(read('tokens.css'), ':root'), block(read('glass.css'), ":root[data-skin='glass']"), block(css, `:root[data-skin='glass'][data-palette='${p.id}'][data-theme='light']`));
  return { ...p, night, day };
}

/** Registers the shared suites for one palette. */
export function describePalette(p: LoadedPalette): void {
  const { name, night, day } = p;

  describe.each([
    ['night', night, p.nightCards],
    ['day', day, p.dayCards],
  ] as const)(`${name} palette, %s`, (_theme, t, cards) => {
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

    it(`draws every step of the expiration, rent and deal ramps as a fill of its own: ${RAMP_OFF_CARD} ΔE or more from the card, wherever the glow puts it`, () => {
      expect(rampCardFaults(t, cards)).toEqual([]);
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

  // The one rule for the expiration ramp, in every palette and both themes (round 15: Vice by night had
  // three late steps 1.4 and 2.7 L* apart; Ascendix by day had two 5.5 L* apart).
  describe.each([
    ['night', night],
    ['day', day],
  ] as const)(`${name} palette, %s: the expiration ramp`, (theme, t) => {
    it(`keeps every pair of neighbouring steps ${EXPIRY_STEP_L} L* or more apart and of a different hue`, () => {
      expect(expiryStepFaults(expirySteps(t))).toEqual([]);
    });

    if (theme === 'day' || (p.nightExpiry ?? 'brightest') === 'brightest')
      it('runs one way in lightness from the soonest step to the latest', () => {
        const ls = expirySteps(t).map(lightness);
        const dir = Math.sign(ls[5] - ls[0]);
        expect(dir).toBe(theme === 'night' ? -1 : 1);
        for (let i = 1; i < ls.length; i += 1) expect(Math.sign(ls[i] - ls[i - 1]), `exp-${i - 1} to exp-${i}`).toBe(dir);
      });
    else
      it('runs one way from the hottest step to the quietest, as it does by day', () => {
        expect(hottestFirstFaults(expirySteps(t), p.nightCards)).toEqual([]);
        expect(hottestFirstFaults(expirySteps(p.day), p.dayCards)).toEqual([]);
      });

    it(`keeps the steps apart on the 3D map as well: neighbouring walls ${EXPIRY_WALL_STEP_L} L* or more apart`, () => {
      const walls = expiryWalls(t, theme);
      for (let i = 1; i < walls.length; i += 1) expect(Math.abs(lightness(walls[i]) - lightness(walls[i - 1])), `exp-${i - 1} wall ${walls[i - 1]} to exp-${i} wall ${walls[i]}`).toBeGreaterThanOrEqual(EXPIRY_WALL_STEP_L);
    });
  });

  describe(`${name} palette, night ramps`, () => {
    const fill = (tone: string) => night.get(`--tone-${tone}-fill`)!;

    it('orders the rent ramp by lightness, with neighbours at least 12 L* apart', () => {
      const steps = [0, 1, 2, 3, 4].map((i) => lightness(fill(`rent-${i}`)));
      for (let i = 1; i < steps.length; i += 1) expect(steps[i] - steps[i - 1], `rent-${i - 1} to rent-${i}`).toBeGreaterThanOrEqual(12);
      expect(steps[4] - steps[0]).toBeGreaterThanOrEqual(35);
    });

    // The lowest rent step is a fill a reader can see: a rent of its own, not the card showing through
    // (in round 14 one palette's "< $28" was 2 L* from its card and read as a block with no rent).
    it('lifts the lowest rent step off the card: 8 L* or more above it where the block is drawn', () => {
      expect(lightness(fill('rent-0')) - lightness(p.nightCards[0]), `rent-0 ${fill('rent-0')} on ${p.nightCards[0]}`).toBeGreaterThanOrEqual(8);
    });

    if ((p.nightExpiry ?? 'brightest') === 'brightest')
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

  describe(`${name} palette, day`, () => {
    // The building model paints the `-solid` colours as they are, next to the legend, the stack and the
    // plate, which paint the fill. The 3D map deepens each solid toward the tone's edge (MapView).
    it("draws leased on the model in the legend's own colour, a step stronger", () => {
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
        for (const card of p.dayCards) expect(contrast(day.get(`--tone-${tone}-edge`)!, card), `${tone} edge on ${card}`).toBeGreaterThanOrEqual(3);
      }
      expect(day.get('--tone-neutral-solid')).toBe(day.get('--tone-leased-solid'));
    });

    it('keeps a leased floor on the map apart from a light-grey basemap building', () => {
      for (const tone of ['leased', 'neutral', 'muted']) {
        const wall = mix(day.get(`--tone-${tone}-solid`)!, day.get(`--tone-${tone}-edge`)!, MAP_DEEPEN);
        // Clearly darker than a basemap building, and tinted (blue above red), not a neutral grey.
        expect(lightness(BASEMAP_LIGHT) - lightness(wall), `${tone} lightness`).toBeGreaterThanOrEqual(10);
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
      });

      it('orders the ramp from soonest (darkest) to latest', () => {
        // (How far apart neighbours must be is the shared rule above: `expiryStepFaults`.)
        for (let i = 1; i < steps.length; i += 1) expect(lightness(steps[i]), `exp-${i} lighter than exp-${i - 1}`).toBeGreaterThan(lightness(steps[i - 1]));
      });

      it('tells every pair of steps apart: a different hue family, or 5 L* or more between them', () => {
        for (let i = 0; i < steps.length; i += 1)
          for (let j = i + 1; j < steps.length; j += 1) expect(hueApart(steps[i], steps[j]) >= 60 || Math.abs(lightness(steps[i]) - lightness(steps[j])) >= 5, `exp-${i} and exp-${j}`).toBe(true);
      });

      it('outlines every step at 3:1 or more on the day card, and carries dark or light text at 4.5:1', () => {
        for (let i = 0; i < steps.length; i += 1) {
          for (const card of p.dayCards) expect(contrast(day.get(`--tone-exp-${i}-edge`)!, card), `exp-${i} edge on ${card}`).toBeGreaterThanOrEqual(3);
          expect(contrast(day.get(`--tone-exp-${i}-text`)!, steps[i]), `exp-${i} text`).toBeGreaterThanOrEqual(4.5);
        }
      });
    });

    it('draws leased as a tint, not as the white glass pane', () => {
      expect(day.get('--tone-leased-fill')).not.toMatch(/rgba|#fff/);
      expect(contrast(day.get('--tone-leased-fill')!, p.dayCards[0])).toBeGreaterThan(1.15);
    });
  });
}
