import type { PlanState } from '../../state/planState';
import { Button, Icon } from '../ui';

export interface FilterBarProps {
  label: string;
  patch: (p: Partial<PlanState>) => void;
}

/** Names the active filter above the plan and offers one Clear. */
export function FilterBar({ label, patch }: FilterBarProps) {
  return (
    <div className="sp-filterbar" role="status">
      <Icon name="filter" size={14} />
      <span>
        Showing <strong>{label}</strong>. Other space is dimmed.
      </span>
      <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', req: null, max: null, by: null, inquiry: null, window: null, bucket: null, mode: 'building' })}>
        Clear
      </Button>
    </div>
  );
}
