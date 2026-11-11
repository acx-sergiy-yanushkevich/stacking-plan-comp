import type { ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import { isDark, paletteOf, type PlanState } from '../../state/planState';
import { daysBetween, fmtDate } from '../../domain/dates';
import { num, pct, usd, usd0 } from '../../domain/format';
import { Button, Chip, Icon, Menu, Switch, useToastBoundary } from '../ui';
import { paletteMenuItems } from './paletteMenu';
import { switcherItems } from './switcher';
import { MiniStack, StaxLockup } from './Brand';
import { LIVE_STACK } from '../../data/mock/portfolio';
import { canTimeTravel, planDate } from '../../domain/safe';
import { AsOfPopover } from './AsOfPopover';
import { useIsPhone, useMedia, usePrefersDark } from '../../lib/useMedia';

const SAFE_TITLE = 'Hide tenant names, contacts, rents, lease dates and prospects, and show the plan as of today';

export type ExportKind = 'pdf' | 'png' | 'csv' | 'link' | 'video';

export interface HeaderProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
  onExport: (kind: ExportKind) => void;
  miniTimeline?: ReactNode;
}

export function Header({ model, state, patch, onExport, miniTimeline }: HeaderProps) {
  const { property, kpis, today } = model;
  const verifiedAt = [...property.leases.map((l) => l.verifiedAt), ...property.availabilities.map((a) => a.verifiedAt)].sort().at(-1) ?? property.dataUpdated;
  const staleDays = daysBetween(verifiedAt, today);
  // Standalone app (glass skin): the product bar names the product and the building, and the app owns its
  // theme. Embedded on a record page (classic skin) the host page names the property and sets the theme:
  // there is no bar, and the card keeps the controls.
  const standalone = state.skin !== 'classic';
  const prefersDark = usePrefersDark();
  const dark = isDark(state, prefersDark);
  // The two palettes belong to the default skin; `skin=aurora` has colours of its own and offers no choice.
  const palette = paletteOf(state);
  // A phone has no row to spare for how the plan looks: there the palette and the theme are a menu beside Export.
  const phone = useIsPhone();
  // A phone of 420 px or less: one row of controls. The date is an icon and the date, the switch says
  // "Safe" and Export drops its chevron, because the full-size controls do not fit 352 px, nor 322 at 360.
  const compact = useMedia('(max-width: 420px)');
  const themeLabel = dark ? 'Switch to light theme' : 'Switch to dark theme';
  const toggleTheme = () => patch({ theme: dark ? 'light' : 'dark' });
  // A toast may name a tenant or a prospect ("Would open Deal D8 (Vantage Robotics)…"): none survives the mode turning on.
  useToastBoundary(state.safe);

  const actions = (
    <div className="sp-header__actions">
      {/* The date the plan is drawn for: in prospect-safe mode that is today, whatever was asked for. */}
      <AsOfPopover asOf={planDate(state.asOf, today, state.safe)} today={today} onChange={(asOf) => patch({ asOf })} miniTimeline={miniTimeline} locked={!canTimeTravel(state.safe)} compact={compact} plain={standalone} />
      {/* Turning it on drops a search in progress, the worklist, a projected as-of date and any toast: the state layer (applyPatch) and useToastBoundary do it, not this handler. */}
      {standalone ? (
        // The product bar: a text button like its neighbours, still a switch to assistive technology. Pressed,
        // it takes the brand fill: that is what says the mode is on, so the bar needs no chip beside it.
        <button type="button" role="switch" aria-checked={state.safe} className="sp-btn sp-btn--neutral sp-safe" title={SAFE_TITLE} onClick={() => patch({ safe: !state.safe })}>
          <Icon name="contrast" size={16} />
          {compact ? (
            <>
              <span className="sp-sr-only">Prospect-safe</span>
              <span aria-hidden="true">Safe</span>
            </>
          ) : (
            'Prospect-safe'
          )}
        </button>
      ) : (
        <Switch checked={state.safe} onChange={(safe) => patch({ safe })} label="Prospect-safe" shortLabel={compact ? 'Safe' : undefined} title={SAFE_TITLE} />
      )}
      {/* The embedded skin: the slot that says prospect-safe is on. It is drawn at one width whether the chip is in
          it or not, so the controls wrap at the same point and the header is the same height with the mode on and off. */}
      {!standalone && !compact && (
        <div className="sp-header__slot">
          {state.safe && (
            <Chip tone="brand" icon="shield" title="Tenant names, contacts, rents, lease dates and prospects are hidden">
              Prospect-safe on
            </Chip>
          )}
        </div>
      )}
      <Menu
        label="Export"
        trigger={(p) => (
          <Button {...p} icon={standalone && !compact ? undefined : 'download'} iconRight={compact ? undefined : standalone ? 'caret-down' : 'chevron-down'}>
            <span className="sp-header__export-label">Export</span>
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
      {/* A phone: the same two controls as a menu, on the row the other controls already take. */}
      {standalone && phone && (
        <Menu
          label="Colors and theme"
          trigger={(p) => <Button {...p} iconOnly icon="more" aria-label="Colors and theme" title="Colors and theme" />}
          items={[
            ...(palette ? [...paletteMenuItems(palette, patch), { kind: 'separator' as const, id: 'look-sep' }] : []),
            { id: 'theme', label: themeLabel, icon: dark ? ('sun' as const) : ('moon' as const), onSelect: toggleTheme },
          ]}
        />
      )}
    </div>
  );

  // How the plan looks, apart from what it shows: the palette and the theme. Both are state like any
  // other, written to the URL, so a link opens in the colours it was copied in.
  const look = standalone && !phone && (
    <div className="sp-header__look">
      {palette && <Menu label="Colors" trigger={(p) => <Button {...p} iconOnly icon="palette" aria-label="Colors" title="Colors" />} items={paletteMenuItems(palette, patch)} />}
      <Button iconOnly icon={dark ? 'sun' : 'moon'} aria-label={themeLabel} title={dark ? 'Light theme' : 'Dark theme'} onClick={toggleTheme} />
    </div>
  );

  const facts = (
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
      <span className={`sp-header__verified ${staleDays > 30 ? 'sp-header__verified--stale' : ''}`} title="Most recent change to a lease or availability on this plan">
        <Icon name={staleDays > 30 ? 'clock' : 'check'} size={12} /> Latest change {fmtDate(verifiedAt)}
      </span>
    </div>
  );

  if (!standalone)
    return (
      <header className="sp-card sp-header sp-header--classic sp-no-print">
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
          </div>
          {facts}
        </div>
        {actions}
      </header>
    );

  return (
    <>
      {/* The product bar: who made this, which building is open (and that there are others), and the controls. */}
      <div className="sp-card sp-topbar sp-no-print">
        <StaxLockup />
        <span className="sp-topbar__divider" aria-hidden="true" />
        <Menu
          label="Building"
          align="start"
          trigger={(p) => (
            <Button {...p} iconRight="caret-down" aria-label={`Switch building: ${property.name}`} title="Switch building" className="sp-switcher">
              <MiniStack drawing={LIVE_STACK} />
              <span className="sp-switcher__name">{property.name}</span>
            </Button>
          )}
          items={switcherItems(property)}
        />
        {/* The controls and the look as one group at the right: they wrap together, never one button alone. */}
        <div className="sp-topbar__controls">
          {actions}
          {look}
        </div>
      </div>
      <header className="sp-card sp-header sp-no-print">
        <div className="sp-header__icon" aria-hidden="true">
          <Icon name="building" size={22} />
        </div>
        <div className="sp-header__text">
          <div className="sp-header__title">
            <h1>{property.name}</h1>
          </div>
          {facts}
        </div>
      </header>
    </>
  );
}
