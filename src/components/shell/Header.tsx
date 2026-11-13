import type { ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import { isDark, paletteOf, switchBuilding, type PlanState } from '../../state/planState';
import { fmtDate } from '../../domain/dates';
import { num } from '../../domain/format';
import { listingWords } from '../../domain/listing';
import { Button, Chip, Icon, Menu, Switch, useToastBoundary } from '../ui';
import type { MenuItem } from '../ui/Menu';
import { paletteMenuItems } from './paletteMenu';
import { switcherItems } from './switcher';
import { MiniStack, StaxLockup } from './Brand';
import { buildingById } from '../../data/mock/buildings';
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
  const moreLabel = compact ? 'Export, colors and theme' : 'Colors and theme';
  const themeLabel = dark ? 'Switch to light theme' : 'Switch to dark theme';
  const toggleTheme = () => patch({ theme: dark ? 'light' : 'dark' });
  // A toast may name a tenant or a prospect ("Would open Deal D8 (Vantage Robotics)…"): none survives the mode turning on.
  useToastBoundary(state.safe);

  const exportItems: MenuItem[] = [
    { id: 'pdf', label: 'PDF report', icon: 'file', hint: 'Letter, landscape', onSelect: () => onExport('pdf') },
    { id: 'png', label: 'PNG of the plan', icon: 'image', hint: '2× for slides', onSelect: () => onExport('png') },
    { id: 'csv', label: 'Rent roll (CSV)', icon: 'table', hint: 'Opens in Excel', onSelect: () => onExport('csv') },
    { id: 'sep', kind: 'separator' },
    { id: 'video', label: 'Record video', icon: 'video', hint: 'Map view', disabled: state.view !== 'map', onSelect: () => onExport('video') },
    { id: 'link', label: 'Copy link to this view', icon: 'link', onSelect: () => onExport('link') },
  ];

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
              <span className="sp-safe__word" aria-hidden="true">Safe</span>
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
      {/* A phone of 420 px or less: Export is in the "…" menu, so the bar is one row. */}
      {!(standalone && compact) && (
        <Menu
          label="Export"
          trigger={(p) => (
            <Button {...p} icon={standalone && !compact ? undefined : 'download'} iconRight={compact ? undefined : standalone ? 'caret-down' : 'chevron-down'}>
              <span className="sp-header__export-label">Export</span>
            </Button>
          )}
          items={exportItems}
        />
      )}
      {/* A phone: the look controls as a menu, on the row the other controls already take; at 420 px and
          under, Export joins them, so the bar is one row (round 19). */}
      {standalone && phone && (
        <Menu
          label={moreLabel}
          trigger={(p) => <Button {...p} iconOnly icon="more" aria-label={moreLabel} title={moreLabel} />}
          items={[
            ...(compact ? [{ kind: 'heading' as const, id: 'export-head', label: 'Export' }, ...exportItems, { kind: 'separator' as const, id: 'export-sep' }] : []),
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

  // When the plan last changed, in one quiet line. Records that have gone unverified are a data-quality
  // matter: they are listed under Data issues (toolbar), not flagged on the building's card.
  const verified = (
    <span className="sp-header__verified" title="Most recent change to a lease or availability on this plan">
      <Icon name="check" size={12} /> Latest change {fmtDate(verifiedAt)}
    </span>
  );

  // The listing as the PDF says it too (`listingWords`): its status leads ("Under contract"), and a prospect is given the state alone.
  const listing = property.saleListing ? listingWords(property.saleListing, kpis.leasable, state.safe) : null;
  const floorCount = <span>{property.floors.length} floors</span>;

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
      {/* The last facts wrap together, so "Latest change" is never a line of its own (round 22, 23): with the listing
          when there is one, otherwise with the floor count before it (Legacy West at 1024 px). */}
      {listing ? floorCount : null}
      <span className="sp-header__tail">
        {listing ? null : floorCount}
        {/* One more fact on the facts row, in the same quiet type: the title leads, the listing does not compete with it. */}
        {listing && (
          <span
            className="sp-header__sale"
            title={state.safe ? `${listing.label}; pricing is withheld in prospect-safe mode` : `Listed for sale by ${property.saleListing!.broker} · ${property.saleListing!.status}`}
          >
            <span className="sp-header__sale-label">{listing.label}</span>
            {listing.text.slice(listing.label.length)}
          </span>
        )}
        {/* The last fact, after the same separator: when the plan last changed. */}
        {verified}
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
      {/* The product bar: who made this, and the controls. The building is named once, in the card under it. */}
      {/* An expanded bottom sheet stops under the bar, so its controls are never cut in half (ui/Sheet.tsx). */}
      <section className="sp-card sp-topbar sp-no-print" data-sheet-keep-clear="" aria-label="Product bar">
        {/* The logo a little bigger than the building's icon in the card under it (32 and 28 px). */}
        <StaxLockup size={32} />
        {/* The controls and the look as one group at the right: they wrap together, never one button alone. */}
        <div className="sp-topbar__controls">
          {actions}
          {look}
        </div>
      </section>
      {/* The building card: its own mini stack, and its name, which is also the switcher (Clara, Nov 12: one name,
          not one in the bar and one here). The heading is a role, not an <h1>: the menu's wrapper is a <div>. */}
      <header className="sp-card sp-header sp-no-print">
        <MiniStack drawing={buildingById(property.id).stack} size={28} />
        <div className="sp-header__text">
          <div className="sp-header__title" role="heading" aria-level={1}>
            <Menu
              label="Building"
              align="start"
              trigger={(p) => (
                <button {...p} type="button" aria-label={`Switch building: ${property.name}`} title="Switch building" className="sp-switcher">
                  <span className="sp-switcher__name">{property.name}</span>
                  <Icon name="caret-down" size={16} />
                </button>
              )}
              items={switcherItems(property, (id) => patch(switchBuilding(state, id)))}
            />
          </div>
          {facts}
        </div>
      </header>
    </>
  );
}
