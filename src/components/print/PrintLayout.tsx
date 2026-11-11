import type { PlanModel, WorklistRow } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtDate, fmtMonths } from '../../domain/dates';
import { num, pct, rate, rateRange, sf, usd, usd0 } from '../../domain/format';
import { RENT_ROLL_NUMERIC, rentRollDisplay, unplacedLeases } from '../../domain/exportCsv';
import { comingSupply } from '../../domain/kpis';
import { canShowDeals, canShowInPlaceRent, canShowIssues, canShowLeaseTerm, canShowRollover, canShowTenantRisk, canShowWalt, marketedFor, rentVisible, tenantLabel } from '../../domain/safe';
import { Legend } from '../plan/Legend';
import StackView from '../stack/StackView';
import { ExportStage } from './ExportStage';
import './print.css';

export interface PrintLayoutProps {
  model: PlanModel;
  state: PlanState;
  /** Show on screen too (for the print emulation screenshot). */
  visible?: boolean;
}

/**
 * Owner-ready report, landscape Letter. Page 1 cover + plan, page 2 rent roll,
 * page 3 rollover and the 12-month renewal worklist. The prospect-safe report has no rollover, no
 * worklist and no lease date anywhere: its page 3 is the space on offer and the coming supply.
 *
 * It also carries the `ExportStage`: like the report, a drawing of the plan that is not on screen
 * (it appears only while an image export asks for it).
 */
export function PrintLayout({ model, state, visible }: PrintLayoutProps) {
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
  const noop = () => {};
  // The owner report lists coming supply under the rollover; the prospect-safe report, which has no
  // worklist, gives it the second column.
  const comingTable = (
    <>
      <h2 style={showRollover ? { marginTop: 14 } : undefined}>Coming supply</h2>
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
  return (
    <>
    <ExportStage model={model} state={state} />
    <div className={`sp-print ${visible ? 'sp-print--visible' : ''}`} aria-hidden={!visible} inert={!visible}>
      <section className="sp-print__page">
        <RunningHead p={p} asOf={model.asOf} safe={safe} page={1} />
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
        <div className="sp-print__plan">
          <StackView model={model} state={state} patch={noop} bare rowHeight={48} />
        </div>
        <footer className="sp-print__foot">
          Floor width is proportional to gross floor area; suite width to RSF. Figures are exact RSF from AscendixRE records. {safe ? 'Tenant names, contacts, in-place rents, lease and sublease dates, WALT and rollover are withheld.' : ''}
        </footer>
      </section>

      <section className="sp-print__page">
        <RunningHead p={p} asOf={model.asOf} safe={safe} page={2} />
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
                {overBy > 0 &&
                  (canShowIssues(safe)
                    ? ` · rows sum to ${num(k.leased + overBy)} SF; ${model.roll.overAllocated.map((o) => `${o.floor} records exceed its leasable area by ${num(o.sf)} SF`).join(', ')}, so leased is capped at ${num(k.leased)} SF`
                    : ` · rows sum to ${num(k.leased + overBy)} SF; leased is capped at the leasable area (${num(k.leased)} SF)`)}
              </td>
            </tr>
          </tbody>
        </table>
        {unplaced > 0 && (
          <p className="sp-print__note" style={{ marginTop: 6 }}>
            {unplaced} lease{unplaced === 1 ? ' is' : 's are'} not placed on the plan (no floor or unit records) and {unplaced === 1 ? 'is' : 'are'} listed above as “Not placed”; see Data issues.
          </p>
        )}
      </section>

      <section className="sp-print__page">
        <RunningHead p={p} asOf={model.asOf} safe={safe} page={3} />
        <div className="sp-print__two">
          <div>
            {showRollover ? (
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
            ) : (
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
            )}
            {showRent && k.rentByType.length > 0 && (
              <>
                <h2 style={{ marginTop: 14 }}>In-place rent by lease type</h2>
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
            )}
            {showRollover && comingTable}
          </div>
          {!showRollover && <div>{comingTable}</div>}
          {showTerms && (
          <div>
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
          </div>
          )}
        </div>
      </section>
    </div>
    </>
  );
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

/** In-place rent of a worklist row; a dash when it is confidential or not on record. */
function rentText(r: WorklistRow, safe: boolean): string {
  const lease = r.seg.lease;
  return lease && rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : '—';
}

const SECTIONS = 3;
function RunningHead({ p, asOf, safe, page, total = SECTIONS }: { p: PlanModel['property']; asOf: string; safe: boolean; page: number; total?: number }) {
  return (
    <div className="sp-print__running">
      <span>
        {p.name} · Stacking plan as of {fmtDate(asOf)}
        {safe ? ' · Prospect-safe' : ''}
      </span>
      <span className="sp-print__pageno">Section {page} of {total}</span>
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
