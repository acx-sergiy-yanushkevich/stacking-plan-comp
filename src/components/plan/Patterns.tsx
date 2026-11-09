/**
 * Shared SVG pattern definitions. Render <Patterns/> once inside any <svg> that draws
 * segments, then reference `url(#sp-hatch)` etc. Patterns use currentColor, so set
 * `color` on the shape to the tone's edge colour.
 */
export const PATTERN_IDS = {
  hatch: 'sp-hatch', // committed: signed, not yet in
  dots: 'sp-dots', // sublease
  asking: 'sp-asking', // asking rent on a vacancy (rent lens)
} as const;

export function Patterns() {
  return (
    <defs>
      <pattern id={PATTERN_IDS.hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="transparent" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2" strokeOpacity="0.35" />
      </pattern>
      <pattern id={PATTERN_IDS.dots} width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="3.5" cy="3.5" r="1.1" fill="currentColor" fillOpacity="0.45" />
      </pattern>
      <pattern id={PATTERN_IDS.asking} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      </pattern>
    </defs>
  );
}

/** Pattern overlay a segment tone carries (colour is never the only cue). */
export type PatternKind = 'hatch' | 'dots' | 'asking' | 'dashed' | 'topbar' | null;
