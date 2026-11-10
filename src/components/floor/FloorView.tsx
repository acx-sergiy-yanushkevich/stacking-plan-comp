import { useMemo, type KeyboardEvent } from 'react';
import type { FloorView as FloorViewModel } from '../../domain/derive';
import { fmtDate, fmtMonths } from '../../domain/dates';
import { num, pct, sf } from '../../domain/format';
import { levelPolygon, projectPolygon } from '../../domain/geometry';
import { tenantLabel } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { backToStack, openFloorPlate } from '../plan/actions';
import { Button, Chip } from '../ui';
import { FloorLists } from './FloorLists';
import { FloorPlate } from './FloorPlate';
import { MiniStack } from './MiniStack';
import { nextExpiry } from './floorData';
import { usePlateSize } from './usePlateSize';
import './floor.css';

export interface FloorViewProps {
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

const EDITABLE = /^(INPUT|SELECT|TEXTAREA)$/;

/** Floor plate drill-in (DESIGN.md §2.7): breadcrumb, floor picker, sliced footprint, KPIs and lists. */
export default function FloorView({ model, state, patch }: FloorViewProps) {
  const { floors, property, safe } = model;
  const floor = model.selectedFloor ?? floors[0] ?? null;

  const aspect = useMemo(() => {
    const pts = levelPolygon(projectPolygon(property.footprint, { w: 1000, h: 1000 }, 0), { w: 1000, h: 1000 }, 0);
    if (pts.length < 3) return 4 / 3;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    return h > 0 ? w / h : 4 / 3;
  }, [property.footprint]);
  const [plateRef, size] = usePlateSize(aspect);

  if (!floor) {
    return (
      <section className="sp-floor sp-card" aria-label="Floor plate">
        <div className="sp-floor__bar">
          <Button variant="ghost" icon="arrow-left" onClick={() => backToStack(patch)}>
            Stack
          </Button>
        </div>
        <p className="sp-floor__empty">This floor is not on the plan.</p>
      </section>
    );
  }

  // `floors` is top first: the previous floor is the one below, the next the one above.
  const idx = floors.findIndex((f) => f.floor.id === floor.floor.id);
  const lower: FloorViewModel | null = idx >= 0 && idx < floors.length - 1 ? floors[idx + 1] : null;
  const upper: FloorViewModel | null = idx > 0 ? floors[idx - 1] : null;

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (EDITABLE.test(t.tagName) || t.isContentEditable) return;
    if (e.key === 'ArrowLeft' && lower) {
      e.preventDefault();
      openFloorPlate(patch, lower.floor.id);
    } else if (e.key === 'ArrowRight' && upper) {
      e.preventDefault();
      openFloorPlate(patch, upper.floor.id);
    }
  };

  const leasedShare = floor.leasable > 0 ? floor.leased / floor.leasable : 0;
  const direct = floor.segments.filter((s) => s.kind === 'available' && !s.availableFrom).reduce((t, s) => t + s.size, 0);
  const sublease = floor.segments.filter((s) => s.kind === 'sublease').reduce((t, s) => t + s.size, 0);
  const next = nextExpiry(floor);
  const caption =
    'Schematic: suite positions are proportional to RSF along the floor plate, not surveyed. ' +
    (property.footprintSource === 'demo' ? 'Demo footprint.' : 'Footprint © OpenStreetMap contributors.');

