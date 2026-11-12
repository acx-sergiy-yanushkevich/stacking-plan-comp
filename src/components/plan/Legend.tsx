import type { LegendItem } from '../../domain/lenses';
import { num, pct } from '../../domain/format';
import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';

/** An entry for something drawn on the plan that is not a state of the lens: building use (the lobby). */
export interface LegendExtra {
  label: string;
  /** Exact SF it covers. */
  sf: number;
  /** Tooltip. */
  title: string;
  /** The tone whose fill and edge the swatch takes, and the pattern drawn over it: as on the plan. */
  tone: string;
  pattern: 'hatch' | 'dots' | 'dashed';
}

export interface LegendProps {
  items: LegendItem[];
  /** Entries after the lens's states, for what the plan draws beside them (see `buildingUse`). */
  extras?: LegendExtra[];
  /** Footnote shown under the items (e.g. "Suites under 56 px are enlarged"). */
  note?: string | null;
  id?: string;
  compact?: boolean;
  /**
   * Print every entry's SF and share and the note as a line of text (the PDF, which has no hover). On screen
   * the legend is the names alone: each entry's figures are its tooltip, and the note sits behind an info mark,
   * so the plan's key reads at a glance and caveats do not crowd it.
   */
  full?: boolean;
  /** On screen, print each entry's SF and share after its name too (a phone's unfolded legend list has room). */
  figures?: boolean;
  /** The lens the legend keys, named before its entries (Map and Timeline, whose card titles do not name it). */
  title?: string;
  /** The view puts the info mark on its own title line (`LegendInfo`), so the legend does not draw one. */
  infoElsewhere?: boolean;
}

/**
 * The legend entry for non-leasable area: the lobby and other building use, drawn as a grey hatch on the
 * building model (as the Stack view draws and labels it in the block itself). Null when the building has
 * none. It carries its SF and no share: it is not leasable, so it is not part of any percentage.
 */
export function buildingUse(floors: ReadonlyArray<{ floor: { nonLeasable: number } }>): LegendExtra | null {
  const sf = floors.reduce((t, f) => t + f.floor.nonLeasable, 0);
  if (sf <= 0) return null;
  return { label: 'Lobby · building use', sf, title: `Lobby and building use: ${num(sf)} SF non-leasable (lobby, loading, building use). Not counted in occupancy.`, tone: 'muted', pattern: 'hatch' };
}

/**
 * What the legend's shares add up to, when it is not 100%: the suites on record can cover more than the
 * leasable area (the owner is told which floor; a prospect, the totals only), and each share is rounded on
 * its own, as the KPI bar rounds it, so one SF figure reads the same in every lens (round 19). Null when the
 * printed shares add up to 100.0%. The Stack legend and the report's cover say the same sentence.
 */
export function sharesNote(items: ReadonlyArray<LegendItem>, leasable: number, over: ReadonlyArray<{ name: string; by: number }>): string | null {
  const counted = items.filter((i) => !i.overlay && i.sf > 0);
  const recorded = counted.reduce((t, i) => t + i.sf, 0);
  const tenths = (r: number) => Math.round(r * 1000);
  const printed = counted.reduce((t, i) => t + tenths(i.share), 0);
  const total = leasable > 0 ? tenths(recorded / leasable) : 0;
  const parts: string[] = [];
  if (recorded > leasable) {
    const which = over.length ? ` (${over.map((f) => `${f.name}'s records exceed its leasable area by ${num(f.by)} SF`).join('; ')})` : '';
    parts.push(`Shares are of ${num(leasable)} RSF leasable; the suites on record add up to ${num(recorded)} SF, ${pct(total / 1000)}${which}.`);
  }
  if (printed !== total) parts.push(`Each share is rounded on its own, so the shares shown add up to ${pct(printed / 1000)}.`);
  else if (printed !== 1000 && !parts.length) return null;
  return parts.length ? parts.join(' ') : null;
}

/** What an entry's tooltip and its screen-reader text say: its SF and share (an overlay: its SF, counted in its band). */
export function entryFigures(i: Pick<LegendItem, 'sf' | 'share' | 'overlay'>): string {
  return i.overlay ? `${num(i.sf)} SF, also counted in its rent band` : `${num(i.sf)} SF${i.share > 0 ? `, ${pct(i.share)} of leasable` : ''}`;
}

/**
 * One legend entry on screen. It is a tab stop: hover or focus (a tap focuses it) shows its figures in a
 * tooltip, and a screen reader reads them with its name, so the figures are not a mouse-only title (round 21).
 */
