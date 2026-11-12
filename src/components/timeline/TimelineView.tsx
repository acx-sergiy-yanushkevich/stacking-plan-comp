import { Legend, LegendInfo } from '../plan/Legend';
import { FilterBar } from '../stack/FilterBar';
import { lensName } from '../../domain/lenses';
import { planLegendNote } from '../plan/legendNote';
import { fmtDate } from '../../domain/dates';
import { num } from '../../domain/format';
import { barSegment, dateToX } from '../../domain/timeline';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { ISODate } from '../../domain/types';
import { clearSelection, selectSegment, toggleBucket, type Patch } from '../plan/actions';
import { TimelineAxis } from './TimelineAxis';
import { TimelineRows, type BarHover } from './TimelineRows';
import { layoutRows, layoutStackedRows, rowsHeight, viewAxis } from './layout';
import { AsOfCursor } from './AsOfCursor';
import { RolloverChips } from './RolloverChips';
import { canShowRollover, canTimeTravel } from '../../domain/safe';
import { barLabel, endedNameFits, SUB_FONT, tagWidth, wrapLabel, type LabelLine } from './barLabel';
import { useWidth } from '../../lib/useWidth';
import { measure } from '../../lib/textFit';
import { Icon } from '../ui';
import { useHoverKeys } from '../../state/hoverStore';
import './timeline.css';

export interface TimelineViewProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

export const GUTTER = 88;
/**
 * Below this width a bar cannot hold its label, and a wider SVG in a scrolling box would cut
 * names and figures at the screen edge. The chart switches to the stacked layout instead: it
 * fits the host, and every bar's full label is written above it.
 */
const MIN_WIDTH = 640;
/** The stacked chart's own floor: narrower than this it scrolls sideways rather than squeeze the axis. */
const STACKED_MIN_WIDTH = 280;
/** Top strip: year labels, the cursor handle and the Today label. */
const STRIP_H = 28;
/** Rollover band under the strip. */
const BAND_H = 56;
const BOTTOM_PAD = 6;
/** Matches `.sp-tl-tip { max-width }`. */
const TIP_MAX_WIDTH = 320;

/**
 * The suites whose bars stay lit while the rest are dimmed: what is being pointed at just now (a KPI
 * such as "Available" or "Largest block", a finder option) before the filter in force (a search, the
 * finder, the worklist, a rollover period). Null lights everything. The Stack view and the building
 * model follow the same rule, so pointing at a KPI answers in every view.
 */
export const litKeys = (pointedAt: Set<string> | null, filter: Set<string> | null): Set<string> | null => pointedAt ?? filter;

/**
 * Lease timeline (DESIGN.md §2.5): one SVG with a floor gutter, a rollover band measured
 * from the cursor, year gridlines, a bar per lease or availability and the draggable as-of
 * cursor. Moving the cursor patches `asOf`, so every view recomputes from the same model.
 */
