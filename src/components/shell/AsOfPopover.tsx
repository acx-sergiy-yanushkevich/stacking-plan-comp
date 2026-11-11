import { useId, useState, type ReactNode } from 'react';
import type { ISODate } from '../../domain/types';
import { addMonths, fmtDate, monthsBetween, fmtMonths } from '../../domain/dates';
import { Button, Chip, Popover, TextField } from '../ui';

export interface AsOfPopoverProps {
  asOf: ISODate;
  today: ISODate;
  onChange: (d: ISODate) => void;
  /** Miniature lease timeline, drawn in the popover as a scrubber for the date. */
  miniTimeline?: ReactNode;
  /**
   * The date cannot be moved (prospect-safe: a later date would show each lease's end as a vacated
   * suite). The control then states the date and opens nothing. It is the unlocked button with a lock
   * where the chevron was: the same label and the same width, so turning the mode on or off moves
   * nothing in the header. That the date is fixed, and why, is in its tooltip and its accessible
   * description.
   */
  locked?: boolean;
}

/** Why the as-of control is locked, for the tooltip and for a screen reader. */
export const LOCKED_NOTE = 'Fixed to today in prospect-safe. Turn Prospect-safe off to move the date.';

const PRESETS: Array<{ label: string; months: number }> = [
  { label: 'Today', months: 0 },
  { label: '+6 mo', months: 6 },
  { label: '+12 mo', months: 12 },
  { label: '+24 mo', months: 24 },
  { label: '+5 yr', months: 60 },
];

export function AsOfPopover({ asOf, today, onChange, miniTimeline, locked = false }: AsOfPopoverProps) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const projected = asOf !== today;
  const ahead = monthsBetween(today, asOf);
  if (locked) {
    // `aria-disabled`, not `disabled`: the button keeps its tab stop, so the reason can be reached and read.
    return (
      <div className="sp-header__asof sp-header__asof--locked">
        <Button icon="calendar" iconRight="lock" aria-disabled="true" aria-describedby={noteId} title={LOCKED_NOTE}>
          As of {fmtDate(asOf)}
        </Button>
        <span id={noteId} className="sp-sr-only">
          {LOCKED_NOTE}
        </span>
      </div>
    );
  }
  return (
    <div className={`sp-header__asof ${projected ? 'sp-header__asof--projected' : ''}`}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="end"
        label="As-of date"
        trigger={(p) => (
          <Button {...p} icon="calendar" iconRight="chevron-down" title={projected ? `Projected ${fmtMonths(ahead)} ahead` : 'Plan as of today'}>
            {projected ? 'Projected · ' : 'As of '}
            {fmtDate(asOf)}
          </Button>
        )}
      >
        <div className="sp-asof">
          <div className="sp-asof__presets" role="group" aria-label="Quick dates">
            {PRESETS.map((p) => {
              const d = addMonths(today, p.months);
              return (
                <Chip key={p.label} selected={asOf === d} onClick={() => onChange(d)}>
                  {p.label}
                </Chip>
              );
            })}
          </div>
          <div className="sp-asof__row">
            <TextField label="As-of date" kind="date" value={asOf} min={addMonths(today, -24)} max={addMonths(today, 180)} onChange={(e) => e.target.value && onChange(e.target.value)} />
            {projected && (
              <Button variant="ghost" size="sm" onClick={() => onChange(today)}>
                Reset
              </Button>
            )}
          </div>
          {miniTimeline && <div className="sp-asof__mini">{miniTimeline}</div>}
          <p className="sp-asof__note">
            {projected
              ? `Showing the building ${fmtMonths(ahead)} ahead. Leases ending before this date are drawn as projected vacancies; KPI cards show the change against today.`
              : 'Move the date forward to see which leases roll, how occupancy changes and where space opens up.'}
          </p>
        </div>
      </Popover>
    </div>
  );
}
