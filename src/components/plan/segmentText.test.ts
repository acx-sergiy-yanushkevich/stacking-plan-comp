import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import { gapName, legendFor } from '../../domain/lenses';
import { findIssues } from '../../domain/issues';
import { cedarSprings } from '../../data/mock/buildings/cedarSprings';
import { badgeLabel, LARGEST_BLOCK, segmentText } from './segmentText';

const index = segmentIndex(deriveFloors(property, TODAY, TODAY));
const opts = { safe: false, asOf: TODAY, today: TODAY, floorName: 'Floor', lens: 'status' as const };
const byTenant = (tenant: string) => [...index.values()].find((s) => s.lease?.tenant === tenant)!;
const noActivity = (tenant: string) => segmentText(byTenant(tenant), opts).badges.some((b) => b.text === 'No activity');

describe('No activity badge', () => {
  it('flags an untouched lease expiring within 12 months', () => {
    expect(byTenant('North American Asset Holdings').monthsToExpiry).toBeLessThanOrEqual(12);
    expect(noActivity('North American Asset Holdings')).toBe(true);
  });

  it('stays quiet on an untouched lease 1 to 2 years out, where no outreach is the norm', () => {
    for (const tenant of ['Kinetic Ventures', 'WBH Financial Services']) {
      const m = byTenant(tenant).monthsToExpiry!;
      expect(m).toBeGreaterThan(12);
      expect(m).toBeLessThanOrEqual(24);
      expect(noActivity(tenant)).toBe(false);
    }
  });

  it('never shows in prospect-safe mode', () => {
    expect(segmentText(byTenant('North American Asset Holdings'), { ...opts, safe: true }).badges.some((b) => b.text === 'No activity')).toBe(false);
  });
});

describe('last-touch badge', () => {
  it('says the touch is in the past ("Call 40 d ago"), as the worklist does: "Call 40 d" read as due in 40 days', () => {
    const touch = segmentText(byTenant('Cirrus Energy'), opts).badges.find((b) => /^(Call|Email|Meeting|Tour) /.test(b.text));
    expect(touch?.text).toMatch(/^Call \d+ d ago$/);
  });
});

describe('quiet listing on an occupied suite', () => {
  const cirrus = index.get('L13-U1')!; // Ste 600: leased, marketed quietly from Apr 2027
  const published = { ...cirrus, marketed: { ...cirrus.marketed!, published: true } };
  const avail = (seg: typeof cirrus, safe: boolean) => segmentText(seg, { ...opts, safe }).badges.find((b) => /^Avail Apr\s'27$/.test(b.text));

  it('shows the broker the date and says the listing is quiet', () => {
    expect(avail(cirrus, false)?.title).toContain('quiet listing, not published');
    expect(avail(published, false)?.title).not.toContain('quiet');
  });

  it('is not shown to a prospect: no badge, tooltip or accessible name mentions it', () => {
    const t = segmentText(cirrus, { ...opts, safe: true });
    expect(avail(cirrus, true)).toBeUndefined();
    for (const text of [t.tooltip, t.aria, ...t.badges.flatMap((b) => [b.text, b.title ?? ''])]) expect(text).not.toMatch(/Avail|Marketed|quiet/i);
  });

  it('a published listing keeps its badge in prospect-safe mode, without the listing status', () => {
    expect(avail(published, true)).toBeDefined();
    expect(avail(published, true)!.title).not.toMatch(/quiet|published/i);
  });
});

describe('accessible name', () => {
  it('says the deal badge in words: a count alone means nothing', () => {
    const a08 = segmentText(index.get('A08')!, opts); // Floor 12, Ste 1250: one live deal
    expect(a08.badges.find((b) => b.kind === 'deal')?.text).toBe('1');
    expect(a08.aria).toMatch(/, 1 live deal$/);
    const a02 = segmentText(index.get('A02')!, opts); // Floor 3, Ste 350: two live deals
    expect(a02.badges.find((b) => b.kind === 'deal')?.text).toBe('2');
    expect(a02.aria).toMatch(/, 2 live deals$/);
    expect(a02.tooltip).toContain('2 live deals');
  });

  it('badgeLabel spells out a deal badge and leaves every other badge as drawn', () => {
    expect(badgeLabel({ kind: 'deal', text: '1' })).toBe('1 live deal');
    expect(badgeLabel({ kind: 'deal', text: '3' })).toBe('3 live deals');
    expect(badgeLabel({ kind: 'risk', text: 'Holdover' })).toBe('Holdover');
  });

  it('no name in any lens has a part that is only a number', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const) {
      for (const [, seg] of index) {
        const parts = segmentText(seg, { ...opts, lens }).aria.split(', ');
        expect(parts.filter((p) => /^\d+$/.test(p)), parts.join(' | ')).toEqual([]);
      }
    }
  });
});

