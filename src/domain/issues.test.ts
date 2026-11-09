import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { findIssues, issueCounts, recentChanges, STALE_DAYS } from './issues';
import type { Property } from './types';

const floors = deriveFloors(property, TODAY, TODAY);
const issues = findIssues(property, floors, TODAY);
const ids = issues.map((i) => i.id);
const byId = (id: string) => issues.find((i) => i.id === id)!;

describe('findIssues on the mock today', () => {
  it('reports leases that cannot be drawn', () => {
    expect(ids).toContain('nounits-L05');
    expect(byId('nounits-L05').severity).toBe('error');
    expect(byId('nounits-L05').segKey).toBe('F2-gap');
    expect(ids).toContain('nofloor-L20');
    expect(byId('nofloor-L20').severity).toBe('error');
  });
  it('reports the unplaced availability', () => {
    expect(ids).toContain('afloor-A09');
    expect(byId('afloor-A09').severity).toBe('warning');
  });
  it('reports the over-allocated floor', () => {
    expect(ids).toContain('over-F7');
    expect(byId('over-F7').severity).toBe('error');
    expect(byId('over-F7').title).toBe('Floor 7 is over-allocated by 500 SF');
  });
  it('reports holdover and month-to-month tenants', () => {
    expect(ids).toContain('hold-L06-U1');
    expect(byId('hold-L06-U1').severity).toBe('warning');
    expect(ids).toContain('mtm-L04-U1');
    expect(byId('mtm-L04-U1').severity).toBe('info');
  });
  it('has no vacant-on-leased conflicts, orphan subleases, gaps or occupied for-sale units', () => {
    expect(ids.filter((id) => id.startsWith('conflict-'))).toEqual([]);
    expect(ids.filter((id) => id.startsWith('orphan-'))).toEqual([]);
    expect(ids.filter((id) => id.startsWith('gap-'))).toEqual([]);
    expect(ids.filter((id) => id.startsWith('forsale-occupied-'))).toEqual([]);
  });
  it('flags the lease not verified for more than STALE_DAYS days (Bowline, Jun 2026)', () => {
    expect(STALE_DAYS).toBe(120);
    const stale = byId('stale-L04');
    expect(stale).toBeDefined();
    expect(stale.severity).toBe('info');
    expect(stale.title).toBe('Bowline Consulting lease not verified since Jun 2, 2026');
    expect(stale.fix).toBe('Verify lease');
    expect(stale.segKey).toBe('L04-U1');
    expect(stale.floorId).toBe('F2');
  });
  it('does not flag recently verified records', () => {
    expect(ids).not.toContain('stale-L13'); // verified 2026-11-06
    expect(ids.filter((id) => /^stale-A\d+$/.test(id))).toEqual([]); // all availabilities verified Oct–Nov 2026
  });
  it('flags the untouched Harbor Freight tour as a stale deal', () => {
    const harbor = issues.find((i) => i.id.startsWith('stale-D') && i.recordLabel.includes('Harbor Freight'))!;
    expect(harbor).toBeDefined();
    expect(harbor.title).toBe('Harbor Freight Regional HQ deal not updated since Oct 9, 2026');
    expect(harbor.segKey).toBe('L13-U1');
  });
  it('sorts errors, then warnings, then info', () => {
    const rank = { error: 0, warning: 1, info: 2 };
    const ranks = issues.map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(issues[0].severity).toBe('error');
    expect(issues.at(-1)!.severity).toBe('info');
  });
  it('counts by severity to the total', () => {
    const c = issueCounts(issues);
    expect(c.error + c.warning + c.info).toBe(issues.length);
    expect(c.error).toBe(3); // nounits-L05, nofloor-L20, over-F7
    expect(c.warning).toBe(2); // afloor-A09, hold-L06-U1
    expect(issueCounts([])).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe('findIssues on edited data', () => {
  it('warns when a for-sale unit is still covered by an active lease', () => {
    const edited: Property = {
      ...property,
      availabilities: property.availabilities.map((a) => (a.id === 'A10' ? { ...a, suite: '100', order: 1 } : a)),
    };
    const found = findIssues(edited, deriveFloors(edited, TODAY, TODAY), TODAY);
    const issue = found.find((i) => i.id === 'forsale-occupied-A10')!;
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(issue.title).toBe('Suite 100 is offered for sale but Preston Park Café still leases it');
    expect(issue.segKey).toBe('L01-U1');
    expect(found.map((i) => i.id)).not.toContain('conflict-A10');
  });
  it('flags an open availability not verified for more than STALE_DAYS days, but not a closed one', () => {
    const edited: Property = {
      ...property,
      availabilities: property.availabilities.map((a) =>
        a.id === 'A08' || a.id === 'A03' ? { ...a, verifiedAt: '2026-05-01' } : a,
      ),
    };
    const found = findIssues(edited, deriveFloors(edited, TODAY, TODAY), TODAY);
    const stale = found.find((i) => i.id === 'stale-A08')!;
    expect(stale).toBeDefined();
    expect(stale.severity).toBe('info');
    expect(stale.title).toBe('Suite 1250 availability not verified since May 1, 2026');
    expect(stale.fix).toBe('Verify availability');
    expect(stale.segKey).toBe('A08');
    expect(stale.floorId).toBe('F12');
    expect(found.map((i) => i.id)).not.toContain('stale-A03');
  });
  it('treats exactly STALE_DAYS days as still verified', () => {
    const edited: Property = {
      ...property,
      leases: property.leases.map((l) => (l.id === 'L13' ? { ...l, verifiedAt: '2026-07-12' } : l)), // 120 days before TODAY
    };
    const found = findIssues(edited, deriveFloors(edited, TODAY, TODAY), TODAY);
    expect(found.map((i) => i.id)).not.toContain('stale-L13');
  });
});

describe('recentChanges', () => {
  it('returns every row of the 30-day mock history, newest first', () => {
    const rows = recentChanges(property, TODAY);
    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.id)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9']);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].at >= rows[i].at).toBe(true);
  });
  it('narrows to the last 7 days (2026-11-02 or later)', () => {
    const rows = recentChanges(property, TODAY, 7);
    expect(rows).toHaveLength(3); // H1 11-06, H2 11-05, H3 11-04; H4 is 11-01
    expect(rows.every((r) => r.at >= '2026-11-02')).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(['H1', 'H2', 'H3']);
  });
  it('sorts an unsorted history and ignores rows after today', () => {
    const shuffled: Property = {
      ...property,
      history: [property.history[4], { ...property.history[0], id: 'HX', at: '2026-11-12' }, property.history[0], property.history[8]],
    };
    expect(recentChanges(shuffled, TODAY).map((r) => r.id)).toEqual(['H1', 'H5', 'H9']);
  });
});
