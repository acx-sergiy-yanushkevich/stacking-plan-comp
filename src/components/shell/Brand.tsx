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

/**
 * A small picture of a building for the switcher: sky over a stack of floors, in the light blue and navy
 * of the mock. It is drawn the same in both themes (a thumbnail, like a photo would be) and is decorative:
 * the switcher's name says which building is open.
 */
export function BuildingThumb({ size = 22 }: { size?: number }) {
  return (
    <svg className="sp-thumb" width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <rect width="22" height="22" rx="5" className="sp-thumb__sky" />
      <rect x="4" y="9" width="14" height="13" className="sp-thumb__tower" />
      {[11, 14, 17, 20].map((y) => (
        <rect key={y} x="5.5" y={y} width="11" height="1.4" className="sp-thumb__floor" />
      ))}
    </svg>
  );
}
