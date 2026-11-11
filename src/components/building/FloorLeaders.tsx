import { useLayoutEffect, useRef, useState } from 'react';
import { sizeObserver } from '../../lib/host';

export interface FloorLeadersProps {
  /** The floors, top first: one leader each. */
  ids: string[];
  /** The floor pointed at or focused: its leader is drawn in the accent colour. */
  hotId: string | null;
}

interface Leader {
  id: string;
  /** The floor's end of the line (a small dot marks it). */
  x: number;
  y: number;
  d: string;
}

/** Where an element sits inside `root` as laid out: a transform on the way (the model's glide) is left out. */
function placeIn(el: HTMLElement, root: HTMLElement): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n !== root; n = n.offsetParent as HTMLElement | null) {
    if (!n) return null;
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

/** How far a leader runs level before and after it slants, in px. */
const STUB = 6;

/**
 * A thin line from each label of the list of floors to its floor on the model, so every label stands
 * beside its own floor at every window size. A label is a button 24 px tall; in a low window the model's
 * floors are drawn closer together than that, and the top and bottom labels would otherwise sit a few
 * floors' height away from the floors they name. Where the floors are 24 px apart or more the labels are
 * level with them and the leaders are short level ticks.
 *
 * The model gives each floor's point on its right-hand edge (hero, `[data-anchor]`); the leader leaves
 * it level, slants across the gap between the drawing and the list, and meets the label level. The lines
 * are decoration for the eye (each label names its floor in words), so they are hidden from assistive
 * technology and take no pointer events. Positions are read from the layout, so a model that is still
 * gliding into place does not skew them, and again whenever the model or the list changes size.
 */
export function FloorLeaders({ ids, hotId }: FloorLeadersProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const key = ids.join(' ');
  useLayoutEffect(() => {
    const svg = ref.current;
    const root = svg?.closest<HTMLElement>('.sp-hero--stage');
    if (!svg || !root) return;
    const canvas = root.querySelector<HTMLElement>('.sp-hero__canvas');
    const measure = () => {
      const next: Leader[] = [];
      const edge = canvas ? placeIn(canvas, root) : null;
      for (const id of key ? key.split(' ') : []) {
        const anchor = root.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(id)}"]`);
        const label = root.querySelector<HTMLElement>(`.sp-flabel[data-floor="${CSS.escape(id)}"]`);
        const a = anchor && placeIn(anchor, root);
        const l = label && placeIn(label, root);
        if (!a || !l || !label || !canvas || !edge) continue;
        const x0 = a.x + 4;
        const x1 = l.x - 2;
        const y1 = l.y + label.offsetHeight / 2;
        // Level to the drawing's right-hand edge, a slant across the gap, level into the label.
        const turn = Math.max(x0 + STUB, edge.x + canvas.offsetWidth);
        const land = x1 - STUB;
        if (x1 - x0 < 8) continue;
        const d = turn < land ? `M${x0} ${a.y}H${turn}L${land} ${y1}H${x1}` : `M${x0} ${a.y}L${x1} ${y1}`;
        next.push({ id, x: x0, y: a.y, d: d.replace(/(\.\d)\d+/g, '$1') });
      }
      setLeaders((prev) => (prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.d === next[i].d) ? prev : next));
    };
    measure();
    const ro = sizeObserver(measure);
    if (!ro) return;
    ro.observe(root);
    if (canvas) ro.observe(canvas);
    const list = root.querySelector('.sp-flabels__list');
    if (list) ro.observe(list);
    return () => ro.disconnect();
  }, [key]);
  return (
    <svg ref={ref} className="sp-fleaders" aria-hidden="true" focusable="false">
      {leaders.map((l) => (
        <g key={l.id} className={`sp-fleader ${l.id === hotId ? 'is-hot' : ''}`}>
          <path d={l.d} />
          <circle cx={l.x} cy={l.y} r={1.75} />
        </g>
      ))}
    </svg>
  );
}
