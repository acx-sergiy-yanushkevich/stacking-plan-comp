import type { SVGProps } from 'react';

/** Inline icon set (Lucide-style 24-unit paths). Decorative by default: aria-hidden. */
export type IconName =
  | 'building' | 'calendar' | 'search' | 'filter' | 'download' | 'warning' | 'lock' | 'deal' | 'inquiry'
  | 'phone' | 'external' | 'close' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'play' | 'pause' | 'record'
  | 'map' | 'layers' | 'list' | 'info' | 'check' | 'arrow-left' | 'stack' | 'timeline' | 'floor' | 'plus' | 'file'
  | 'image' | 'table' | 'link' | 'video' | 'sparkle' | 'shield' | 'clock' | 'user' | 'compass' | 'tilt' | 'minus'
  | 'dollar' | 'home' | 'people' | 'train' | 'coffee' | 'sun' | 'moon' | 'more' | 'expand' | 'collapse' | 'palette'
  | 'contrast' | 'caret-down' | 'bus' | 'turn-left' | 'turn-right';

/** Icons with a filled part, drawn under the stroke. */
const FILLS: Partial<Record<IconName, string>> = {
  contrast: 'M12 3a9 9 0 0 0 0 18z',
  'caret-down': 'M8.5 10h7L12 14.5z',
};

const PATHS: Record<IconName, string> = {
  // A circle, its left half filled (FILLS): the prospect-safe mode, half of the plan held back.
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18',
  // A circle of arrow turning left (anticlockwise) or right: the building model's quarter turns.
  'turn-left': 'M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8M3 3v5h5',
  'turn-right': 'M21 12a9 9 0 1 1-9-9 9.7 9.7 0 0 1 6.7 2.7L21 8M21 3v5h-5',
  bus: 'M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2zM4 11h16M8 3v8M16 3v8M7 17v3M17 17v3M7.5 14h.01M16.5 14h.01',
  // A small solid triangle, drawn in the box of a 14 px icon so it takes the chevron's place at its width.
  'caret-down': 'M8.5 10h7L12 14.5z',
  more: 'M5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM19 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h1.8A4.5 4.5 0 0 0 21 10.2C21 6.2 17 3 12 3zM7.5 11.5h.01M10.5 7.5h.01M15 7.5h.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M4 21h16M8 7h2M8 11h2M8 15h2M12 7h2M12 11h2M12 15h2M16 11h2a2 2 0 0 1 2 2v8',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
  deal: 'M4 6h16v12H4zM4 10h16M9 14h3',
  inquiry: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 4.2 2 2 0 0 1 5 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L9 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  close: 'M6 6l12 12M18 6 6 18',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  collapse: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  record: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  layers: 'm12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  check: 'M4 12l5 5L20 6',
  'arrow-left': 'M19 12H5M11 18l-6-6 6-6',
  stack: 'M4 5h16v4H4zM4 10h16v4H4zM4 15h16v4H4z',
  timeline: 'M3 6h8M14 6h7M3 12h5M11 12h10M3 18h12M18 18h3',
  floor: 'M3 9l9-5 9 5-9 5-9-5zM3 9v6l9 5 9-5V9',
  plus: 'M12 5v14M5 12h14',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6',
  image: 'M4 5h16v14H4zM8 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5-9 9',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  video: 'M15 10l5-3v10l-5-3M3 7h12v10H3z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17z',
  shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  tilt: 'M4 18h16M6 14l6-8 6 8',
  minus: 'M5 12h14',
  dollar: 'M12 2v20M17 6.5a4 4 0 0 0-4-2.5H11a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 21a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-5-6.7',
  train: 'M6 3h12a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM4 10h16M8 21l2-4M16 21l-2-4M9 14h.01M15 14h.01',
  coffee: 'M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM16 9h2a2 2 0 1 1 0 4h-2M6 3v2M10 3v2M14 3v2',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Provide a label to make the icon meaningful to assistive tech; otherwise it is hidden. */
  label?: string;
}

export function Icon({ name, size = 16, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      className="sp-icon"
      {...rest}
    >
      {FILLS[name] && <path d={FILLS[name]} fill="currentColor" stroke="none" />}
      <path d={PATHS[name]} />
    </svg>
  );
}
