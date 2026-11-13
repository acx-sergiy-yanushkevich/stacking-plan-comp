// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrast, deltaE, describePalette, deuteranopia, expiryStepFaults, expirySteps, hottestFirstFaults, hue, hueApart, lightness, loadPalette, lum, rampCardFaults, tokens, tonesOf, type Tokens } from './paletteChecks';

/**
 * The Ascendix palette (the company colours, the default look), checked against the card colours painted
 * behind the plan: sampled from the browser in both themes with the plan hidden, at the typical spot
 * and at the darkest and brightest part of the backdrop glow (stack, timeline and building cards).
 * The assertions every palette shares are in `paletteChecks.ts`; what the brand asks for follows.
 */
const ascendix = loadPalette({
  name: 'Ascendix',
  file: 'ascendix.css',
  id: 'ascendix',
  nightCards: ['#21364b', '#1d3043', '#203b54', '#223a51'],
  dayCards: ['#fdfdfd', '#f5f9fb', '#f8f9f9'],
  nightExpiry: 'hottest',
});

describePalette(ascendix);

const BRAND = {
  primaryBlue: '#00aff0',
  primaryOrange: '#ff9c00',
  primaryText: '#292d3b',
  backgroundGrey: '#f7f7f7',
  secondaryBlue1: '#2491dd',
  secondaryBlue2: '#284058',
  secondaryBlue3: '#1e2d3c',
};

const { night, day } = ascendix;
const fillOf = (t: Tokens, tone: string) => t.get(`--tone-${tone}-fill`)!;

