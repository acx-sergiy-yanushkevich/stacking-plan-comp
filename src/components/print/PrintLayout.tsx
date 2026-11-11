import type { ReactNode } from 'react';
import type { PlanModel, WorklistRow } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtDate, fmtMonths } from '../../domain/dates';
import { num, pct, rate, rateRange, sf, usd, usd0 } from '../../domain/format';
import { RENT_ROLL_NUMERIC, rentRollDisplay, unplacedLeases } from '../../domain/exportCsv';
import { comingSupply } from '../../domain/kpis';
import { canShowDeals, canShowInPlaceRent, canShowIssues, canShowLeaseTerm, canShowRollover, canShowTenantRisk, canShowWalt, marketedFor, rentVisible, tenantLabel } from '../../domain/safe';
import { FixedWidth } from '../../lib/useWidth';
import { Legend } from '../plan/Legend';
import StackView from '../stack/StackView';
import { ExportStage } from './ExportStage';
import { LocationBrief } from '../area/LocationBrief';
import type { Area } from '../../domain/types';
import { PLAN_WIDTH, planRowHeight } from './pageFit';
import './print.css';

export interface PrintLayoutProps {
  model: PlanModel;
  state: PlanState;
  /** The area around the building (App's `useArea`): the report ends with its location brief once it has arrived. */
  area?: Area | null;
  /** Show on screen too (for the print emulation screenshot). */
  visible?: boolean;
}

/**
 * Owner-ready report, landscape Letter, as a list of sections (`sections` below).
 *  - Owner: the cover with the plan; the rent roll; the rollover with the 12-month renewal worklist.
 *  - Prospect-safe: the cover with the plan; then one page with the rent roll beside the space on
 *    offer and the coming supply. It has no rollover, no worklist and no lease date anywhere, so what
 *    is left of the third section is short: it shares the rent roll's page instead of taking its own.
 *  - Both end with the location brief (the area around the building), once the area has arrived.
 *
 * The cover is exactly one sheet (`pageFit`, `print.css`). Every later section starts on a new sheet
 * only if it does not fit under the one before. The running head numbers the sections that are in
 * the list, so "Section 2 of 2" is always true of what is printed.
 *
 * It also carries the `ExportStage`: like the report, a drawing of the plan that is not on screen
 * (it appears only while an image export asks for it).
 */
