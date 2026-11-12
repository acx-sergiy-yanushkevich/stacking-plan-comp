import type { PlanState } from '../../state/planState';
import type { QueryIntent } from '../../domain/query';
import { num } from '../../domain/format';
import { Button, Icon } from '../ui';
import { DotJoin } from '../hero/DotJoin';

type SizeQuery = Extract<QueryIntent, { kind: 'size' }>;

/** The search box's requirement, run in Find space: the query is cleared, the requirement is the finder's. */
export const findFromQuery = (f: SizeQuery): Partial<PlanState> => ({ q: '', req: f.size, max: f.max, by: f.by, fit: f.fit, inquiry: null, window: null, bucket: null, mode: 'find' });

export interface FilterBarProps {
  label: string;
  /** Near misses are drawn dashed and stay readable. */
  alternatives?: boolean;
  /** A search query that is a space requirement: the bar offers to run it in Find space. */
  find?: SizeQuery | null;
  patch: (p: Partial<PlanState>) => void;
}

/** Names the active filter above the plan and offers one Clear. */
export function FilterBar({ label, alternatives, find, patch }: FilterBarProps) {
  if (find)
    return (
      <div className="sp-filterbar" role="status">
        <Icon name="filter" size={14} />
        <span>
          That reads as a space requirement: <strong>{label.replace(/^Find /, '')}</strong>.
        </span>
        <Button size="sm" variant="brand" iconRight="chevron-right" className="sp-filterbar__find" onClick={() => patch(findFromQuery(find))}>
          Find {num(find.size)}
          {find.max ? `–${num(find.max)}` : ''} SF of space
        </Button>
        <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '' })}>
          Clear
        </Button>
      </div>
    );
  return (
    <div className="sp-filterbar" role="status">
      <Icon name="filter" size={14} />
      {/* The label is facts with a "·" between them ("Space that fits 12,000+ SF · 1 option"). On a narrow
          window the sentence wraps: between facts, or inside a long one, never with a separator at the end
          of a line or the start of the next (DotJoin). */}
      <span>
        {label.startsWith('No ') ? (
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
      <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', req: null, max: null, by: null, inquiry: null, window: null, bucket: null, mode: 'building' })}>
        Clear
      </Button>
    </div>
  );
}