export default function TimelineView({ model, state, patch }: TimelineViewProps) {
  // SSR and tests have no layout: they render the wide chart.
  const [hostRef, width] = useWidth<HTMLDivElement>(MIN_WIDTH, STACKED_MIN_WIDTH);
  const stackedMode = width < MIN_WIDTH;
  const svgRef = useRef<SVGSVGElement | null>(null);
  // A KPI or a finder option pointed at lights its suites' bars for as long as it is pointed at.
  const highlight = litKeys(useHoverKeys(), model.highlight);
  const rows = model.timeline.rows;
  // Stacked: the gutter is as wide as its widest line ("Floor 12" over "20,800 SF"), no wider.
  const gutter = stackedMode
    ? Math.ceil(Math.max(50, ...rows.map((r) => measure(`${num(r.floor.size - r.floor.nonLeasable)} SF`, SUB_FONT)))) + 12
    : GUTTER;
  const plotWidth = Math.max(200, width - gutter - (stackedMode ? 2 : 8));
  // Prospect-safe has no rollover band (SF per period would name suites) and no movable as-of date.
  const showRollover = canShowRollover(model.safe);
  const timeTravel = canTimeTravel(model.safe);
  const bandHeight = stackedMode || !showRollover ? 0 : BAND_H;
  const rowsTop = STRIP_H + bandHeight + 2;
  // Stacked: every bar's whole label, wrapped to the plot. The lane heights follow from the line counts.
  const labels = useMemo(() => {
    if (!stackedMode) return null;
    const out = new Map<string, LabelLine[]>();
    for (const row of rows) {
      for (const bar of row.bars) {
        const seg = barSegment(bar, model.segIndex);
        if (!seg) continue;
        const { name, sub, risk } = barLabel(bar, seg, { safe: model.safe, asOf: model.asOf, today: model.today, lens: state.lens, floorName: row.floor.name });
        out.set(bar.key, wrapLabel(name, sub, plotWidth - 6, risk ? tagWidth(risk) + 5 : 0));
      }
    }
    return out;
  }, [stackedMode, rows, model.segIndex, model.safe, model.asOf, model.today, state.lens, plotWidth]);
  // The axis follows as-of (as-of + 10 yr). Freeze it while dragging so the chart does not
  // rescale under the pointer; it snaps to the new extent on release.
  const axis = viewAxis(model.timeline, model.asOf, model.today);
  const [frozen, setFrozen] = useState<{ start: ISODate; end: ISODate } | null>(null);
  const start = frozen?.start ?? axis.start;
  const end = frozen?.end ?? axis.end;

  const laid = useMemo(() => {
    if (labels) return layoutStackedRows(rows, rowsTop, (bar) => labels.get(bar.key)?.length ?? 1);
    // A lease that has ended says "· vacated" like its neighbours. Where its bar and the dashed box after
    // it are too short for that, the label starts at the bar's end and runs on across the as-of line, and
    // the bar keeps the rest of its lane free for it (as a holdover does), so nothing else is drawn there.
    const px = (d: ISODate) => Math.min(plotWidth, Math.max(0, dateToX(d, start, end, plotWidth)));
    const keepsLane = (bar: (typeof rows)[number]['bars'][number]): boolean => {
      if (bar.kind !== 'projected' || !bar.end || bar.end >= model.asOf) return false;
      const seg = barSegment(bar, model.segIndex);
      if (!seg) return false;
      const { name } = barLabel(bar, seg, { safe: model.safe, asOf: model.asOf, today: model.today, lens: state.lens, floorName: '' });
      return !endedNameFits(name, px(bar.end) - px(bar.start), px(model.asOf) - px(bar.end));
    };
    return layoutRows(rows, model.asOf, rowsTop, model.safe, keepsLane);
  }, [labels, rows, model.asOf, model.safe, model.today, model.segIndex, state.lens, rowsTop, plotWidth, start, end]);
  const height = rowsTop + rowsHeight(laid) + BOTTOM_PAD;
  const clipId = `sp-tl-plot-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const legendStates = model.legend.filter((i) => i.sf > 0).length;
  const lensLabel = lensName(state.lens);
  const legendNote = planLegendNote(model, state.lens);

  const [hover, setHover] = useState<BarHover | null>(null);

  // Prospect-safe is a boundary for what is already on screen: a tip drawn before it turned on is dropped.

  const [hoverSafe, setHoverSafe] = useState(model.safe);

  if (hoverSafe !== model.safe) {

    setHoverSafe(model.safe);

    setHover(null);

  }
  const onHover = useCallback((h: BarHover | null) => setHover(h), []);
  // Selecting the selected bar again (click or Escape) clears the selection.
  const onSelect = useCallback((key: string) => (key === state.select ? clearSelection(patch) : selectSegment(patch, key)), [patch, state.select]);
  const onBucket = useCallback((key: number) => toggleBucket(patch, state.bucket, key), [patch, state.bucket]);
  const onAsOf = useCallback((d: ISODate) => patch({ asOf: d }), [patch]);

  // Floating tooltip position, relative to the host element.
  let tipStyle: { left: number; top: number } | null = null;
  if (hover && hostRef.current) {
    const rect = hostRef.current.getBoundingClientRect();
    if (Number.isNaN(hover.clientX)) {
      // Keyboard focus: anchor to the bar itself.
      const el = hostRef.current.querySelector<SVGGElement>(`[data-bar="${CSS.escape(hover.key)}"]`);
      const b = el?.getBoundingClientRect();
      tipStyle = b ? { left: b.left - rect.left + 8, top: b.bottom - rect.top + 6 } : null;
    } else {
      tipStyle = { left: hover.clientX - rect.left + 12, top: hover.clientY - rect.top + 16 };
    }
    // Keep the tip inside the host: hanging off its right edge would make the host scroll sideways.
    if (tipStyle) tipStyle.left = Math.max(0, Math.min(tipStyle.left, rect.width - TIP_MAX_WIDTH - 8));
  }

  return (
    <section className="sp-card sp-tl-card" aria-label="Lease timeline">
      <div className="sp-stack__head">
        <div className="sp-stack__title">
          <h2>Lease timeline</h2>
          <span className="sp-weak">
            as of {fmtDate(model.asOf)}
            {!stackedMode && ` · ${num(model.kpis.leasable)} RSF leasable`}
            {legendNote && !stackedMode && <> <LegendInfo note={legendNote} /></>}
          </span>
        </div>
        {stackedMode ? (
          <details className="sp-tl-legend">
            <summary>
              {lensLabel} legend · {legendStates} states
              <Icon name="chevron-down" size={14} />
            </summary>
            <Legend items={model.legend} compact figures title={lensLabel} note={legendNote} />
          </details>
        ) : (
          <Legend items={model.legend} compact title={lensLabel} note={legendNote} infoElsewhere />
        )}
      </div>
    {/* A search, a requirement or a worklist dims bars here as it dims blocks on the plan: the same sentence says why (round 24). */}
    {model.filterLabel && <FilterBar label={model.filterLabel} alternatives={!!model.partial && model.partial.size > 0} find={model.queryFind} patch={patch} />}
    <div className={`sp-timeline ${stackedMode ? 'sp-timeline--stacked' : ''}`} ref={hostRef}>
      {stackedMode && showRollover && <RolloverChips buckets={model.roll.buckets} atRisk={model.roll.atRisk} asOf={model.asOf} activeBucket={state.bucket} onBucket={onBucket} />}
      <svg ref={svgRef} className="sp-timeline__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Lease timeline, ${rows.length} floors`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={gutter} y={0} width={plotWidth} height={height} />
          </clipPath>
        </defs>
        <TimelineAxis
          start={start}
          end={end}
          asOf={model.asOf}
          today={model.today}
          plotLeft={gutter}
          plotWidth={plotWidth}
          stripHeight={STRIP_H}
          bandHeight={bandHeight}
          height={height - BOTTOM_PAD}
          buckets={model.roll.buckets}
          atRisk={model.roll.atRisk}
          activeBucket={state.bucket}
          onBucket={onBucket}
        />
        <line className="sp-cursor__line sp-cursor__line--under" x1={gutter + dateToX(model.asOf, start, end, plotWidth)} x2={gutter + dateToX(model.asOf, start, end, plotWidth)} y1={0} y2={height - BOTTOM_PAD} />
        <TimelineRows
          rows={laid}
          segIndex={model.segIndex}
          start={start}
          end={end}
          asOf={model.asOf}
          today={model.today}
          lens={state.lens}
          safe={model.safe}
          plotLeft={gutter}
          plotWidth={plotWidth}
          clipId={clipId}
          highlight={highlight}
          selected={state.select}
          hovered={hover?.key ?? null}
          stacked={labels}
          onSelect={onSelect}
          onHover={onHover}
        />
        <AsOfCursor
          locked={!timeTravel}
          asOf={model.asOf}
          today={model.today}
          start={start}
          end={end}
          svgRef={svgRef}
          plotLeft={gutter}
          plotWidth={plotWidth}
          top={0}
          height={height - BOTTOM_PAD}
          hideLine
          handleHeight={STRIP_H}
          onChange={onAsOf}
          onDragStart={() => setFrozen(axis)}
          onDragEnd={() => setFrozen(null)}
        />
      </svg>
      {hover && tipStyle && (
        <div className="sp-tl-tip" aria-hidden="true" style={tipStyle}>
          {hover.text}
        </div>
      )}
      <p className="sp-timeline__note">
        {!timeTravel
          ? // A no-break space after the comma: where the note wraps, the line does not end on it.
            'Prospect-safe shows the plan as of today: the date cannot be moved,\u00a0and no lease shows when it began or ends.'
          : stackedMode
            ? 'Drag the date handle to move the as-of date; the whole plan recomputes. Tap a lease for its details.'
            : 'Drag the cursor or use ← → to move the as-of date; the whole plan recomputes.'}
      </p>
    </div>
    </section>
  );
}
