import type { PlanModel, WorklistRow } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtDate, fmtMonths } from '../../domain/dates';
import { num, pct, rate, sf } from '../../domain/format';
import { rentRollDisplay } from '../../domain/exportCsv';
import { rentVisible, tenantLabel } from '../../domain/safe';
import { Legend } from '../plan/Legend';
import StackView from '../stack/StackView';
import './print.css';

export interface PrintLayoutProps {
  model: PlanModel;
  state: PlanState;
  /** Show on screen too (for the print emulation screenshot). */
  visible?: boolean;
}

/**
 * Owner-ready report, landscape Letter. Page 1 cover + plan, page 2 rent roll,
 * page 3 rollover and the 12-month renewal worklist. Honour prospect-safe everywhere.
 */
export function PrintLayout({ model, state, visible }: PrintLayoutProps) {
  const { property: p, kpis: k, safe } = model;
  const rows = rentRollDisplay(p, model.floors, model.asOf, safe);
  const worklist: WorklistRow[] = model.worklist('12');
  const noop = () => {};
  return (
    <div className={`sp-print ${visible ? 'sp-print--visible' : ''}`} aria-hidden={!visible}>
      <section className="sp-print__page">
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
          <Kpi label="Expiring 12 mo" value={sf(k.expiring12)} note={`${k.expiring12Leases} leases`} />
          <Kpi label="WALT" value={`${k.walt.toFixed(1)} yr`} note="SF-weighted" />
          <Kpi label="Pipeline" value={`${k.pipeline.deals} deals`} note={`${sf(k.pipeline.sf)} in play`} />
        </div>
        <Legend items={model.legend} compact />
        <div className="sp-print__plan">
          <StackView model={model} state={state} patch={noop} bare rowHeight={44} />
        </div>
        <footer className="sp-print__foot">
          Floor width is proportional to gross floor area; suite width to RSF. Figures are exact RSF from AscendixRE records. {safe ? 'Tenant names, contacts and in-place rents are withheld.' : ''}
        </footer>
      </section>

      <section className="sp-print__page">
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
                  <td key={j} className={j === 3 || j === 7 || j === 9 ? 'num' : ''}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sp-print__page">
        <div className="sp-print__two">
          <div>
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
                    <td className="num">{k.leased && b.sf ? pct(b.sf / k.leased) : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td>At risk (holdover, month-to-month)</td>
                  <td className="num">{num(model.roll.atRisk)}</td>
                  <td className="num" colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2>Renewal worklist · next 12 months</h2>
            <table className="sp-print__table sp-print__table--tight">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Floor · Suite</th>
                  <th className="num">RSF</th>
                  <th>Ends</th>
                  <th className="num">Left</th>
                  <th>Rent</th>
                  {!safe && <th>Renewal</th>}
                </tr>
              </thead>
              <tbody>
                {worklist.map((r) => (
                  <tr key={r.segKey}>
                    <td>{tenantLabel({ tenant: r.tenant }, safe)}</td>
                    <td>
                      {r.floorName} · {r.suite}
                    </td>
                    <td className="num">{num(r.size)}</td>
                    <td>{r.endDate ? fmtDate(r.endDate) : 'MTM'}</td>
                    <td className="num">{r.months === null ? '—' : fmtMonths(r.months)}</td>
                    <td>{r.seg.lease && rentVisible(r.seg.lease, safe) && r.seg.lease.rate !== null ? rate(r.seg.lease.rate, r.seg.lease.rateUnit, r.seg.lease.leaseType) : '—'}</td>
                    {!safe && <td>{r.renewal ? r.renewal.stage : '—'}</td>}
                  </tr>
                ))}
                {worklist.length === 0 && (
                  <tr>
                    <td colSpan={7}>No leases end in the next 12 months.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
