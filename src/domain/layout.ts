import type { FloorView, Segment } from './derive';

/**
 * Row width per floor: proportional to leasable RSF relative to the widest floor,
 * never narrower than `minShare` of `maxPx` (DESIGN.md §2.4). Integers.
 */
export function floorWidths(floors: FloorView[], maxPx: number, minShare = 0.6): Map<string, number> {
  const widest = floors.reduce((m, f) => Math.max(m, f.leasable), 0) || 1;
  const out = new Map<string, number>();
  for (const f of floors) {
    const share = Math.max(minShare, Math.min(1, f.leasable / widest));
    out.set(f.floor.id, Math.round(share * maxPx));
  }
  return out;
}

export interface BlockBox {
  key: string;
  x: number;
  w: number;
  /** The block was narrower than the minimum and was widened to it. */
  enlarged: boolean;
}

/**
 * Suite blocks along one floor row. Widths are proportional to RSF; any block that
 * would fall under `minPx` is pinned to `minPx` and the rest shrink proportionally so
 * that widths + gaps equal `floorPx` exactly. If every block would need enlarging the
 * row falls back to equal widths.
 */
export function blockLayout(segs: Segment[], floorPx: number, minPx = 56, gap = 2): BlockBox[] {
  const n = segs.length;
  if (n === 0) return [];
  if (n === 1) return [{ key: segs[0].key, x: 0, w: Math.max(0, Math.round(floorPx)), enlarged: false }];

  const avail = Math.max(0, floorPx - gap * (n - 1));
  const sizes = segs.map((s) => Math.max(0, s.size));
  const total = sizes.reduce((a, b) => a + b, 0);

  const enlarged = new Array<boolean>(n).fill(false);
  let widths = new Array<number>(n).fill(0);

  if (total <= 0) {
    widths = equalWidths(n, avail);
  } else {
    // Iterate: pin undersized blocks to minPx, redistribute the remainder, repeat.
    for (;;) {
      const pinned = enlarged.filter(Boolean).length;
      if (pinned === n) break;
      const budget = avail - pinned * minPx;
      const freeTotal = sizes.reduce((a, s, i) => (enlarged[i] ? a : a + s), 0);
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (enlarged[i]) {
          widths[i] = minPx;
          continue;
        }
        const w = freeTotal > 0 ? (sizes[i] / freeTotal) * budget : budget / (n - pinned);
        if (w < minPx) {
          enlarged[i] = true;
          changed = true;
        } else widths[i] = w;
      }
      if (!changed) break;
    }
    if (enlarged.every(Boolean)) {
      enlarged.fill(false);
      widths = equalWidths(n, avail);
    } else {
      // Round the free blocks to integers and put the remainder on the widest one.
      const free = enlarged.map((e, i) => (e ? -1 : i)).filter((i) => i >= 0);
      let sum = enlarged.filter(Boolean).length * minPx;
      for (const i of free) {
        widths[i] = Math.floor(widths[i]);
        sum += widths[i];
      }
      const widest = free.reduce((b, i) => (widths[i] > widths[b] ? i : b), free[0]);
      widths[widest] += avail - sum;
    }
  }

  const out: BlockBox[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    out.push({ key: segs[i].key, x, w: widths[i], enlarged: enlarged[i] });
    x += widths[i] + gap;
  }
  return out;
}

function equalWidths(n: number, avail: number): number[] {
  const base = Math.floor(avail / n);
  const widths = new Array<number>(n).fill(base);
  widths[0] += avail - base * n;
  return widths;
}

/**
 * Text tier by block width (DESIGN.md §2.4):
 * 0 ≥ 200 px full facts · 1 ≥ 120 px tenant + SF · 2 ≥ 64 px SF only · 3 no text.
 */
export function textTier(w: number): 0 | 1 | 2 | 3 {
  // ≥200 full, ≥120 name + SF, ≥56 SF (and the name when it fits), else nothing but the tooltip.
  if (w >= 200) return 0;
  if (w >= 120) return 1;
  if (w >= 56) return 2;
  return 3;
}