function Entry({ label, figures, swatch, extra, showNum, num: numText }: { label: string; figures: string; swatch: ReactNode; extra?: boolean; showNum: boolean; num: string }) {
  const [tip, setTip] = useState<null | 'start' | 'end'>(null);
  const id = useId();
  // The tip hangs from the entry's left edge, or from its right edge when the entry is in the right half of
  // its legend, so a tip never runs out of the card (round 22: "Vacant, not listed: 5,400 S").
  const open = (e: { currentTarget: HTMLElement }) => {
    const item = e.currentTarget.getBoundingClientRect();
    const box = e.currentTarget.closest('.sp-legend')?.getBoundingClientRect();
    setTip(box && item.left - box.left > box.width / 2 ? 'end' : 'start');
  };
  return (
    <span
      className={`sp-legend__item ${extra ? 'sp-legend__item--extra' : ''}`.trim()}
      tabIndex={showNum ? undefined : 0}
      onMouseEnter={open}
      onMouseLeave={() => setTip(null)}
      onFocus={open}
      onBlur={() => setTip(null)}
      onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
    >
      {swatch}
      <span className="sp-legend__label">{label}</span>
      {showNum ? <span className="sp-legend__num">{numText}</span> : <span className="sp-sr-only">: {figures}</span>}
      {tip && !showNum && (
        <span role="tooltip" id={id} className={`sp-tip sp-tip--bottom sp-legend__tip ${tip === 'end' ? 'sp-legend__tip--end' : ''}`} aria-hidden="true">
          {label}: {figures}
        </span>
      )}
    </span>
  );
}

/**
 * The legend's info mark: a real button (Enter, Space, a click or a tap) that opens the note in a small
 * popover, closed by Escape or a click outside. Exported so a view can put it on its title line.
 */
export function LegendInfo({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="About this legend"
      className="sp-legend__infowrap"
      panelClassName="sp-legend__pop"
      trigger={(p) => (
        <button type="button" {...p} className="sp-legend__info" aria-label="About this legend" title={note}>
          <Icon name="info" size={14} />
        </button>
      )}
    >
      <p className="sp-legend__poptext">{note}</p>
    </Popover>
  );
}

/** Legend whose items carry the SF and share they currently cover; an overlay carries its SF only. */
export function Legend({ items, extras, note, id, compact, full, figures, title, infoElsewhere }: LegendProps) {
  const showNum = !!(full || figures);
  return (
    <div className="sp-legend" id={id} role="group" aria-label={title ? `${title} legend` : 'Legend'}>
      {title && <span className="sp-legend__title">{title}</span>}
      {items
        .filter((i) => i.sf > 0 || !compact)
        .map((i) => (
          <Entry
            key={i.tone + i.label}
            label={i.label}
            figures={entryFigures(i)}
            showNum={showNum && i.sf > 0}
            /* An overlay (the rent lens's asking rent) is drawn over space already counted in a band: it
               carries its SF and says so, and no share, so the shares printed add up to 100%. */
            num={i.overlay ? `${num(i.sf)} SF · also in its band` : `${num(i.sf)}${i.share > 0 ? ` · ${pct(i.share)}` : ''}`}
            swatch={
              <span
                className={`sp-legend__swatch ${i.pattern ? `sp-legend__swatch--${i.pattern}` : ''}`}
                style={{ backgroundColor: i.pattern === 'dashed' ? 'transparent' : `var(--tone-${i.tone}-fill)`, borderColor: `var(--tone-${i.tone}-edge)`, color: `var(--tone-${i.tone}-edge)` }}
                aria-hidden="true"
              />
            }
          />
        ))}
      {extras?.map((x) => (
        <Entry
          key={`extra-${x.label}`}
          extra
          label={x.label}
          figures={x.title.replace(/^[^:]*:\s*/, '')}
          showNum={showNum}
          num={num(x.sf)}
          swatch={
            <span
              className={`sp-legend__swatch sp-legend__swatch--${x.pattern}`}
              style={{ backgroundColor: x.pattern === 'dashed' ? 'transparent' : `var(--tone-${x.tone}-solid, var(--tone-${x.tone}-fill))`, borderColor: `var(--tone-${x.tone}-edge)`, color: `var(--tone-${x.tone}-edge)` }}
              aria-hidden="true"
            />
          }
        />
      ))}
      {note && full && <span className="sp-legend__note">{note}</span>}
      {note && !full && !infoElsewhere && <LegendInfo note={note} />}
    </div>
  );
}
