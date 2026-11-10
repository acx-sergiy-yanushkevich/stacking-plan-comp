import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, segmentIndex } from '../../domain/derive';
import type { LensId } from '../../domain/lenses';
import { blockLayout } from '../../domain/layout';
import { wrapWordsVar } from '../../lib/textFit';
import { focusFacts } from './focusFacts';
import { segmentText } from './segmentText';

const floors = deriveFloors(property, TODAY, TODAY);
const index = segmentIndex(floors);
const LENSES: LensId[] = ['status', 'expiry', 'deals', 'rent'];
const rate = (t: string) => /\$[\d.,–-]+\S*/.exec(t)?.[0] ?? null;

describe('focusFacts', () => {
  it('never repeats a fact the block already shows, in any lens', () => {
    for (const lens of LENSES) {
      for (const [, seg] of index) {
        const opts = { safe: false, asOf: TODAY, today: TODAY, floorName: 'Floor' };
        const own = segmentText(seg, { ...opts, lens });
        const facts = focusFacts(seg, lens, opts);
        expect(new Set(facts).size).toBe(facts.length);
        for (const f of facts) {
          expect(`${own.sub} ${own.meta}`).not.toContain(f);
          const k = rate(f);
          if (k) expect(own.meta).not.toContain(k);
        }
        const rates = facts.map(rate).filter(Boolean);
        expect(new Set(rates).size).toBe(rates.length);
      }
    }
  });

  it('shows the asking rent of an availability once in the status lens', () => {
    const a02 = index.get('A02')!;
    const opts = { safe: false, asOf: TODAY, today: TODAY, floorName: 'Floor 3' };
    expect(segmentText(a02, { ...opts, lens: 'status' }).meta).toContain('$30–$32');
    expect(focusFacts(a02, 'status', opts).some((f) => f.includes('$30–$32'))).toBe(false);
  });

  it('adds a deal line only where a live deal exists', () => {
    const opts = { safe: false, asOf: TODAY, today: TODAY, floorName: 'Floor' };
    const cirrus = index.get('L13-U1')!; // LOI with Vantage Robotics
    expect(focusFacts(cirrus, 'status', opts).some((f) => f.includes('Vantage Robotics'))).toBe(true);
    const anadarko = index.get('L18-U1')!;
    expect(focusFacts(anadarko, 'expiry', opts).every((f) => !/^Exp /.test(f))).toBe(true);
  });

  it('adds no rent, deal or name in prospect-safe mode', () => {
    const names = property.leases.map((l) => l.tenant);
    for (const lens of LENSES.filter((l) => l !== 'deals')) {
      for (const [, seg] of index) {
        const facts = focusFacts(seg, lens, { safe: true, asOf: TODAY, today: TODAY, floorName: 'Floor' });
        for (const f of facts) {
          expect(names.some((n) => f.includes(n))).toBe(false);
          if (seg.kind !== 'available' && seg.kind !== 'sublease' && seg.kind !== 'forsale') expect(f).not.toContain('$');
        }
      }
    }
  });
});

describe('stack layout helpers', () => {
  it('keeps every suite at or above the desktop minimum when the floor has room', () => {
    for (const f of floors) {
      if (f.segments.length * 124 + 2 * (f.segments.length - 1) > 830) continue;
      for (const b of blockLayout(f.segments, 830, 124, 2)) expect(b.w).toBeGreaterThanOrEqual(124);
    }
  });

  it('wraps a name around a shorter first line', () => {
    const font = "600 13px Inter";
    const lines = wrapWordsVar('Conner CPA Group', (i) => (i === 0 ? 60 : 120), font, 2);
    expect(lines.join(' ')).toBe('Conner CPA Group');
    expect(lines[0]).toBe('Conner');
    expect(wrapWordsVar('Supercalifragilistic Holdings', () => 40, font, 2)).toEqual([]);
  });
});
