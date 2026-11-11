import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { EXPORT_PLAN_WIDTH, PLAN_SVG_REQUEST, type PlanSvgRequest } from '../../lib/exportPng';
import StackView from '../stack/StackView';

export interface ExportStageProps {
  model: PlanModel;
  state: PlanState;
}

type Plan = { svg: SVGSVGElement; release: () => void };

const noop = () => {};

/**
 * The plan for an image export when none is on screen: on a phone the Stack view is a list of cards,
 * and the Building, Timeline and Map views draw no stack at all. The only stack SVG left in the page
 * is the one inside the hidden print layout, which has no box and is laid out for no width.
 *
 * This renders nothing until `lib/exportPng` asks (`PLAN_SVG_REQUEST`). It then draws the stack
 * off-screen at a fixed width (`EXPORT_PLAN_WIDTH`), from the same model and state as the page (so the
 * lens, the as-of date and prospect-safe are whatever the user is looking at), hands the SVG over once
 * it has been laid out, and takes it away again when the export is done.
 */
export function ExportStage({ model, state }: ExportStageProps) {
  const [pending, setPending] = useState<{ resolve: (plan: Plan) => void; reject: (e: Error) => void } | null>(null);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const { provide } = (e as CustomEvent<PlanSvgRequest>).detail;
      provide(new Promise<Plan>((resolve, reject) => setPending({ resolve, reject })));
    };
    window.addEventListener(PLAN_SVG_REQUEST, onRequest);
    return () => window.removeEventListener(PLAN_SVG_REQUEST, onRequest);
  }, []);

  // Once the stage is in the page the stack measures its width and draws again; two frames later it has settled.
  useLayoutEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const release = () => setPending(null);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelled) return;
        const svg = host.current?.querySelector<SVGSVGElement>('.sp-stack__body > svg');
        if (svg) pending.resolve({ svg, release });
        else {
          pending.reject(new Error('The plan could not be drawn for the export.'));
          release();
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [pending]);

  if (!pending) return null;
  return (
    <div ref={host} className="sp-export-stage" style={{ width: EXPORT_PLAN_WIDTH }} aria-hidden="true" inert>
      <StackView model={model} state={state} patch={noop} bare />
    </div>
  );
}