describe('Ascendix palette, the company colours', () => {
  it('night: Secondary Blue 3 page, Secondary Blue 2 glass, Primary Blue accent, Primary Orange highlight', () => {
    expect(night.get('--sp-color-page')).toBe(BRAND.secondaryBlue3);
    expect(night.get('--sp-color-card')).toBe('rgba(40, 64, 88, 0.46)'); // Secondary Blue 2, as glass
    expect(night.get('--sp-color-brand')).toBe(BRAND.primaryBlue);
    expect(night.get('--sp-glass-active-ring')).toContain(BRAND.primaryBlue);
    expect(night.get('--sp-color-focus')).toBe(BRAND.primaryOrange);
    expect(night.get('--tone-expiring-edge')).toBe(BRAND.primaryOrange);
    expect(fillOf(night, 'exp-1')).toBe(BRAND.primaryOrange);
  });

  it('day: Background Grey page, Primary Text, and an accent that is Secondary Blue 1 darkened to 4.5:1', () => {
    expect(day.get('--sp-color-page')).toBe(BRAND.backgroundGrey);
    expect(day.get('--sp-color-text')).toBe(BRAND.primaryText);
    expect(day.get('--tone-leased-text')).toBe(BRAND.primaryText);
    const accent = day.get('--sp-color-brand')!;
    // Primary Blue is 2.4:1 on white and Secondary Blue 1 is 3.4:1: neither carries small text.
    expect(contrast(BRAND.primaryBlue, '#ffffff')).toBeLessThan(3);
    expect(contrast(BRAND.secondaryBlue1, '#ffffff')).toBeLessThan(4.5);
    expect(hueApart(accent, BRAND.secondaryBlue1)).toBeLessThanOrEqual(6);
    for (const ground of ['#ffffff', BRAND.backgroundGrey, ...ascendix.dayCards]) {
      expect(contrast(accent, ground), `accent on ${ground}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(day.get('--sp-color-brand-strong')!, ground), `strong accent on ${ground}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(day.get('--sp-color-focus')!, ground), `focus ring on ${ground}`).toBeGreaterThanOrEqual(3);
    }
    // Bars and other fills keep a company blue as it is: Secondary Blue 1, 3:1 or more on the card.
    expect(day.get('--sp-color-brand-fill')).toBe(BRAND.secondaryBlue1);
    for (const card of ascendix.dayCards) expect(contrast(BRAND.secondaryBlue1, card), `bar on ${card}`).toBeGreaterThanOrEqual(3);
  });

  it('night: text, accent and focus ring read on the card at its brightest', () => {
    for (const card of ascendix.nightCards) {
      for (const name of ['--sp-color-text', '--sp-color-text-weak', '--sp-color-text-faint', '--sp-color-brand-strong', '--sp-color-warn', '--sp-color-error', '--sp-color-success'])
        expect(contrast(night.get(name)!, card), `${name} on ${card}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(night.get('--sp-color-brand')!, card), `accent on ${card}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(night.get('--sp-color-focus')!, card), `focus ring on ${card}`).toBeGreaterThanOrEqual(3);
    }
    // Text on the accent (the primary button, the selected tab's badge) is dark.
    expect(contrast(night.get('--sp-color-on-brand')!, BRAND.primaryBlue)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(night.get('--sp-color-on-brand')!, BRAND.secondaryBlue1)).toBeGreaterThanOrEqual(4.5);
  });

  it('day: text reads on the card and on the page', () => {
    for (const ground of [BRAND.backgroundGrey, ...ascendix.dayCards])
      for (const name of ['--sp-color-text', '--sp-color-text-weak', '--sp-color-text-faint', '--sp-color-warn', '--sp-color-error', '--sp-color-success'])
        expect(contrast(day.get(name)!, ground), `${name} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    // White on the primary button's gradient, at both ends.
    for (const stop of day.get('--sp-brand-grad')!.match(/#[0-9a-f]{6}/g)!) expect(contrast(day.get('--sp-color-on-brand')!, stop), `on ${stop}`).toBeGreaterThanOrEqual(4.5);
  });

  it('has no pink or purple in its chrome: accents, glow and title are blues, the highlight is orange', () => {
    const isBlue = (hex: string) => hue(hex) >= 190 && hue(hex) <= 225;
    for (const t of [night, day]) {
      for (const name of ['--sp-color-brand', '--sp-color-brand-strong', '--sp-color-brand-fill', '--sp-color-pill-deal']) expect(isBlue(t.get(name)!), `${name} ${t.get(name)}`).toBe(true);
      // The backdrop glow and the gradients are made of the company blues alone.
      for (const name of ['--sp-aurora', '--sp-brand-grad', '--sp-glass-active', '--sp-brand-glow', '--sp-glass-active-ring']) {
        const value = t.get(name)!;
        for (const m of value.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
          const [r, g, b] = m.slice(1).map(Number);
          expect(b >= r && g >= r, `${name}: rgb(${r}, ${g}, ${b}) is not red-led`).toBe(true);
        }
        for (const hex of value.match(/#[0-9a-f]{6}/g) ?? []) expect(isBlue(hex), `${name} ${hex}`).toBe(true);
      }
      // The title runs from a neutral into the blues.
      for (const hex of t.get('--sp-title-grad')!.match(/#[0-9a-f]{6}/g)!) expect(hex === '#ffffff' || isBlue(hex) || hue(hex) >= 190, `title ${hex}`).toBe(true);
      const focus = hue(t.get('--sp-color-focus')!);
      expect(focus).toBeGreaterThanOrEqual(20);
      expect(focus).toBeLessThanOrEqual(45);
    }
  });
});

describe('Ascendix palette: the shared rule for the expiration ramp has teeth', () => {
  it('fails the day ramp of round 15, whose 2–3 yr and 3–5 yr steps were 5.5 L* apart', () => {
    const faults = expiryStepFaults(['#b03a16', '#e07400', '#ff9c00', '#c9bbef', '#c2d2f7', '#e1eff7']).join('\n');
    expect(faults).toContain('exp-3 #c9bbef and exp-4 #c2d2f7 are 5.5 L* apart');
    // The deep orange and the Primary Orange were one hue.
    expect(faults).toContain('exp-1 #e07400 and exp-2 #ff9c00 are 5.6° apart in hue');
  });

  it('fails the night ramp of round 15, whose two soonest steps were one hue, and passes both ramps as they are now', () => {
    expect(expiryStepFaults(['#ffd08a', '#ff9c00', '#ec7450', '#bb6191', '#3a6a8e', '#2e4883']).join('\n')).toMatch(/exp-0 #ffd08a and exp-1 #ff9c00 are 0\.\d° apart in hue/);
    expect(expiryStepFaults(expirySteps(night))).toEqual([]);
    expect(expiryStepFaults(expirySteps(day))).toEqual([]);
  });
});

describe('Ascendix palette: the expiration ramp runs one way in both themes (round 23)', () => {
  const steps = (t: Tokens) => expirySteps(t);

  it('"< 6 mo" is the same red-orange family by night and by day, the reddest step of each ramp', () => {
    expect(hueApart(steps(night)[0], steps(day)[0])).toBeLessThanOrEqual(10);
    for (const t of [night, day]) for (const s of steps(t).slice(1, 3)) expect(hue(s), s).toBeGreaterThan(hue(steps(t)[0]));
  });

  it('"5+ yr" is the quietest step of each ramp: the closest to its card', () => {
    expect(hottestFirstFaults(steps(night), ascendix.nightCards)).toEqual([]);
    expect(hottestFirstFaults(steps(day), ascendix.dayCards)).toEqual([]);
  });

  it('has teeth: the night ramp of round 23, which began with a pale yellow, fails it', () => {
    const was = ['#ffe07c', '#ff9c00', '#ec7450', '#bb6191', '#3a6a8e', '#2e4883'];
    expect(hottestFirstFaults(was, ascendix.nightCards).join('\n')).toMatch(/is not yellower than #ffe07c/);
    expect(hueApart(was[0], steps(day)[0])).toBeGreaterThan(10);
  });
});

describe('Ascendix palette, day: every ramp step is a fill a reader can see on the white card', () => {
  const cards = ascendix.dayCards;
  const fill = (tone: string) => fillOf(day, tone);
  const off = (hex: string) => Math.min(...cards.map((card) => deltaE(hex, card)));

  it('5+ yr is a steel blue 7 L* or more below the card and 11 ΔE or more from it (round 16: #f3f9fc, the card\'s own white)', () => {
    for (const card of cards) expect(lightness(card) - lightness(fill('exp-5')), `below ${card}`).toBeGreaterThanOrEqual(7);
    expect(off(fill('exp-5'))).toBeGreaterThanOrEqual(11);
    expect(hue(fill('exp-5'))).toBeGreaterThanOrEqual(195);
    expect(hue(fill('exp-5'))).toBeLessThanOrEqual(225);
    // It is still the palest step, 8 L* above the one before it.
    expect(lightness(fill('exp-5')) - lightness(fill('exp-4'))).toBeGreaterThanOrEqual(8);
  });

  it('the lowest rent step is a blue of its own as well, 8 L* above the next', () => {
    expect(off(fill('rent-0'))).toBeGreaterThanOrEqual(10);
    expect(lightness(fill('rent-0')) - lightness(fill('rent-1'))).toBeGreaterThanOrEqual(8);
    expect(lightness(fill('rent-1')) - lightness(fill('rent-2'))).toBeGreaterThanOrEqual(8);
  });

  it('has teeth: the fills they replaced fail the shared rule', () => {
    const was = (name: string, hex: string) => rampCardFaults(tokens([...day].map(([k, v]) => `${k}: ${k === name ? hex : v};`).join(' ')), cards).join('\n');
    expect(was('--tone-exp-5-fill', '#f3f9fc')).toContain('exp-5 #f3f9fc is 0.9 ΔE from the card #f5f9fb');
    expect(was('--tone-rent-0-fill', '#e6f5fd')).toContain('rent-0 #e6f5fd is 5.2 ΔE from the card #f5f9fb');
    expect(rampCardFaults(day, cards)).toEqual([]);
    expect(rampCardFaults(night, ascendix.nightCards)).toEqual([]);
  });
});

describe.each([
  ['night', night, ascendix.nightCards],
  ['day', day, ascendix.dayCards],
] as const)('Ascendix palette, %s: measured, not guessed', (theme, t, cards) => {
  const fill = (tone: string) => fillOf(t, tone);
  const edge = (tone: string) => t.get(`--tone-${tone}-edge`)!;

  it('outlines every tone at 3:1 or more by its 1 px edge alone, on the card at its darkest and brightest', () => {
    for (const tone of tonesOf(t)) for (const card of cards) expect(contrast(edge(tone), card), `${tone} edge ${edge(tone)} on ${card}`).toBeGreaterThanOrEqual(3);
  });

  it('status lens: leased is a calm blue-grey, expiring is the orange, at risk is red, available is green', () => {
    expect(hue(fill('leased'))).toBeGreaterThanOrEqual(200);
    expect(hue(fill('leased'))).toBeLessThanOrEqual(225);
    expect(hueApart(edge('expiring'), BRAND.primaryOrange)).toBeLessThanOrEqual(8);
    expect(hueApart(fill('expiring'), BRAND.primaryOrange)).toBeLessThanOrEqual(8);
    const red = hue(edge('risk'));
    expect(red >= 340 || red <= 10, `risk edge hue ${red.toFixed(0)}`).toBe(true);
    expect(hue(fill('available'))).toBeGreaterThanOrEqual(130);
    expect(hue(fill('available'))).toBeLessThanOrEqual(165);
  });

  it('keeps the selection ring apart from every state it can ring: a selected available block is obvious', () => {
    const ring = t.get('--sp-color-brand')!;
    // The ring is drawn on the block's edge and 6 px around it, on the card.
    for (const card of cards) expect(contrast(ring, card), `ring on ${card}`).toBeGreaterThanOrEqual(3);
    for (const tone of ['available', 'available-later', 'sublease', 'projected']) {
      expect(hueApart(ring, fill(tone)), `${tone} fill hue from the ring`).toBeGreaterThanOrEqual(40);
      expect(hueApart(ring, edge(tone)), `${tone} edge hue from the ring`).toBeGreaterThanOrEqual(40);
    }
    for (const tone of ['expiring', 'risk']) expect(hueApart(ring, edge(tone)), tone).toBeGreaterThanOrEqual(120);
    // Leased shares the ring's hue family, so the ring must beat its edge by saturation and weight.
    expect(contrast(ring, fill('leased'))).toBeGreaterThanOrEqual(theme === 'night' ? 3 : 3);
  });

  it('expiration lens: neighbours step in hue or in lightness, and Holdover / MTM differs from every step', () => {
    const steps = [0, 1, 2, 3, 4, 5].map((i) => fill(`exp-${i}`));
    for (let i = 1; i < steps.length; i += 1) {
      const dl = Math.abs(lightness(steps[i]) - lightness(steps[i - 1]));
      expect(dl >= 8 || (dl >= 4.5 && hueApart(steps[i], steps[i - 1]) >= 25), `exp-${i - 1} ${steps[i - 1]} to exp-${i} ${steps[i]}: ${dl.toFixed(1)} L*, ${hueApart(steps[i], steps[i - 1]).toFixed(0)}°`).toBe(true);
    }
    // Built from the orange toward the blues: the three soonest steps are warm (red through orange to a
    // warm yellow, which sits just past the Primary Orange so that the two differ in hue), the last is a blue.
    for (const i of [0, 1, 2]) expect(hue(steps[i]), `exp-${i} is warm`).toBeLessThanOrEqual(48);
    // The Primary Orange is a step of the night ramp as the brand gives it. By day it is the 1–2 yr step's
    // hue, deepened: with the orange itself (L* 73) the three steps after it, 8 L* apart, end at L* 97,
    // which is the white of the card (the round-16 fault). So the step keeps the hue and gives up lightness.
    if (theme === 'night') expect(steps).toContain(BRAND.primaryOrange);
    else {
      expect(hueApart(steps[2], BRAND.primaryOrange), `1–2 yr ${steps[2]} hue against the Primary Orange`).toBeLessThanOrEqual(2);
      expect(lightness(steps[2])).toBeLessThan(lightness(BRAND.primaryOrange));
      expect(lightness(steps[2])).toBeGreaterThanOrEqual(64);
      // The orange as given stays where the brand's highlight is: the deals lens and the focus ring's hue.
      expect(fill('deal-2')).toBe(BRAND.primaryOrange);
      // Why: a day ramp that keeps the Primary Orange cannot keep its last step off the card.
      const pinned = lightness(BRAND.primaryOrange) + 3 * 8;
      for (const card of cards) expect(lightness(card) - pinned, `room left under the card ${card}`).toBeLessThan(3);
    }
    expect(hue(steps[5])).toBeGreaterThanOrEqual(195);
    expect(hue(steps[5])).toBeLessThanOrEqual(225);
    for (const step of steps) {
      const dl = Math.abs(lightness(fill('risk')) - lightness(step));
      expect(hueApart(fill('risk'), step) >= 60 || dl >= 12, `risk ${fill('risk')} against ${step}`).toBe(true);
    }
  });

  // The 3D model and the map draw the lens with colour alone (no text on a slab). In round 14 the night
  // ramp's 3–5 yr violet and 5+ yr slate were 6 L* apart and became one colour to a colour-blind viewer.
  if (theme === 'night')
    it('expiration lens at night: every neighbour is 8 L* or more apart and stays apart under deuteranopia; the late steps are blues, not violets', () => {
      const steps = [0, 1, 2, 3, 4, 5].map((i) => fill(`exp-${i}`));
      for (let i = 1; i < steps.length; i += 1) {
        expect(Math.abs(lightness(steps[i - 1]) - lightness(steps[i])), `exp-${i - 1} ${steps[i - 1]} to exp-${i} ${steps[i]}`).toBeGreaterThanOrEqual(8);
        // The Primary Orange and the warm yellow after it differ by 16 L* and by the shared rule's 8° of hue (the
        // yellow cannot go further and stay warm); every other neighbour also differs by 12° or more.
        expect(hueApart(steps[i], steps[i - 1]), `exp-${i - 1} to exp-${i} hue`).toBeGreaterThanOrEqual(i === 2 ? 8 : 12);
        expect(deltaE(deuteranopia(steps[i - 1]), deuteranopia(steps[i])), `exp-${i - 1} to exp-${i} under deuteranopia`).toBeGreaterThanOrEqual(15);
      }
      // 3–5 yr and 5+ yr: steel and slate blues (hue 195–225), no purple.
      for (const i of [4, 5]) {
        expect(hue(steps[i]), `exp-${i} ${steps[i]} hue`).toBeGreaterThanOrEqual(195);
        expect(hue(steps[i]), `exp-${i} ${steps[i]} hue`).toBeLessThanOrEqual(225);
      }
      // The check has teeth: the pair it replaced fails it.
      expect(deltaE(deuteranopia('#6d5a9e'), deuteranopia('#34568a'))).toBeLessThan(15);
      expect(lightness('#6d5a9e') - lightness('#34568a')).toBeLessThan(8);
    });

  // "< $28" was #1b3a5c on a #21364b card: a $27 lease looked like the confidential grey beside it.
  if (theme === 'night')
    it('rent lens at night: the lowest step is plainly a rent, apart from the card and from the confidential grey', () => {
      const low = fill('rent-0');
      for (const card of cards) {
        expect(contrast(low, card), `rent-0 ${low} on ${card}`).toBeGreaterThanOrEqual(1.4);
        expect(deltaE(low, card), `rent-0 ${low} against ${card}`).toBeGreaterThanOrEqual(15);
      }
      expect(deltaE(low, fill('confidential')), 'against confidential').toBeGreaterThanOrEqual(20);
      expect(deltaE(deuteranopia(low), deuteranopia(fill('confidential'))), 'against confidential, deuteranopia').toBeGreaterThanOrEqual(20);
      // The colour it replaced fails on every card.
      for (const card of cards) expect(contrast('#1b3a5c', card)).toBeLessThan(1.4);
    });

  it('rent lens: the Leasing palette from slate navy to teal to sky blue, 12 L* or more between neighbours, the text flipping where the fill needs it', () => {
    const steps = [0, 1, 2, 3, 4].map((i) => fill(`rent-${i}`));
    const ls = steps.map(lightness);
    for (let i = 1; i < ls.length; i += 1) expect(Math.abs(ls[i] - ls[i - 1]), `rent-${i - 1} to rent-${i}`).toBeGreaterThanOrEqual(theme === 'night' ? 12 : 8);
    // One direction all the way: darkest to lightest at night, lightest to darkest by day.
    const dir = Math.sign(ls[4] - ls[0]);
    expect(dir).toBe(theme === 'night' ? 1 : -1);
    for (let i = 1; i < ls.length; i += 1) expect(Math.sign(ls[i] - ls[i - 1])).toBe(dir);
    // The Leasing view's colours (Clara, Nov 12: the five saturated company blues turned the whole building electric
    // blue by night): the darkest step is its slate navy, the lightest its sky blue, teal in the middle. At night the
    // cheapest rent is the darkest step; by day the dearest is.
    const byDark = [...steps].sort((a, b) => lightness(a) - lightness(b));
    const [slate, , , , sky] = byDark;
    expect(hue(slate) >= 218 && hue(slate) <= 232, `darkest ${slate} is the slate navy (hue ${hue(slate).toFixed(0)})`).toBe(true);
    expect(steps.some((st) => hue(st) >= 180 && hue(st) <= 195), 'a teal step between them').toBe(true);
    expect(hue(sky) >= 192 && hue(sky) <= 205, `lightest ${sky} is sky blue (hue ${hue(sky).toFixed(0)})`).toBe(true);
    expect(steps[0]).toBe(theme === 'night' ? '#3f4e8f' : '#c6e5f5');
    // Light text on the dark steps, dark text on the light ones.
    steps.forEach((step, i) => expect(lum(t.get(`--tone-rent-${i}-text`)!) > 0.5, `rent-${i} text`).toBe(lum(step) < 0.18));
  });

  it('deals lens: the further a deal has gone, the hotter the orange', () => {
    const steps = [0, 1, 2, 3].map((i) => fill(`deal-${i}`));
    for (const step of steps) expect(hue(step) >= 20 && hue(step) <= 42, `${step} is an orange (hue ${hue(step).toFixed(0)})`).toBe(true);
    for (let i = 1; i < steps.length; i += 1) expect(Math.abs(lightness(steps[i]) - lightness(steps[i - 1])), `deal-${i - 1} to deal-${i}`).toBeGreaterThanOrEqual(8);
    if (theme === 'night') expect(steps[3]).toBe('#ffb84d');
    // For sale stands beside this ramp and beside the rent blues: a hue of its own.
    for (const step of steps) expect(hueApart(fill('forsale'), step), 'for sale against the ramp').toBeGreaterThanOrEqual(120);
  });
});
