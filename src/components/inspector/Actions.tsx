import { useCallback } from 'react';
import { Button, useToast } from '../ui';
import { RECORD_ACTION_LABEL, recordActionToast, type RecordAction } from '../plan/actions';

export interface ActionItem {
  action: RecordAction;
  /** Record the action targets, e.g. "Lease L13" or "Availability A02". */
  record: string;
  primary?: boolean;
  /** Override the button text (defaults to RECORD_ACTION_LABEL). */
  label?: string;
}

/**
 * The prototype has no Salesforce behind it: every record action shows what it would do. The message
 * names the record (a tenant, a prospect, a deal), so it is pushed as `named`: the toast layer refuses
 * it in prospect-safe mode and removes it if the mode is turned on while it is showing.
 */
export function useRecordAction() {
  const toast = useToast();
  return useCallback((action: RecordAction, record: string) => toast.push(recordActionToast(action, record), { icon: 'external', named: true }), [toast]);
}

/** Footer of record actions (2–4 buttons) for a block panel. */
export function Actions({ items }: { items: ActionItem[] }) {
  const run = useRecordAction();
  if (items.length === 0) return null;
  return (
    <div className="sp-ins__actions">
      {items.slice(0, 4).map((it) => (
        <Button key={it.action} size="sm" variant={it.primary ? 'brand' : 'neutral'} iconRight={it.primary ? 'external' : undefined} onClick={() => run(it.action, it.record)}>
          {it.label ?? RECORD_ACTION_LABEL[it.action]}
        </Button>
      ))}
    </div>
  );
}
