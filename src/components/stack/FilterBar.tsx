import type { PlanState } from '../../state/planState';
import { Button, Icon } from '../ui';
import { DotJoin } from '../hero/DotJoin';

export interface FilterBarProps {
  label: string;
  /** Near misses are drawn dashed and stay readable. */
  alternatives?: boolean;
  patch: (p: Partial<PlanState>) => void;
}

/** Names the active filter above the plan and offers one Clear. */
export function FilterBar({ label, alternatives, patch }: FilterBarProps) {
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
