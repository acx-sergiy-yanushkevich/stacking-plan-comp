import type { MiniStackDrawing } from '../../data/mock/portfolio';

/**
 * The product's own drawings: the Stax mark (a small stacking plan: floor bars, one suite open) and the
 * lockup that sets it beside the name. Colours live in shell.css as literal hex, keyed to the theme and
 * never to the palette: the brand is the same under Ascendix and Vice City.
 */

/** The bars of the mark in a 64-unit box: x, y, width, height; `open` is the one suite drawn in orange. */
const BARS: ReadonlyArray<{ x: number; y: number; w: number; h: number; open?: true }> = [
  { x: 12, y: 10, w: 40, h: 9 },
  { x: 12, y: 22, w: 24, h: 9 },
  { x: 39, y: 22, w: 13, h: 9, open: true },
  { x: 12, y: 34, w: 14, h: 9 },
  { x: 29, y: 34, w: 23, h: 9 },
  { x: 12, y: 46, w: 40, h: 9 },
];

/** The mark is the bars alone, on no tile (Clara, Nov 12): the frame is cut tight to them, so they fill the box. */
export function StaxMark({ size = 40 }: { size?: number }) {
  return (
    <span className="sp-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="11 9 42 47" focusable="false">
        {BARS.map((b) => (
          <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={2.5} className={b.open ? 'sp-mark__bar sp-mark__bar--open' : 'sp-mark__bar'} />
        ))}
      </svg>
    </span>
  );
}

export function StaxLockup({ size }: { size?: number }) {
  return (
    <span className="sp-lockup">
      <StaxMark size={size} />
      <span className="sp-lockup__text">
        <span className="sp-lockup__name">Stax</span>
        <span className="sp-lockup__by">by Ascendix</span>
      </span>
    </span>
  );
}

/**
 * A building's icon: a tiny stacking plan on a tile, four floors of suites in the building's tone and one
 * suite open in the brand orange. Each building draws its own (data/mock/portfolio.ts), so the switcher's
 * rows tell apart at a glance. Decorative: the row's name says which building it is.
 */
export function MiniStack({ drawing, size = 22 }: { drawing: MiniStackDrawing; size?: number }) {
  const x0 = 4, width = 14, gap = 1, h = 3, step = 4;
  return (
    <svg className="sp-ministack" width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="21" height="21" rx="5" className="sp-ministack__tile" />
      {drawing.floors.map((suites, f) => {
        const free = width - gap * (suites.length - 1);
        let x = x0;
        return suites.map((share, i) => {
          const w = free * share;
          const rect = <rect key={`${f}-${i}`} x={x} y={4 + f * step} width={w} height={h} rx={0.8} fill={drawing.open[0] === f && drawing.open[1] === i ? '#ff9c00' : drawing.tone} />;
          x += w + gap;
          return rect;
        });
      })}
    </svg>
  );
}
