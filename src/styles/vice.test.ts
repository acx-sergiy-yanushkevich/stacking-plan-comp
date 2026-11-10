// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clearlyApart, describePalette, hue, loadPalette } from './paletteChecks';

/**
 * The Vice City palette, checked against the card colours painted behind the plan (sampled from the
 * browser in both themes, at the typical spot and at the brightest / darkest part of the backdrop glow).
 * The assertions every palette shares are in `paletteChecks.ts`; what is particular to this one follows.
 */
const vice = loadPalette({
  name: 'Vice',
  file: 'vice.css',
  id: 'vice',
  nightCards: ['#1f1041', '#1c1845', '#392c57'],
  dayCards: ['#fff5fa', '#e6f5f7', '#e8e4ec'],
});

describePalette(vice);

describe('Vice palette, day: the expiration lens beside the pink of Holdover / MTM', () => {
  const fill = (tone: string) => vice.day.get(`--tone-${tone}-fill`)!;
  const steps = [0, 1, 2, 3, 4, 5].map((i) => fill(`exp-${i}`));

  it('has teeth: the pink the 2–3 yr step replaced fails the check', () => {
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
});
