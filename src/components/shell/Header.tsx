import type { ReactNode } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import { PALETTES, isDark, palettePatch, paletteOf, type PlanState } from '../../state/planState';
import { daysBetween, fmtDate } from '../../domain/dates';
import { num, pct, usd, usd0 } from '../../domain/format';
import { Button, Chip, Icon, Menu, Segmented, Switch, useToastBoundary } from '../ui';
import { canTimeTravel, planDate } from '../../domain/safe';
import { AsOfPopover } from './AsOfPopover';
import { rememberTrigger } from '../../state/focusStore';
import { useIsPhone, useMedia, usePrefersDark } from '../../lib/useMedia';

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
  // The two palettes belong to the default skin; `skin=aurora` has colours of its own and offers no choice.
  const palette = paletteOf(state);
  // A phone has no row to spare for how the plan looks: there the palette and the theme are a menu beside Export.
  const phone = useIsPhone();
  // A phone of 420 px or less: the title and one row of controls. The date is an icon and the date, the
  // switch says "Safe", Export drops its chevron, and Data issues moves into the menu beside Export (its
  // count is on that button), because five full-size controls do not fit 352 px, nor 322 at 360.
  const compact = useMedia('(max-width: 420px)');
  const openIssues = () => {
    if (state.mode !== 'issues') rememberTrigger();
    patch({ mode: state.mode === 'issues' ? 'building' : 'issues', select: null, floor: null });
  };
  const issuesTitle = `${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes. Open the list.`;
  // Data issues are withheld from a prospect, so in prospect-safe mode the menu is the colors and theme alone.
  const menuIssues = compact && !state.safe;
  const menuLook = standalone && phone;
  const menuLabel = menuIssues && menuLook ? 'Data issues, colors and theme' : menuIssues ? 'Data issues' : 'Colors and theme';
  const menuName = menuIssues && issueTotal ? menuLabel.replace('Data issues', `Data issues (${issueTotal})`) : menuLabel;
  const themeLabel = dark ? 'Switch to light theme' : 'Switch to dark theme';
  const toggleTheme = () => patch({ theme: dark ? 'light' : 'dark' });
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
        <AsOfPopover asOf={planDate(state.asOf, today, state.safe)} today={today} onChange={(asOf) => patch({ asOf })} miniTimeline={miniTimeline} locked={!canTimeTravel(state.safe)} compact={compact} />
        {/* Turning it on drops a search in progress, the worklist, a projected as-of date and any toast: the state layer (applyPatch) and useToastBoundary do it, not this handler. */}
        <Switch checked={state.safe} onChange={(safe) => patch({ safe })} label="Prospect-safe" shortLabel={compact ? 'Safe' : undefined} title="Hide tenant names, contacts, rents, lease dates and prospects, and show the plan as of today" />
        {/* One slot, two tenants. Data issues are withheld from a prospect, so in prospect-safe mode the slot
            holds the chip that says the mode is on. The slot is the same width either way (shell.css), so the
            controls wrap at the same point and the header is the same height with the mode on and off. */}
        {!compact && (
          <div className="sp-header__slot">
            {state.safe ? (
              <Chip tone="brand" icon="shield" title="Tenant names, contacts, rents, lease dates and prospects are hidden">
                Prospect-safe on
              </Chip>
            ) : (
              <Button icon="warning" count={issueTotal} active={state.mode === 'issues'} onClick={openIssues} title={issuesTitle}>
                Data issues
              </Button>
            )}
          </div>
        )}
        <Menu
          label="Export"
          trigger={(p) => (
            <Button {...p} icon="download" iconRight={compact ? undefined : 'chevron-down'}>
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
        {/* A phone: the palette and the theme as a menu, on the row the other controls already take; at 420 px
            or less, Data issues too, first. Its count is a badge on the button, drawn over it so that the
            button is the same width with the mode on and off and nothing beside it moves. */}
        {(menuLook || menuIssues) && (
          <Menu
            label={menuLabel}
            trigger={(p) => (
              <span className="sp-header__more">
                <Button {...p} iconOnly icon="more" aria-label={menuName} title={menuIssues ? `${menuLabel}. ${issuesTitle}` : menuLabel} />
                {menuIssues && issueTotal > 0 && (
                  <span className="sp-btn__count sp-header__more-count" aria-hidden="true">
                    {issueTotal}
                  </span>
                )}
              </span>
            )}
            items={[
              ...(menuIssues
                ? [
                    { id: 'issues', label: state.mode === 'issues' ? 'Close data issues' : 'Data issues', icon: 'warning' as const, hint: `${counts.error} errors · ${counts.warning} warnings · ${counts.info} notes`, onSelect: openIssues },
                    ...(menuLook ? [{ kind: 'separator' as const, id: 'issues-sep' }] : []),
                  ]
                : []),
              ...(menuLook && palette
                ? [
                    { kind: 'heading' as const, id: 'palette', label: 'Colors' },
                    ...PALETTES.map((p) => ({
                      id: `palette-${p.id}`,
                      label: p.label,
                      adornment: <span className={`sp-palette__dot sp-palette__dot--${p.id}`} aria-hidden="true" />,
                      checked: p.id === palette,
                      onSelect: () => patch(palettePatch(p.id)),
                    })),
                    { kind: 'separator' as const, id: 'look-sep' },
                  ]
                : []),
              ...(menuLook ? [{ id: 'theme', label: themeLabel, icon: dark ? ('sun' as const) : ('moon' as const), onSelect: toggleTheme }] : []),
            ]}
          />
        )}
      </div>
      {/* How the plan looks, apart from what it shows: the palette and the theme. Both are state like any
          other, written to the URL, so a link opens in the colours it was copied in. */}
      {standalone && !phone && (
        <div className="sp-header__look">
          {palette && (
            <Segmented
              className="sp-palette"
              aria-label="Color palette"
              options={PALETTES.map((p) => ({ id: p.id, label: p.label, title: `${p.label} colors`, adornment: <span className={`sp-palette__dot sp-palette__dot--${p.id}`} aria-hidden="true" /> }))}
              value={palette}
              onChange={(id) => patch(palettePatch(id))}
            />
          )}
          <Button iconOnly icon={dark ? 'sun' : 'moon'} aria-label={themeLabel} title={dark ? 'Light theme' : 'Dark theme'} onClick={toggleTheme} />
        </div>
      )}
    </header>
  );
}