export function PrintLayout({ model, state, area = null, visible }: PrintLayoutProps) {
  const { property: p, kpis: k, safe } = model;
  // The rent roll, the worklist and the supply figures each arrive already passed through the prospect-safe policy.
  const rows = rentRollDisplay(p, model.floors, model.asOf, safe);
  // The worklist names single leases by their term: a prospect-safe report has none (and no lease shows a term at all).
  const showTerms = canShowLeaseTerm(safe);
  const worklist: WorklistRow[] = showTerms ? model.worklist('12') : [];
  // Without the at-risk row, a share of leased SF would let a reader work the at-risk SF out: shares are then of the SF listed.
  const showRisk = canShowTenantRisk(safe);
  // SF and leases ending per period can be matched to suites by their RSF: a prospect-safe report prints neither.
  const showRollover = canShowRollover(safe);
  const atRisk: WorklistRow[] = showRisk ? model.worklist('risk') : [];
  const unplaced = canShowIssues(safe) ? unplacedLeases(p, model.asOf).length : 0;
  const coming = comingSupply(model.floors.flatMap((f) => f.segments), model.asOf, safe);
  const overBy = model.roll.overAllocated.reduce((t, o) => t + o.sf, 0);
  const showDeals = canShowDeals(safe);
  const showRent = canShowInPlaceRent(safe);
  const offers = showRollover ? [] : spaceOnOffer(model);
  // Prospect-safe, on an over-allocated building: the rows under lease add up to more than the leased figure
  // and a floor's suites to more than its 100%. A prospect is shown no data issue, so a neutral footnote
  // says how the exact figures relate, with the sum of the rows as printed (`recordedUnderLease`).
  const recorded = safe && overBy > 0 ? recordedUnderLease(rows) : 0;
  const noop = () => {};
  const comingTable = (
    <>
      <h2>Coming supply</h2>
      <table className="sp-print__table sp-print__table--tight">
        <tbody>
          <tr>
            <td>Occupied, marketed for later</td>
            <td className="num">{coming.sf ? `${num(coming.sf)} SF${coming.from ? ` from ${fmtDate(coming.from)}` : ''}` : '—'}</td>
          </tr>
          <tr>
            <td>Signed, not yet in</td>
            <td className="num">{k.committed ? `${num(k.committed)} SF` : '—'}</td>
          </tr>
          <tr>
            <td>Largest contiguous block now</td>
            <td className="num">{k.maxContiguous.size ? `${num(k.maxContiguous.size)} SF · ${k.maxContiguous.floorName}` : '—'}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
  const cover = (
    <>
      <header className="sp-print__head">
        <div>
          <div className="sp-print__eyebrow">Stacking plan{safe ? ' · Prospect-safe' : ''}</div>
          <h1>{p.name}</h1>
          <div className="sp-print__sub">
            {p.propertyClass} · {p.street}, {p.city}, {p.state} · {num(k.leasable)} RSF leasable · {p.floors.length} floors
          </div>
        </div>
        <div className="sp-print__meta">
          <div>As of {fmtDate(model.asOf)}</div>
          <div>Prepared {fmtDate(model.today)}</div>
          <div>{p.owner}</div>
        </div>
      </header>
      <div className="sp-print__kpis">
        <Kpi label="Leased" value={pct(k.occupancy)} note={`${pct(k.physical)} occupied`} />
        <Kpi label="Available" value={sf(k.availableDirect + k.availableSublease)} note={`${num(k.availableDirect)} direct · ${num(k.availableSublease)} sublease`} />
        <Kpi label="Largest block" value={sf(k.maxContiguous.size)} note={k.maxContiguous.floorName ?? ''} />
        <Kpi label="Expiring 12 mo" value={showRollover ? sf(k.expiring12) : 'Withheld'} note={showRollover ? `${k.expiring12Leases} leases` : 'Prospect-safe'} />
        {/* WALT is made of lease terms only: withheld with them, as on screen. */}
        <Kpi label="WALT" value={canShowWalt(safe) ? `${k.walt.toFixed(2)} yr` : 'Withheld'} note={canShowWalt(safe) ? 'SF-weighted' : 'Prospect-safe'} />
        <Kpi label="Pipeline" value={showDeals ? `${k.pipeline.deals} deals` : 'Withheld'} note={showDeals ? `${sf(k.pipeline.sf)} requested` : 'Prospect-safe'} />
      </div>
      <Legend items={model.legend} compact />
      {/* Drawn at one width on every screen (and when the report is not on screen at all), then scaled to the page. */}
      <div className="sp-print__plan">
        <FixedWidth value={PLAN_WIDTH}>
          <StackView model={model} state={state} patch={noop} bare rowHeight={planRowHeight(model.floors.length)} />
        </FixedWidth>
      </div>
      <footer className="sp-print__foot">
        Floor width is proportional to gross floor area; suite width to RSF. Figures are exact RSF from AscendixRE records.{recorded > 0 ? ' Suite areas are as recorded; floor totals are capped at the floor’s leasable area.' : ''} {safe ? 'Tenant names, contacts, in-place rents, lease and sublease dates, WALT and rollover are withheld.' : ''}
      </footer>
    </>
  );

  const rentRoll = (
    <>
      <h2>Rent roll</h2>
      <table className="sp-print__table">
        <thead>
          <tr>
            {rows[0].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={RENT_ROLL_NUMERIC.has(rows[0][j]) ? 'num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          <tr className="sp-print__total">
            <td colSpan={3}>Total · {num(k.leasable)} RSF leasable</td>
            <td className="num">{num(k.leased)} leased</td>
            <td colSpan={rows[0].length - 4}>
              {pct(k.occupancy)} leased · {num(k.availableDirect + k.availableSublease)} SF available · {num(k.committed)} SF signed, not in
              {/* Why the rows add up to more than the leased figure is a data issue, and an owner's matter:
                  the owner report explains it; a prospect is shown no data issue, on screen or on paper. */}
              {overBy > 0 &&
                canShowIssues(safe) &&
                ` · rows sum to ${num(k.leased + overBy)} SF; ${model.roll.overAllocated.map((o) => `${o.floor} records exceed its leasable area by ${num(o.sf)} SF`).join(', ')}, so leased is capped at ${num(k.leased)} SF`}
            </td>
          </tr>
        </tbody>
      </table>
      {recorded > 0 && (
        <p className="sp-print__note sp-print__note--recorded">
          Suite areas are as recorded: the leased, sublease and committed rows add up to {num(recorded)} SF. Floor totals, and the {num(k.leased)} SF leased, are capped at each floor’s leasable area.
        </p>
      )}
      {unplaced > 0 && (
        <p className="sp-print__note">
          {unplaced} lease{unplaced === 1 ? ' is' : 's are'} not placed on the plan (no floor or unit records) and {unplaced === 1 ? 'is' : 'are'} listed above as “Not placed”; see Data issues.
        </p>
      )}
    </>
  );

  const rolloverTable = (
    <>
      <h2>Lease rollover</h2>
      <p className="sp-print__note">SF of leases ending in each 12-month period from {fmtDate(model.asOf)}.</p>
      <table className="sp-print__table sp-print__table--tight">
        <thead>
          <tr>
            <th>Period</th>
            <th className="num">SF</th>
            <th className="num">Leases</th>
            <th className="num">Share of leased</th>
          </tr>
        </thead>
        <tbody>
          {model.roll.buckets.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              <td className="num">{b.sf ? num(b.sf) : '—'}</td>
              <td className="num">{b.leases || '—'}</td>
              <td className="num">{b.sf ? pct(b.sf / k.leased) : '—'}</td>
            </tr>
          ))}
          {showRisk && (
            <tr>
              <td>At risk (holdover, month-to-month)</td>
              <td className="num">{num(model.roll.atRisk)}</td>
              <td className="num" colSpan={2}></td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );

  const offerTable = (
    <>
      <h2>Space on offer</h2>
      <table className="sp-print__table sp-print__table--tight">
        <thead>
          <tr>
            <th>Floor · Suite</th>
            <th className="num">RSF</th>
            <th>Type</th>
            <th>Available from</th>
            <th>Asking</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.key}>
              <td style={{ whiteSpace: 'nowrap' }}>{o.where}</td>
              <td className="num">{num(o.size)}</td>
              <td>{o.type}</td>
              <td>{o.when}</td>
              <td>{o.asking}</td>
            </tr>
          ))}
          {offers.length === 0 && (
            <tr>
              <td colSpan={5}>No space is on offer.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="sp-print__note">Asking rents carry their unit and lease type. Lease dates, the end date of a sublease, rollover by period and the renewal worklist are withheld from this report.</p>
    </>
  );

  const rentByType = showRent && k.rentByType.length > 0 && (
    <>
      <h2>In-place rent by lease type</h2>
      <table className="sp-print__table sp-print__table--tight">
        <thead>
          <tr>
            <th>Type</th>
            <th className="num">Recorded SF</th>
            <th className="num">Average, weighted by recorded SF</th>
          </tr>
        </thead>
        <tbody>
          {k.rentByType.map((r) => (
            <tr key={r.type}>
              <td>{r.type}</td>
              <td className="num">{num(r.sf)}</td>
              <td className="num">${r.avg.toFixed(2)}/SF/yr</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sp-print__note">
        Recorded SF is the sum of the rent-roll rows with a rent on record{overBy > 0 ? '; the over-allocation cap on leased SF is not applied' : ''}. Confidential leases excluded; never blended across lease types.
      </p>
    </>
  );

  const worklistTable = (
    <>
      <h2>{atRisk.length ? 'Renewal worklist · at risk and next 12 months' : 'Renewal worklist · next 12 months'}</h2>
      <table className="sp-print__table sp-print__table--tight">
        <thead>
          <tr>
            <th>Tenant</th>
            <th style={{ whiteSpace: 'nowrap' }}>Floor · Suite</th>
            <th className="num">RSF</th>
            <th>Ends</th>
            <th className="num">Left</th>
            {showRent && <th>Rent</th>}
            {showDeals && <th>Renewal</th>}
          </tr>
        </thead>
        <tbody>
          {atRisk.map((r) => (
            <tr key={`risk-${r.segKey}`}>
              <td>{r.tenant}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {r.floorName.replace(/^Floor /, 'Fl ')} · {r.suite}
              </td>
              <td className="num">{num(r.size)}</td>
              <td>{r.kind === 'holdover' ? `Holdover · expired ${r.endDate ? fmtDate(r.endDate) : ''}` : 'Month-to-month'}</td>
              <td className="num">—</td>
              {showRent && <td>{rentText(r, safe)}</td>}
              {showDeals && <td>{r.renewal ? r.renewal.stage : '—'}</td>}
            </tr>
          ))}
          {worklist.map((r) => (
            <tr key={r.segKey}>
              <td>{tenantLabel({ tenant: r.tenant }, safe)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {r.floorName.replace(/^Floor /, 'Fl ')} · {r.suite}
              </td>
              <td className="num">{num(r.size)}</td>
              <td>{r.endDate ? fmtDate(r.endDate) : 'MTM'}</td>
              <td className="num">{r.months === null ? '—' : fmtMonths(r.months)}</td>
              {showRent && <td>{rentText(r, safe)}</td>}
              {showDeals && <td>{r.renewal ? r.renewal.stage : '—'}</td>}
            </tr>
          ))}
          {worklist.length === 0 && (
            <tr>
              <td colSpan={5 + (showRent ? 1 : 0) + (showDeals ? 1 : 0)}>No leases end in the next 12 months.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );

  // The report, in the order it is printed. An owner's rollover and worklist fill a page of their own.
  // What a prospect may not see leaves two short tables after the rent roll: they stand beside it.
  const sections: Section[] = showRollover
    ? [
        { key: 'plan', kind: 'plan', body: cover },
        { key: 'roll', body: rentRoll },
        {
          key: 'terms',
          body: (
            <div className="sp-print__two">
              <div>
                {rolloverTable}
                {rentByType}
                {comingTable}
              </div>
              {showTerms && <div>{worklistTable}</div>}
            </div>
          ),
        },
      ]
    : [
        { key: 'plan', kind: 'plan', body: cover },
        {
          key: 'roll',
          body: (
            <div className="sp-print__two sp-print__two--roll">
              <div>{rentRoll}</div>
              <div>
                {offerTable}
                {comingTable}
              </div>
            </div>
          ),
        },
      ];

  // The location brief closes every report, owner and prospect-safe alike: it holds no tenant data.
  if (area) sections.push({ key: 'location', body: <LocationBrief property={p} area={area} print /> });

  return (
    <>
    <ExportStage model={model} state={state} />
    <div className={`sp-print ${visible ? 'sp-print--visible' : ''}`} aria-hidden={!visible} inert={!visible}>
      {sections.map((section, i) => (
        <section key={section.key} className={`sp-print__page ${section.kind === 'plan' ? 'sp-print__page--plan' : ''}`}>
          <RunningHead p={p} asOf={model.asOf} safe={safe} section={i + 1} of={sections.length} />
          {section.body}
        </section>
      ))}
    </div>
    </>
  );
}

/** One section of the report. `plan` is the cover: it is held to exactly one sheet. */
interface Section {
  key: string;
  kind?: 'plan';
  body: ReactNode;
}

interface Offer {
  key: string;
  where: string;
  size: number;
  type: string;
  when: string;
  asking: string;
}

/**
 * Every space a prospect can take, top floor first: vacant direct space, sublease space, units for
 * sale and occupied suites with a published listing for a later date. Built from the model's floors,
 * which in prospect-safe mode hold no quiet listing and no sublease end date, so a sublease is listed
 * like any other space: from when, and at what asking rent.
 */
function spaceOnOffer(model: PlanModel): Offer[] {
  const out: Offer[] = [];
  for (const f of model.floors) {
    for (const s of f.segments) {
      const where = `${f.floor.name.replace(/^Floor /, 'Fl ')}${s.suite ? ` · ${s.suite}` : ''}`;
      const a = s.availability;
      if (a && s.kind === 'forsale') {
        out.push({ key: s.key, where, size: s.size, type: 'For sale', when: 'Now', asking: a.askingPrice ? `${usd0(a.askingPrice)} · ${usd(a.askingPrice / s.size)}/SF` : '—' });
      } else if (a && (s.kind === 'available' || s.kind === 'sublease')) {
        const when = s.kind === 'sublease' ? (a.availableFrom && a.availableFrom > model.asOf ? fmtDate(a.availableFrom) : 'Now') : s.availableFrom ? fmtDate(s.availableFrom) : 'Now';
        out.push({ key: s.key, where, size: s.size, type: s.kind === 'sublease' ? 'Sublease' : 'Direct', when, asking: a.rentHigh > 0 ? rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType) : '—' });
      }
      const m = marketedFor(s, model.safe);
      if (m && m.kind === 'Lease') {
        out.push({ key: `${s.key}-later`, where, size: m.size, type: m.sublease ? 'Sublease' : 'Direct', when: m.availableFrom ? fmtDate(m.availableFrom) : 'Later', asking: m.rentHigh > 0 ? rateRange(m.rentLow, m.rentHigh, m.rateUnit, m.leaseType) : '—' });
      }
    }
  }
  return out;
}

/** The states of a prospect-safe rent-roll row that are space under lease: in place, sublet, signed and not yet in. */
const UNDER_LEASE = new Set(['Leased', 'Sublease', 'Committed']);

/** Exact sum of the RSF of the rent-roll rows under lease, read from the rows as they are printed. */
export function recordedUnderLease(rows: ReadonlyArray<ReadonlyArray<string>>): number {
  const rsf = rows[0].indexOf('RSF');
  const state = rows[0].indexOf('State');
  return rows.slice(1).reduce((t, r) => (UNDER_LEASE.has(r[state]) ? t + (Number(r[rsf].replace(/,/g, '')) || 0) : t), 0);
}

/** In-place rent of a worklist row; a dash when it is confidential or not on record. */
function rentText(r: WorklistRow, safe: boolean): string {
  const lease = r.seg.lease;
  return lease && rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : '—';
}

/** The line above every section. `of` is the number of sections in the report that is printed, not a fixed count. */
function RunningHead({ p, asOf, safe, section, of }: { p: PlanModel['property']; asOf: string; safe: boolean; section: number; of: number }) {
  return (
    <div className="sp-print__running">
      <span>
        {p.name} · Stacking plan as of {fmtDate(asOf)}
        {safe ? ' · Prospect-safe' : ''}
      </span>
      <span className="sp-print__pageno">Section {section} of {of}</span>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="sp-print__kpi">
      <div className="sp-print__kpi-label">{label}</div>
      <div className="sp-print__kpi-value">{value}</div>
      <div className="sp-print__kpi-note">{note}</div>
    </div>
  );
}
