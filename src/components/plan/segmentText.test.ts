import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import { badgeLabel, segmentText } from './segmentText';

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

  it('a sublet suite keeps the sublease end, which is part of the offer, and drops the head lease term', () => {
    const sub = floors.flatMap((f) => f.segments).find((s) => s.kind === 'sublease')!;
    for (const seg of [sub, projected.get(sub.key)!]) {
      expect(segmentText(seg, { ...opts, safe: true }).meta).toBe('Sublease thru Sep 2030');
      expect(segmentText(seg, { ...opts, safe: true, lens: 'expiry' }).meta).toBe('Sublease thru Sep 2030');
      expect(segmentText(seg, { ...opts, safe: true }).lensShort).toBe('');
    }
  });
});
