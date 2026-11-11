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

export function StaxMark({ size = 40 }: { size?: number }) {
  const glyph = Math.round(size * 0.65);
  return (
    <span className="sp-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={glyph} height={glyph} viewBox="0 0 64 64" focusable="false">
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