  return (
    <section className="sp-floor sp-card" aria-label={`${floor.floor.name} plate`} onKeyDown={onKey}>
      <div className="sp-floor__bar">
        <nav className="sp-floor__crumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <button type="button" className="sp-floor__crumb-link" onClick={() => backToStack(patch)}>
                Stack
              </button>
            </li>
            <li aria-hidden="true" className="sp-floor__crumb-sep">
              ›
            </li>
            <li aria-current="page">{floor.floor.name}</li>
          </ol>
        </nav>
        <div className="sp-floor__nav">
          <Button
            variant="neutral"
            size="sm"
            icon="chevron-left"
            iconOnly
            aria-label={lower ? `Previous floor: ${lower.floor.name}` : 'Previous floor'}
            title={lower ? `${lower.floor.name} (←)` : 'Lowest floor'}
            disabled={!lower}
            onClick={() => lower && openFloorPlate(patch, lower.floor.id)}
          />
          <Button
            variant="neutral"
            size="sm"
            icon="chevron-right"
            iconOnly
            aria-label={upper ? `Next floor: ${upper.floor.name}` : 'Next floor'}
            title={upper ? `${upper.floor.name} (→)` : 'Top floor'}
            disabled={!upper}
            onClick={() => upper && openFloorPlate(patch, upper.floor.id)}
          />
        </div>
      </div>

      <div className="sp-floor__title">
        <h2 className="sp-floor__h">{floor.floor.name}</h2>
        <p className="sp-floor__facts">
          {num(floor.leasable)} RSF leasable · {pct(leasedShare)} leased · {sf(floor.available)} available
        </p>
      </div>

      <div className="sp-floor__grid">
        <MiniStack floors={floors} currentId={floor.floor.id} onPick={(id) => openFloorPlate(patch, id)} />

        <div className="sp-floor__plate">
          <div className="sp-plate" ref={plateRef}>
            <FloorPlate floor={floor} model={model} state={state} patch={patch} width={size.width} height={size.height} />
          </div>
          <p className="sp-plate__caption">{caption}</p>
        </div>

        <aside className="sp-floor__side" aria-label={`${floor.floor.name} summary`}>
          <dl className="sp-fkpis">
            <div className="sp-fkpi sp-fkpi--wide">
              <dt>Leased</dt>
              <dd>
                <span className="sp-fkpi__value">{pct(leasedShare)}</span>
                <span className="sp-fkpi__bar" aria-hidden="true">
                  <span className="sp-fkpi__bar-fill" style={{ width: `${Math.min(100, leasedShare * 100)}%` }} />
                </span>
                <span className="sp-fkpi__context">
                  {sf(floor.leased)} of {sf(floor.leasable)}
                </span>
              </dd>
            </div>
            <div className="sp-fkpi">
              <dt>Available</dt>
              <dd>
                <span className="sp-fkpi__value">{sf(floor.available)}</span>
                <span className="sp-fkpi__context">
                  {num(direct)}{'\u00a0'}direct · {num(sublease)}{'\u00a0'}sublease
                </span>
              </dd>
            </div>
            <div className="sp-fkpi">
              <dt>Largest contiguous</dt>
              <dd>
                <span className="sp-fkpi__value">{sf(floor.maxContiguous)}</span>
                <span className="sp-fkpi__context">{floor.maxContiguous > 0 ? 'direct, available now' : 'no direct space now'}</span>
              </dd>
            </div>
            <div className="sp-fkpi">
              <dt>Next expiry</dt>
              <dd>
                {next && next.lease && next.endDate && next.monthsToExpiry !== null ? (
                  <>
                    <span className="sp-fkpi__value">{tenantLabel(next.lease, safe)}</span>
                    <span className="sp-fkpi__context">
                      {fmtDate(next.endDate)} · {fmtMonths(next.monthsToExpiry)}
                    </span>
                  </>
                ) : (
                  <span className="sp-fkpi__value sp-fkpi__value--muted">None dated</span>
                )}
              </dd>
            </div>
          </dl>
          {floor.overAllocatedBy > 0 && (
            <Chip tone="error" icon="warning" className="sp-floor__warn" title="Leases and availabilities add up to more than the leasable area; occupancy is capped at 100%.">
              Over-allocated by {sf(floor.overAllocatedBy)}
            </Chip>
          )}
          <FloorLists floor={floor} model={model} state={state} patch={patch} />
        </aside>
      </div>
    </section>
  );
}
