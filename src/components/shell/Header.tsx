import type { ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import { isDark, type PlanState } from '../../state/planState';
import { daysBetween, fmtDate } from '../../domain/dates';
import { num, pct, usd, usd0 } from '../../domain/format';
import { Button, Chip, Icon, Menu, Switch, useToastBoundary } from '../ui';
import { canTimeTravel, planDate } from '../../domain/safe';
import { AsOfPopover } from './AsOfPopover';
import { rememberTrigger } from '../../state/focusStore';
import { usePrefersDark } from '../../lib/useMedia';

export type ExportKind = 'pdf' | 'png' | 'csv' | 'link' | 'video';

export interface HeaderProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  onExport: (kind: ExportKind) => void;
  miniTimeline?: ReactNode;
}

export function Header({ model, state, patch, onExport, miniTimeline }: HeaderProps) {
  const { property, kpis, counts, today } = model;
  const verifiedAt = [...property.leases.map((l) => l.verifiedAt), ...property.availabilities.map((a) => a.verifiedAt)].sort().at(-1) ?? property.dataUpdated;
  const staleDays = daysBetween(verifiedAt, today);
  const staleRecords = model.issues.filter((i) => i.id.startsWith('stale-L') || i.id.startsWith('stale-A')).length;
  const issueTotal = model.issues.length;
  // Standalone app (glass skin): the property is the page title and the app owns its theme. Embedded on a
  // record page (classic skin) the host page names the property and sets the theme.
  const standalone = state.skin !== 'classic';
  const prefersDark = usePrefersDark();
  const dark = isDark(state, prefersDark);
  // A toast may name a tenant or a prospect ("Would open Deal D8 (Vantage Robotics)…"): none survives the mode turning on.
  useToastBoundary(state.safe);
  return (
    <header className="sp-card sp-header sp-no-print">
      <div className="sp-header__icon" aria-hidden="true">
        <Icon name="building" size={22} />
      </div>
      <div className="sp-header__text">
        <div className="sp-header__title">
          {standalone ? (
            <>
              <h1>{property.name}</h1>
              <span className="sp-header__property">Stacking plan</span>
            </>
          ) : (
            <>
              <h1>Stacking plan</h1>
              <span className="sp-header__property">
                <a href="#property" onClick={(e) => e.preventDefault()} title="Open the Property record">
                  {property.name}
                </a>
              </span>
            </>
          )}
          {state.safe && (
            <Chip tone="brand" icon="shield">
              Prospect-safe on
            </Chip>
          )}
        </div>
        <div className="sp-header__facts">
          <span>{property.propertyClass}</span>
          <span className="sp-dot">·</span>
          <span>
            {property.street}, {property.city}, {property.state}
          </span>
          <span className="sp-dot">·</span>
          <span>{num(kpis.leasable)} RSF leasable</span>
          <span className="sp-dot">·</span>
          <span>{property.floors.length} floors</span>
          {/* One more fact on the facts row, in the same quiet type: the title leads, the listing does not compete with it. */}
          {property.saleListing &&
            (state.safe ? (
              <span className="sp-header__sale" title="The building is listed for sale; pricing is withheld in prospect-safe mode">
                <Icon name="dollar" size={12} /> Listed for sale
              </span>
            ) : (
              <span className="sp-header__sale" title={`Listed for sale by ${property.saleListing.broker} · ${property.saleListing.status}`}>
                <Icon name="dollar" size={12} />
                <span className="sp-header__sale-label">For sale</span> {usd0(property.saleListing.price)} · {usd(property.saleListing.price / kpis.leasable)}/RSF
                {property.saleListing.capRate !== null ? ` · ${pct(property.saleListing.capRate)} cap` : ''}
              </span>
            ))}
          <span className={`sp-header__verified ${staleDays > 30 || staleRecords ? 'sp-header__verified--stale' : ''}`} title={`Most recent change to a lease or availability on this plan${state.safe ? '' : '; records not re-confirmed in 120 days are listed under Data issues'}`}>
            <Icon name={staleRecords ? 'clock' : 'check'} size={12} /> Latest change {fmtDate(verifiedAt)}
            {staleRecords > 0 && !state.safe && (
              <button type="button" className="sp-header__stale" onClick={() => patch({ mode: 'issues', select: null, floor: null })}>
                {staleRecords} record{staleRecords === 1 ? '' : 's'} stale
              </button>
            )}
          </span>
        </div>
      </div>
      <div className="sp-header__actions">
        {/* The date the plan is drawn for: in prospect-safe mode that is today, whatever was asked for. */}
        <AsOfPopover asOf={planDate(state.asOf, today, state.safe)} today={today} onChange={(asOf) => patch({ asOf })} miniTimeline={miniTimeline} locked={!canTimeTravel(state.safe)} />
        {/* Turning it on drops a search in progress, the worklist, a projected as-of date and any toast: the state layer (applyPatch) and useToastBoundary do it, not this handler. */}
        <Switch checked={state.safe} onChange={(safe) => patch({ safe })} label="Prospect-safe" title="Hide tenant names, contacts, rents, lease dates and prospects, and show the plan as of today" />
        {!state.safe && (
        <Button
          icon="warning"
          count={issueTotal}
          active={state.mode === 'issues'}
          onClick={() => {
            if (state.mode !== 'issues') rememberTrigger();
            patch({ mode: state.mode === 'issues' ? 'building' : 'issues', select: null, floor: null });
          }}
          title={`${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes. Open the list.`}
        >
          Data issues
        </Button>
        )}
        <Menu
          label="Export"
          trigger={(p) => (
            <Button {...p} icon="download" iconRight="chevron-down">
              Export
            </Button>
          )}
          items={[
            { id: 'pdf', label: 'PDF report', icon: 'file', hint: 'Letter, landscape', onSelect: () => onExport('pdf') },
            { id: 'png', label: 'PNG of the plan', icon: 'image', hint: '2× for slides', onSelect: () => onExport('png') },
            { id: 'csv', label: 'Rent roll (CSV)', icon: 'table', hint: 'Opens in Excel', onSelect: () => onExport('csv') },
            { id: 'sep', kind: 'separator' },
            { id: 'video', label: 'Record video', icon: 'video', hint: 'Map view', disabled: state.view !== 'map', onSelect: () => onExport('video') },
            { id: 'link', label: 'Copy link to this view', icon: 'link', onSelect: () => onExport('link') },
          ]}
        />
        {standalone && (
          <Button iconOnly icon={dark ? 'sun' : 'moon'} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} onClick={() => patch({ theme: dark ? 'light' : 'dark' })} />
        )}
      </div>
    </header>
  );
}
