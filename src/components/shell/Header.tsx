import type { ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { daysBetween, fmtDate } from '../../domain/dates';
import { num } from '../../domain/format';
import { Button, Chip, Icon, Menu, Switch } from '../ui';
import { AsOfPopover } from './AsOfPopover';

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
  return (
    <header className="sp-card sp-header sp-no-print">
      <div className="sp-header__icon" aria-hidden="true">
        <Icon name="building" size={22} />
      </div>
      <div className="sp-header__text">
        <div className="sp-header__title">
          <h1>Stacking plan</h1>
          <span className="sp-header__property">
            <a href="#property" onClick={(e) => e.preventDefault()} title="Open the Property record">
              {property.name}
            </a>
          </span>
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
          <span className="sp-dot">·</span>
          <span className={`sp-header__verified ${staleDays > 30 || staleRecords ? 'sp-header__verified--stale' : ''}`} title="Most recent change to a lease or availability on this plan; records not re-confirmed in 120 days are listed under Data issues">
            <Icon name={staleRecords ? 'clock' : 'check'} size={12} /> Latest change {fmtDate(verifiedAt)}
            {staleRecords > 0 && (
              <button type="button" className="sp-header__stale" onClick={() => patch({ mode: 'issues', select: null, floor: null })}>
                · {staleRecords} record{staleRecords === 1 ? '' : 's'} stale
              </button>
            )}
          </span>
        </div>
      </div>
      <div className="sp-header__actions">
        <AsOfPopover asOf={state.asOf} today={today} onChange={(asOf) => patch({ asOf })} miniTimeline={miniTimeline} />
        <Switch checked={state.safe} onChange={(safe) => patch({ safe })} label="Prospect-safe" title="Hide tenant names, contacts, rents and prospects" />
        <Button
          icon="warning"
          count={issueTotal}
          active={state.mode === 'issues'}
          onClick={() => patch({ mode: state.mode === 'issues' ? 'building' : 'issues', select: null, floor: null })}
          title={`${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes. Open the list.`}
        >
          Data issues
        </Button>
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
      </div>
    </header>
  );
}
