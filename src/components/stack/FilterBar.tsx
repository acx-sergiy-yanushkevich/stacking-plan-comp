import type { PlanState } from '../../state/planState';
import { sizeText, type QueryIntent } from '../../domain/query';
import { num } from '../../domain/format';
import { fmtDate } from '../../domain/dates';
import { rangeProblem } from '../../domain/finder';
import { Button, Icon } from '../ui';
import { DotJoin } from '../hero/DotJoin';

type SizeQuery = Extract<QueryIntent, { kind: 'size' }>;

/** What the app's live region says for the bar: the sentence a screen reader should hear, or nothing. */
export function filterSpeech(label: string | null, empty: boolean, find: SizeQuery | null): string {
  if (!label) return '';
  // Everything the bar shows, in its words (round 39: "Not used", the past date and the range's fix were left out).
  if (find?.badBy) return `${find.badBy} is not a date on the calendar. Correct it to find ${sizeText(find.size, find.max)} SF of space by then.`;
  if (find) {
    const inverted = rangeProblem(find.size, find.max);
    if (inverted) return `That asks for at least ${num(find.size)} SF and at most ${num(find.max ?? 0)} SF, which no space can be. ${inverted}`;
    const past = find.pastBy ? ` ${fmtDate(find.pastBy)} is before the as-of date, so it is not applied.` : '';
    const unread = find.unread?.length ? ` Not used: ${find.unread.join(', ')}.` : '';
    return `That reads as a space requirement: ${label.replace(/^Find /, '')}.${past}${unread} Press Enter to find it.`;
  }
  return empty ? label : `Showing ${label.replace(/ · /g, ', ')}.`;
}

/** The search box's requirement, run in Find space: the query is cleared, the requirement is the finder's. */
export const findFromQuery = (f: SizeQuery): Partial<PlanState> => ({ q: '', req: f.size, max: f.max, by: f.by, fit: f.fit, inquiry: null, window: null, bucket: null, mode: 'find' });

export interface FilterBarProps {
  label: string;
  /** Near misses are drawn dashed and stay readable. */
  alternatives?: boolean;
  /** A search query that is a space requirement: the bar offers to run it in Find space. */
  find?: SizeQuery | null;
  /**
   * The view cannot show suites (the Map): the answer is on the plan, so the bar takes the user there, to the
   * Building tab (round 24: a search typed on the Map was answered nowhere on screen).
   */
  planElsewhere?: boolean;
  /** Nothing matched: the label is a sentence to show as it is (`PlanModel.filterEmpty`). */
  empty?: boolean;
  patch: (p: Partial<PlanState>) => void;
}

const TO_PLAN: Partial<PlanState> = { view: 'building' };

/**
 * Names the active filter above the plan and offers one Clear. The bar is not a live region: its message is read from
 * the app's own, which is always there (`filterSpeech`, App.tsx), so the first message is not lost with a region created
 * together with it (round 38), and the buttons' names are never read with it (round 37).
 */
export function FilterBar({ label, empty = false, alternatives, find, planElsewhere, patch }: FilterBarProps) {
  // A requirement with a date the calendar has not: say so and offer nothing to run until it is corrected.
  if (find?.badBy)
    return (
      <div className="sp-filterbar sp-filterbar--offer">
        <Icon name="warning" size={14} />
        <span>
          {find.badBy} is not a date on the calendar. Correct it to find {sizeText(find.size, find.max)} SF of space by then.
        </span>
        <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', fit: 'any' })}>
          Clear
        </Button>
      </div>
    );
  // A ceiling under the floor ("20k under 15k"): name it, as Find space does, and offer nothing to run (round 35).
  const inverted = find ? rangeProblem(find.size, find.max) : null;
  if (find && inverted)
    return (
      <div className="sp-filterbar sp-filterbar--offer">
        <Icon name="warning" size={14} />
        <span>
          That asks for at least {num(find.size)} SF and at most {num(find.max ?? 0)} SF, which no space can be. {inverted}
        </span>
        <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', fit: 'any' })}>
          Clear
        </Button>
      </div>
    );
  if (find)
    return (
      <div className="sp-filterbar sp-filterbar--offer">
        <Icon name="filter" size={14} />
        <span>
          That reads as a space requirement: <strong>{label.replace(/^Find /, '')}</strong>.
          {find.pastBy ? ` ${fmtDate(find.pastBy)} is before the as-of date, so it is not applied.` : ''}
          {find.unread?.length ? ` Not used: ${find.unread.join(', ')}.` : ''}
        </span>
        <Button size="sm" variant="brand" iconRight="chevron-right" className="sp-filterbar__find" onClick={() => patch({ ...findFromQuery(find), ...(planElsewhere ? TO_PLAN : {}) })}>
          Find {sizeText(find.size, find.max)} SF of space
        </Button>
        <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', fit: 'any' })}>
          Clear
        </Button>
      </div>
    );
  if (planElsewhere && !empty)
    return (
      <div className="sp-filterbar">
        <Icon name="filter" size={14} />
        <span>
          On the plan: <strong><DotJoin parts={label.split(' · ')} /></strong>.
        </span>
        <Button size="sm" variant="brand" iconRight="chevron-right" className="sp-filterbar__find" onClick={() => patch(TO_PLAN)}>
          Show on the plan
        </Button>
        <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', req: null, max: null, by: null, fit: 'any', inquiry: null, window: null, bucket: null })}>
          Clear
        </Button>
      </div>
    );
  return (
    <div className="sp-filterbar">
      <Icon name="filter" size={14} />
      {/* The label is facts with a "·" between them ("Space that fits 12,000+ SF · 1 option"). On a narrow
          window the sentence wraps: between facts, or inside a long one, never with a separator at the end
          of a line or the start of the next (DotJoin). */}
      <span>
        {empty ? (
          label
        ) : (
          <>
            Showing{' '}
            <strong>
              <DotJoin parts={label.split(' · ')} />
            </strong>
            . {alternatives ? 'Near misses are dashed; other space is dimmed.' : 'Other space is dimmed.'}
          </>
        )}
      </span>
      <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', req: null, max: null, by: null, fit: 'any', inquiry: null, window: null, bucket: null, mode: 'building' })}>
        Clear
      </Button>
    </div>
  );
}
