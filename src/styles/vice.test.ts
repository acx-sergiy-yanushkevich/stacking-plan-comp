// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clearlyApart, describePalette, expiryStepFaults, expirySteps, hue, lightness, loadPalette, rampCardFaults, tokens } from './paletteChecks';

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

describe('Vice palette: the shared rule for the expiration ramp has teeth', () => {
  it('fails the night ramp of round 15, whose magenta, violet and slate were 1.4 and 2.7 L* apart', () => {
    const faults = expiryStepFaults(['#ffb95c', '#f47a42', '#e55f86', '#9c4277', '#74508f', '#505584']);
    expect(faults.join('\n')).toContain('exp-3 #9c4277 and exp-4 #74508f are 1.4 L* apart');
    expect(faults.join('\n')).toContain('exp-4 #74508f and exp-5 #505584 are 2.7 L* apart');
  });

  it('fails the day ramp of round 15 as well, and passes both ramps as they are now', () => {
    expect(expiryStepFaults(['#a8321a', '#d9641f', '#f2a640', '#c9b5ee', '#bfd2f7', '#d7e8f1']).length).toBeGreaterThan(0);
    expect(expiryStepFaults(expirySteps(vice.night))).toEqual([]);
    expect(expiryStepFaults(expirySteps(vice.day))).toEqual([]);
  });

  it('fails two steps of one hue however far apart they are in lightness', () => {
    expect(expiryStepFaults(['#ffd08a', '#ff9c00']).join('\n')).toMatch(/apart in hue/);
  });
});

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

describe('Vice palette, day: the pale end of a ramp is a fill a reader can see on the card', () => {
  const cards = vice.dayCards;
  const fill = (tone: string) => vice.day.get(`--tone-${tone}-fill`)!;

  it('has teeth: the 5+ yr and the lowest rent fills they replaced were 3.5 and 3.8 ΔE from the card under the cyan glow', () => {
    const was = (name: string, hex: string) => rampCardFaults(tokens([...vice.day].map(([k, v]) => `${k}: ${k === name ? hex : v};`).join(' ')), cards).join('\n');
    expect(was('--tone-exp-5-fill', '#e0eef5')).toContain('exp-5 #e0eef5 is 3.5 ΔE from the card #e6f5f7');
    expect(was('--tone-rent-0-fill', '#e3f1fa')).toContain('rent-0 #e3f1fa is 3.8 ΔE from the card #e6f5f7');
    expect(rampCardFaults(vice.day, cards)).toEqual([]);
    expect(rampCardFaults(vice.night, vice.nightCards)).toEqual([]);
  });

  it('keeps the steps beside them apart: 5+ yr 9 L* above 3–5 yr, and the two lowest rent steps 8 L* apart', () => {
    expect(lightness(fill('exp-5')) - lightness(fill('exp-4'))).toBeGreaterThanOrEqual(9);
    expect(lightness(fill('rent-0')) - lightness(fill('rent-1'))).toBeGreaterThanOrEqual(8);
    expect(lightness(fill('rent-1')) - lightness(fill('rent-2'))).toBeGreaterThanOrEqual(7.5);
  });
});
