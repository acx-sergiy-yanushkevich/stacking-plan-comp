import type { DataSource } from '../../data/sources/DataSource';
import { num, usd0 } from '../../domain/format';
import type { Area } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { rememberTrigger } from '../../state/focusStore';
import { useArea } from '../map/useArea';
import { openArea, type Patch } from '../plan/actions';
import { Button } from '../ui';
import { Section } from './parts';

export interface AreaGlanceProps {
  /** Null while the data source is still answering. */
  area: Area | null;
  onOpen: () => void;
}

/**
 * "Around the building": three figures from the Area panel at the top of the Building panel, so the area
 * is seen without looking for it (the team review found it hidden behind a Map-only button). The
 * closest ring's population and median household income, and the nearest transit stop.
 */
export function AreaGlance({ area, onOpen }: AreaGlanceProps) {
  const ring = area?.rings.reduce((a, b) => (b.miles < a.miles ? b : a), area.rings[0]);
  const stop = area?.transit.reduce((a, b) => (b.distanceMi < a.distanceMi ? b : a), area.transit[0]);
  const within = ring ? `within ${ring.miles} mi` : '';
  return (
    <Section
      title="Around the building"
      className="sp-ins__area"
      aside={
        <Button size="sm" variant="ghost" iconRight="chevron-right" onClick={onOpen} title="Demographics, transit and amenities around the property">
          See area details
        </Button>
      }
    >
      {!area || !ring ? (
        <div className="sp-ins__kpis sp-ins__kpis--3" aria-busy="true" aria-label="Loading area data">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sp-ins__kpi">
              <span className="sp-ins__area-skel" />
              <span className="sp-ins__area-skel sp-ins__area-skel--value" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="sp-ins__kpis sp-ins__kpis--3">
            <div className="sp-ins__kpi">
              <span className="sp-label">Population</span>
              <span className="sp-ins__kpi-value">{num(ring.population)}</span>
              <span className="sp-ins__kpi-sub">{within}</span>
            </div>
            <div className="sp-ins__kpi">
              <span className="sp-label">HH income</span>
              <span className="sp-ins__kpi-value">{usd0(ring.medianIncome)}</span>
              <span className="sp-ins__kpi-sub">median, {ring.miles}&nbsp;mi</span>
            </div>
            <div className="sp-ins__kpi" title={stop ? `${stop.name}, ${stop.distanceMi.toFixed(1)} mi` : undefined}>
              <span className="sp-label">Transit</span>
              {stop ? (
                <>
                  <span className="sp-ins__kpi-value">{stop.distanceMi.toFixed(1)}&nbsp;mi</span>
                  <span className="sp-ins__kpi-sub">Nearest {stop.type === 'Rail' ? 'rail station' : 'bus stop'}</span>
                </>
              ) : (
                <>
                  <span className="sp-ins__kpi-value">—</span>
                  <span className="sp-ins__kpi-sub">No stops nearby</span>
                </>
              )}
            </div>
          </div>
          <p className="sp-ins__note">{area.sample ? 'Sample figures for the demo; live mode uses the Census and OpenStreetMap.' : 'US Census Bureau ACS 5-year · OpenStreetMap'}</p>
        </>
      )}
    </Section>
  );
}

export interface AreaPreviewProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
  dataSource: DataSource;
}

/** The preview with its data: the same source and Census key as the Area panel it opens. */
export function AreaPreview({ model, state, patch, dataSource }: AreaPreviewProps) {
  const area = useArea(dataSource, model.property, state.census);
  return (
    <AreaGlance
      area={area}
      onOpen={() => {
        rememberTrigger();
        openArea(patch);
      }}
    />
  );
}