describe('prospect-safe: every lease in place reads the same', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const raw = floors.flatMap((f) => f.segments).filter((s) => s.kind === 'leased' || s.kind === 'holdover' || s.kind === 'mtm');
  const projected = segmentIndex(safeFloors(floors, true));
  // What is left of a label once the suite's own identity (number and size) is taken out.
  const shape = (seg: (typeof raw)[number], lens: 'status' | 'expiry' | 'rent') => {
    const t = segmentText(seg, { ...opts, safe: true, lens });
    const strip = (s: string) => s.replace(t.sub, 'SUB');
    return JSON.stringify([t.tone, t.pattern, t.name, t.meta, t.lensShort, t.badges.map((b) => b.text), strip(t.tooltip), strip(t.aria)]);
  };

  it('holdover, month-to-month and ordinary leases produce one and the same text, tone, tooltip and accessible name', () => {
    expect(raw.some((s) => s.kind === 'holdover') && raw.some((s) => s.kind === 'mtm')).toBe(true);
    for (const lens of ['status', 'expiry', 'rent'] as const) {
      // A lease marketed for later with a published listing carries an "Avail" badge: that is the listing's date, compared apart.
      const plain = raw.filter((s) => !s.marketed || s.marketed.published === false);
      expect(new Set(plain.map((s) => shape(s, lens))).size, `${lens}, unprojected segments`).toBe(1);
      expect(new Set(plain.map((s) => shape(projected.get(s.key)!, lens))).size, `${lens}, projected segments`).toBe(1);
    }
  });

  it('says "Leased" and never a date, months left or "not disclosed"', () => {
    for (const s of raw) {
      for (const lens of ['status', 'expiry'] as const) {
        const t = segmentText(s, { ...opts, safe: true, lens });
        expect(t.meta).toBe('Leased');
        expect(t.lensShort).toBe('');
        expect(`${t.tooltip} ${t.aria}`).not.toMatch(/Exp|Expired|Month-to-month|not disclosed|\d+ (mo|yr)\b|left/);
      }
    }
  });

  it('the broker still sees each term', () => {
    expect(segmentText(byTenant('Cirrus Energy'), opts).meta).toMatch(/^Exp Mar 2027/);
    expect(segmentText(raw.find((s) => s.kind === 'mtm')!, opts).meta).toBe('Month-to-month');
    expect(segmentText(raw.find((s) => s.kind === 'holdover')!, opts).meta).toMatch(/^Expired /);
  });

  it('a sublet suite reads as space on offer: its asking rent with unit and type, and no end date (it is the sublandlord\'s lease end)', () => {
    const sub = floors.flatMap((f) => f.segments).find((s) => s.kind === 'sublease')!;
    // The broker reads how long the sublease runs.
    expect(segmentText(sub, opts).meta).toBe('Sublease thru Sep 2030');
    // A prospect does not, whether or not the segment went through the projection first.
    for (const seg of [sub, projected.get(sub.key)!]) {
      for (const lens of ['status', 'expiry', 'rent'] as const) {
        const t = segmentText(seg, { ...opts, safe: true, lens });
        expect(`${t.name} ${t.meta} ${t.lensShort} ${t.tooltip} ${t.aria}`, lens).not.toMatch(/thru|2030|Sep|\d+ (mo|yr)\b|left/);
        expect(t.name, lens).toBe('Sublease');
        expect(t.meta, lens).toMatch(/\$24–\$?26\/SF\/yr FSG$/);
        expect([t.tone, t.pattern], lens).toEqual([lens === 'rent' ? 'rent-0' : 'sublease', 'dots']);
      }
      expect(segmentText(seg, { ...opts, safe: true }).lensShort).toBe('');
    }
  });
});

describe('largest block badge', () => {
  const vacant = [...index.values()].find((s) => s.kind === 'available' && !s.availableFrom)!;

  it('is the first badge of a suite in the building\'s largest block, in words', () => {
    const t = segmentText(vacant, { ...opts, largest: true });
    expect(t.badges[0]).toMatchObject({ kind: 'info', text: 'Largest block' });
    expect(LARGEST_BLOCK).toBe('Largest block');
    // Said where the badge has no room to be drawn: the tooltip and the accessible name.
    expect(t.tooltip).toContain('Largest block');
    expect(t.aria).toContain('Largest block');
  });

  it('is on no other suite', () => {
    for (const s of index.values()) expect(segmentText(s, opts).badges.some((b) => b.text === 'Largest block')).toBe(false);
  });

  it('stays in prospect-safe mode: available space is marketing information', () => {
    const safe = segmentIndex(safeFloors(deriveFloors(property, TODAY, TODAY), true)).get(vacant.key)!;
    expect(segmentText(safe, { ...opts, safe: true, largest: true }).badges[0].text).toBe('Largest block');
  });
});

