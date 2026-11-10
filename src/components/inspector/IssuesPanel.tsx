import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { Issue, IssueSeverity } from '../../domain/issues';
import { Button, Icon } from '../ui';
import { openFloor, selectSegment, type Patch, type RecordAction } from '../plan/actions';
import { focusSegment, setReturnMode } from '../../state/focusStore';
import { useRecordAction } from './Actions';
import { canShowIssues } from '../../domain/safe';
import { Section } from './parts';

export interface IssuesPanelProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

const GROUPS: Array<{ severity: IssueSeverity; label: string; icon: 'warning' | 'info' }> = [
  { severity: 'error', label: 'Errors', icon: 'warning' },
  { severity: 'warning', label: 'Warnings', icon: 'warning' },
  { severity: 'info', label: 'Info', icon: 'info' },
];

/** Map the issue's fix wording to the record action it would open. */
export function fixAction(fix: string): RecordAction {
  switch (fix) {
    case 'Add unit':
      return 'add-unit';
    case 'Assign floor':
      return 'assign-floor';
    case 'Review floor':
      return 'review-floor';
    case 'Create availability':
      return 'new-availability';
    case 'Fix availability':
    case 'Review listing':
      return 'fix-availability';
    case 'Open deal':
      return 'open-deal';
    case 'Verify lease':
    case 'Verify availability':
      return 'verify';
    default:
      return 'open-lease';
  }
}

export function IssuesPanel({ model, patch }: IssuesPanelProps) {
  const { issues, safe } = model;
  const run = useRecordAction();

  if (!canShowIssues(safe)) {
    // Titles name tenants and prospects, and even a count says the records are wrong: nothing is shown.
    return (
      <div className="sp-empty">
        <Icon name="shield" size={24} />
        <div className="sp-empty__title">Data issues are withheld</div>
        <p>Data issues are for the people who maintain the plan. They are not shown while prospect-safe is on.</p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="sp-empty">
        <Icon name="check" size={24} />
        <div className="sp-empty__title">No data issues</div>
        <p>Every lease and availability is placed, in term and verified.</p>
      </div>
    );
  }

  const locate = (i: Issue) => {
    setReturnMode('issues');
    if (i.segKey) {
      selectSegment(patch, i.segKey);
      focusSegment(i.segKey);
    } else if (i.floorId) openFloor(patch, i.floorId);
  };

  return (
    <>
      {GROUPS.map((g) => {
        const list = issues.filter((i) => i.severity === g.severity);
        if (list.length === 0) return null;
        return (
          <Section key={g.severity} title={`${g.label} · ${list.length}`}>
            <ul className="sp-ins__list" aria-label={g.label}>
              {list.map((i) => (
                <li key={i.id} className={`sp-ins__issue sp-ins__issue--${i.severity}`}>
                  <Icon name={g.icon} size={16} label={g.severity === 'error' ? 'Error' : g.severity === 'warning' ? 'Warning' : 'Info'} />
                  <div className="sp-ins__issue-body">
                    <div className="sp-ins__issue-title">{i.title}</div>
                    <div className="sp-ins__issue-detail">{i.detail}</div>
                    <div className="sp-ins__issue-actions">
                      <Button size="sm" iconRight="external" onClick={() => run(fixAction(i.fix), i.recordLabel)}>
                        {i.fix}
                      </Button>
                      {(i.segKey || i.floorId) && (
                        <button type="button" className="sp-ins__link" aria-label={`Locate ${i.title}`} onClick={() => locate(i)}>
                          <Icon name="search" size={12} />
                          Locate
                        </button>
                      )}
                      <button type="button" className="sp-ins__link" aria-label={`Mark reviewed: ${i.title}`} onClick={() => run('mark-reviewed', i.recordLabel)}>
                        <Icon name="check" size={12} />
                        Mark reviewed
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}
