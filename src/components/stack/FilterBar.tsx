import type { PlanState } from '../../state/planState';
import { Button, Icon } from '../ui';

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
      <span>{label.startsWith('No ') ? label : (<>Showing <strong>{label}</strong>. {alternatives ? 'Near misses are dashed; other space is dimmed.' : 'Other space is dimmed.'}</>)}</span>
      <Button size="sm" variant="ghost" icon="close" onClick={() => patch({ q: '', req: null, max: null, by: null, inquiry: null, window: null, bucket: null, mode: 'building' })}>
        Clear
      </Button>
    </div>
  );
}