describe('term: the lease term in a few words, for a narrow block on paper', () => {
  it('names the expiry, a holdover or a month-to-month lease in the lenses that are about dates', () => {
    expect(segmentText(byTenant('Preston Park Café'), opts).term).toBe('Exp Feb \'27');
    expect(segmentText(byTenant('Preston Park Café'), { ...opts, lens: 'expiry' }).term).toBe('Exp Feb \'27');
    expect(segmentText(byTenant('Argosy Partners'), opts).term).toBe('Holdover');
    expect(segmentText(byTenant('Bowline Consulting'), opts).term).toBe('Month-to-month');
  });

  it('is empty in the rent and deals lenses, and wherever lease terms are withheld (prospect-safe)', () => {
    const cafe = byTenant('Preston Park Café');
    expect(segmentText(cafe, { ...opts, lens: 'rent' }).term).toBe('');
    expect(segmentText(cafe, { ...opts, lens: 'deals' }).term).toBe('');
    const safe = segmentIndex(safeFloors(deriveFloors(property, TODAY, TODAY), true)).get(cafe.key)!;
    for (const lens of ['status', 'expiry'] as const) expect(segmentText(safe, { ...opts, safe: true, lens }).term).toBe('');
  });

  it('leaves the on-screen lines as they were', () => {
    const t = segmentText(byTenant('Preston Park Café'), opts);
    expect([t.name, t.sub, t.meta]).toEqual(['Preston Park Café', 'Ste 100 · 2,400 SF', 'Exp Feb 2027 · 3 mo']);
  });
});

describe('plain words on the plan, and no warning chips', () => {
  const all = [...index.values()];
  const texts = (safe: boolean) => all.map((s) => segmentText(s, { ...opts, safe }));

  it('no block names its state in shorthand, and none carries a "Data gap" chip', () => {
    for (const safe of [false, true])
      for (const t of texts(safe)) {
        const words = [t.name, t.meta, ...t.badges.map((b) => b.text)].join(' | ');
        for (const jargon of ['MTM', 'Committed', 'unaccounted', 'Unaccounted', 'Data gap']) expect(words, `${safe ? 'safe ' : ''}${t.name}`).not.toContain(jargon);
      }
  });

  it('a gap in the records reads "No lease or listing", the legend’s name, with its likely tenant; a month-to-month lease says so once', () => {
    const gap = all.find((s) => s.kind === 'unmarketed')!;
    const t = segmentText(gap, opts);
    expect(t.name).toBe('No lease or listing');
    expect(t.sub).toMatch(/· 5,400 SF$/);
    expect(t.meta).toBe('Likely Delta Dental Plan');
    expect(t.badges.map((b) => b.text)).not.toContain('Data gap');
    const mtm = all.find((s) => s.kind === 'mtm')!;
    const m = segmentText(mtm, opts);
    expect([m.meta, ...m.badges.map((b) => b.text)].filter((w) => /month-to-month/i.test(w))).toHaveLength(1);
  });
});

describe('one name for floor area with no lease or listing, per mode (round 23)', () => {
  const today = deriveFloors(property, TODAY, TODAY);
  const NAME = { owner: 'No lease or listing', prospect: 'Not on the market' };

  it('every legend, the block and the inspector heading call it the same thing, with the same dashed swatch', () => {
    for (const safe of [false, true]) {
      const name = safe ? NAME.prospect : NAME.owner;
      const floors = safeFloors(today, safe);
      const gaps = floors.flatMap((f) => f.segments).filter((s) => s.kind === 'unmarketed');
      expect(gaps.length).toBeGreaterThan(0);
      for (const lens of ['status', 'expiry', 'deals', 'rent'] as const) {
        const legend = legendFor(lens, safe, floors);
        for (const gap of gaps) {
          const t = segmentText(gap, { ...opts, safe, lens });
          const where = `${lens}${safe ? ' (safe)' : ''}`;
          expect(t.name, where).toBe(name);
          expect(t.pattern, where).toBe('dashed');
          const item = legend.find((i) => i.tone === t.tone && !i.overlay)!;
          expect(item, where).toMatchObject({ label: name, pattern: 'dashed' });
          expect(t.aria, where).toContain(name);
        }
      }
      expect(gapName(safe)).toBe(name);
    }
  });

  it('Data issues names it as the legend does, on a building with a gap no lease explains', () => {
    const floors = deriveFloors(cedarSprings, TODAY, TODAY);
    const gaps = findIssues(cedarSprings, floors, TODAY).filter((i) => i.id.startsWith('gap-'));
    expect(gaps.length).toBeGreaterThan(0);
    for (const i of gaps) {
      expect(i.title).toMatch(/ SF on Floor \d+ has no lease or listing$/);
      expect(`${i.title} ${i.detail}`).not.toMatch(/unaccounted|not listed/i);
    }
  });
});

describe('a signed lease reached through its Lease Out deal reads as signed in the Pipeline lens (round 23)', () => {
  it('the block says "Signed · Lumen Analytics", keeps its hatch, and never "Lease drafted" beside its Signed badge', () => {
    const seg = index.get('L09-U1')!;
    expect(seg.kind).toBe('committed');
    const t = segmentText(seg, { ...opts, lens: 'deals' });
    expect(t.meta).toBe('Signed · Lumen Analytics');
    expect(t.lensShort).toBe('Signed');
    expect(t.tone).toBe('deal-3');
    expect(t.pattern).toBe('hatch');
    expect(t.tooltip).not.toMatch(/drafted/i);
    expect(legendFor('deals', false, deriveFloors(property, TODAY, TODAY)).find((i) => i.tone === 'deal-3')).toMatchObject({ label: 'Lease signed', pattern: 'hatch' });
  });
});
