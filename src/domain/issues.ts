import type { Change, ISODate, Lease, Property } from './types';
import { daysBetween, fmtDate } from './dates';
import { activeDeals, isLeaseKind, type FloorView } from './derive';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface Issue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  fix: string;
  floorId?: string;
  segKey?: string;
  recordLabel: string;
}

/** A plan record whose LastModifiedDate is older than this many days is reported as unverified. */
export const STALE_DAYS = 120;

const n = (x: number) => x.toLocaleString('en-US');

const RANK: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Data-quality checks: the research coordinator's "what's wrong?" list, errors first. */
export function findIssues(p: Property, floors: FloorView[], today: ISODate): Issue[] {
  const issues: Issue[] = [];
  const floorName = (id: string | null) => p.floors.find((f) => f.id === id)?.name ?? '—';
  const segments = floors.flatMap((f) => f.segments);

  // Leases that cannot be drawn.
  for (const l of p.leases) {
    if (l.units.length > 0) continue;
    issues.push(
      l.floorId
        ? {
            id: `nounits-${l.id}`,
            severity: 'error',
            title: `${l.tenant} is missing from the plan`,
            detail: `Lease is on ${floorName(l.floorId)} but has no Unit records, so it cannot be drawn. Unaccounted area on that floor may be its space.`,
            fix: 'Add unit',
            floorId: l.floorId,
            segKey: `${l.floorId}-gap`,
            recordLabel: `Lease · ${l.tenant}`,
          }
        : {
            id: `nofloor-${l.id}`,
            severity: 'error',
            title: `${l.tenant} has no floor`,
            detail: 'Lease has no Floor and no Unit records.',
            fix: 'Assign floor',
            recordLabel: `Lease · ${l.tenant}`,
          },
    );
  }

  // Marketed space that cannot be placed.
  for (const a of p.availabilities) {
    if (!a.floorId && a.status === 'Open') {
      issues.push({
        id: `afloor-${a.id}`,
        severity: 'warning',
        title: `Availability ${a.suite} (${n(a.size)} SF) has no floor`,
        detail: 'It is marketed but cannot be placed on the plan.',
        fix: 'Assign floor',
        recordLabel: `Availability · ${a.suite}`,
      });
    }
  }

  for (const f of floors) {
    if (f.overAllocatedBy > 0) {
      issues.push({
        id: `over-${f.floor.id}`,
        severity: 'error',
        title: `${f.floor.name} is over-allocated by ${n(f.overAllocatedBy)} SF`,
        detail: `Leases and availabilities add up to more than the ${n(f.leasable)} SF leasable area. Occupancy is capped at 100%.`,
        fix: 'Review floor',
        floorId: f.floor.id,
        recordLabel: `Floor · ${f.floor.name}`,
      });
    }
    for (const s of f.segments) {
      if (s.kind === 'unmarketed' && !s.suspect) {
        issues.push({
          id: `gap-${f.floor.id}`,
          severity: 'warning',
          title: `${n(s.size)} SF on ${f.floor.name} is unaccounted for`,
          detail: 'No lease or availability covers this area.',
          fix: 'Create availability',
          floorId: f.floor.id,
          segKey: s.key,
          recordLabel: `Floor · ${f.floor.name}`,
        });
      }
      if (s.kind === 'holdover' && s.lease) {
        issues.push({
          id: `hold-${s.key}`,
          severity: 'warning',
          title: `${s.lease.tenant} is in holdover`,
          detail: `Lease expired ${fmtDate(s.lease.expiration!)} and no termination date is recorded.`,
          fix: 'Update lease',
          floorId: f.floor.id,
          segKey: s.key,
          recordLabel: `Lease · ${s.lease.tenant}`,
        });
      }
      if (s.kind === 'mtm' && s.lease) {
        issues.push({
          id: `mtm-${s.key}`,
          severity: 'info',
          title: `${s.lease.tenant} is month-to-month`,
          detail: 'No expiration date. Counted as 0 years in WALT and shown as At risk, not in a rollover year.',
          fix: 'Open lease',
          floorId: f.floor.id,
          segKey: s.key,
          recordLabel: `Lease · ${s.lease.tenant}`,
        });
      }
      const m = s.marketed;
      if (m && isLeaseKind(s.kind)) {
        if (m.kind === 'Sale') {
          // A condo offered for sale while a tenant still leases the suite: the listing is likely wrong.
          issues.push({
            id: `forsale-occupied-${m.id}`,
            severity: 'warning',
            title: `Suite ${m.suite} is offered for sale but ${s.lease?.tenant} still leases it`,
            detail: 'A Sale availability covers a suite with an active lease, so it is drawn as leased, not for sale.',
            fix: 'Review listing',
            floorId: f.floor.id,
            segKey: s.key,
            recordLabel: `Availability · ${m.suite}`,
          });
        } else if (m.isVacant) {
          // An availability flagged vacant on top of an active lease: the plan and the portal disagree.
          issues.push({
            id: `conflict-${m.id}`,
            severity: 'error',
            title: `Suite ${m.suite} is marked vacant but ${s.lease?.tenant} still leases it`,
            detail: 'Availability says Is Vacant, but an active lease covers the suite.',
            fix: 'Fix availability',
            floorId: f.floor.id,
            segKey: s.key,
            recordLabel: `Availability · ${m.suite}`,
          });
        }
      }
    }
  }

  for (const f of floors) {
    for (const a of f.orphanSubleases) {
      issues.push({
        id: `orphan-${a.id}`,
        severity: 'error',
        title: `Sublease ${a.suite} has no lease to sublet from`,
        detail: `Sublease availability on ${f.floor.name} does not match any leased suite, so it is not shown.`,
        fix: 'Fix availability',
        floorId: f.floor.id,
        recordLabel: `Availability · ${a.suite}`,
      });
    }
  }

  // Stale pipeline: open deals untouched for 30+ days.
  for (const s of segments) {
    const renewals = isLeaseKind(s.kind) ? (s.lease?.deals ?? []) : [];
    for (const d of activeDeals([...(s.availability?.deals ?? []), ...(s.marketed?.deals ?? []), ...renewals])) {
      if (daysBetween(d.updated, today) >= 30) {
        issues.push({
          id: `stale-${d.id}`,
          severity: 'info',
          title: `${d.prospect} deal not updated since ${fmtDate(d.updated)}`,
          detail: `${d.stage} on suite ${s.suite}. Confirm the deal is still live.`,
          fix: 'Open deal',
          floorId: s.floorId,
          segKey: s.key,
          recordLabel: `Deal · ${d.name}`,
        });
      }
    }
  }

  // Stale records: leases on the plan and open availabilities not verified for STALE_DAYS+.
  const isStale = (verifiedAt: ISODate) => daysBetween(verifiedAt, today) > STALE_DAYS;
  const rendered = new Map<string, Lease>();
  for (const s of segments) {
    if (s.lease && s.kind !== 'available') rendered.set(s.lease.id, s.lease);
    if (s.next) rendered.set(s.next.lease.id, s.next.lease);
  }
  for (const l of rendered.values()) {
    if (!isStale(l.verifiedAt)) continue;
    const unit = l.units[0];
    issues.push({
      id: `stale-${l.id}`,
      severity: 'info',
      title: `${l.tenant} lease not verified since ${fmtDate(l.verifiedAt)}`,
      detail: `Last modified ${n(daysBetween(l.verifiedAt, today))} days ago. Records older than ${STALE_DAYS} days should be re-confirmed with the tenant or the lease file.`,
      fix: 'Verify lease',
      floorId: l.floorId ?? unit?.floorId,
      segKey: unit?.id,
      recordLabel: `Lease · ${l.tenant}`,
    });
  }
  for (const a of p.availabilities) {
    if (a.status !== 'Open' || !isStale(a.verifiedAt)) continue;
    issues.push({
      id: `stale-${a.id}`,
      severity: 'info',
      title: `Suite ${a.suite} availability not verified since ${fmtDate(a.verifiedAt)}`,
      detail: `Last modified ${n(daysBetween(a.verifiedAt, today))} days ago. Confirm the space, size and asking rent are still current.`,
      fix: 'Verify availability',
      floorId: a.floorId ?? undefined,
      segKey: a.id,
      recordLabel: `Availability · ${a.suite}`,
    });
  }

  // Array.prototype.sort is stable: insertion order is kept within a severity.
  return issues.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

export function issueCounts(issues: Issue[]): { error: number; warning: number; info: number } {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity] += 1;
  return counts;
}

/** Field History rows dated within the last `days` days (up to today), newest first. */
export function recentChanges(p: Property, today: ISODate, days = 30): Change[] {
  return p.history
    .filter((c) => {
      const age = daysBetween(c.at, today);
      return age >= 0 && age <= days;
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
