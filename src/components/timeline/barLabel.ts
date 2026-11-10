import type { ISODate } from '../../domain/types';
import type { Segment } from '../../domain/derive';
import type { TimelineBar } from '../../domain/timeline';
import type { LensId } from '../../domain/lenses';
import { sf } from '../../domain/format';
import { fmtDate } from '../../domain/dates';
import { tenantLabel } from '../../domain/safe';
import { measure } from '../../lib/textFit';
import { segmentText, type SegmentText } from '../plan/segmentText';

export const NAME_FONT = '600 12px Inter, system-ui, sans-serif';
export const SUB_FONT = '11px Inter, system-ui, sans-serif';
export const TAG_FONT = '600 11px Inter, system-ui, sans-serif';

export interface BarLabelContext {
  safe: boolean;
  asOf: ISODate;
  today: ISODate;
  lens: LensId;
  floorName: string;
}

export interface BarLabel {
  /** The segment's text in the active lens (tone, pattern, tooltip, accessible name). */
  text: SegmentText;
  /** Who or what the bar is: tenant, "Available · Ste 1250", "Vacates Apr '27". */
  name: string;
  /** Its facts, " · "-separated: suite, SF, dates, rent. */
  sub: string;
  /** "Holdover" or "MTM"; null for every other bar, and always null in prospect-safe mode. */
  risk: 'Holdover' | 'MTM' | null;
}

/**
 * What a timeline bar says, independent of how much of it fits. The wide chart fits as much as
 * the bar holds; the stacked chart writes all of it above the bar.
 */
export function barLabel(bar: TimelineBar, seg: Segment, ctx: BarLabelContext): BarLabel {
  const text = segmentText(seg, ctx);
  const { safe } = ctx;
  const isMkt = bar.key.endsWith('-mkt');
  const isNext = bar.key.endsWith('-next');
  const isSubBar = bar.key.endsWith('-sub');
  const isAvail = bar.kind === 'available' || bar.kind === 'forsale';
  const isProjected = bar.kind === 'projected';
  // Prospects never see tenant risk: in safe mode holdover and MTM read as plain leases.
  const safeRisk = safe && (bar.kind === 'mtm' || bar.kind === 'holdover');
  const name = isNext && seg.next
    ? tenantLabel(seg.next.lease, safe)
    : isMkt || isSubBar || isAvail
      ? bar.label
      : isProjected && seg.lease
        ? `${tenantLabel(seg.lease, safe)} · vacated`
        : text.name;
  const sub = isNext && seg.next
    ? `Ste ${seg.next.unit.suite} · ${sf(seg.next.unit.size)} · moves in ${fmtDate(seg.next.lease.commencement)}`
    : isMkt && seg.marketed
      ? `${sf(seg.marketed.size)} · from ${fmtDate(bar.start)}`
      : isSubBar && seg.availability
        ? `${bar.end ? `thru ${fmtDate(bar.end)}` : 'open-ended'}`
        : isAvail
          ? `${sf(seg.size)}${text.meta ? ` · ${text.meta}` : ''}`
          : safeRisk
            ? `${text.sub} · term not disclosed`
            : text.sub;
  const risk = safe ? null : bar.kind === 'mtm' ? 'MTM' : bar.kind === 'holdover' ? 'Holdover' : null;
  return { text, name, sub, risk };
}

/** Width of a Holdover / MTM tag, including its padding. */
export const tagWidth = (word: string) => Math.ceil(measure(word, TAG_FONT)) + 10;

export interface LabelRun {
  text: string;
  kind: 'name' | 'sub';
}
export type LabelLine = LabelRun[];

const fontOf = (kind: LabelRun['kind']) => (kind === 'name' ? NAME_FONT : SUB_FONT);
const lineWidth = (line: LabelLine) => line.reduce((w, r) => w + measure(r.text, fontOf(r.kind)), 0);

/**
 * The whole label, wrapped to `maxPx`: the name, then its facts. Nothing is dropped and nothing
 * is cut: a label that does not fit on one line takes another. A line breaks between " · " parts,
 * so a figure stays with its unit ("6,500 SF"); only a part wider than a whole line breaks
 * between its words. `firstInset` is room held back on the first line (for a Holdover / MTM tag).
 */
export function wrapLabel(name: string, sub: string, maxPx: number, firstInset = 0): LabelLine[] {
  const parts: { text: string; kind: LabelRun['kind'] }[] = [
    ...name.split(' · ').filter(Boolean).map((text) => ({ text, kind: 'name' as const })),
    ...sub.split(' · ').filter(Boolean).map((text) => ({ text, kind: 'sub' as const })),
  ];
  const lines: LabelLine[] = [];
  let line: LabelLine = [];
  const room = () => maxPx - (lines.length === 0 ? firstInset : 0);
  /** `line` with `text` added after `sep`; the separator joins the run it leads, in that run's type. */
  const joined = (text: string, kind: LabelRun['kind'], sep: string): LabelLine => {
    const last = line[line.length - 1];
    if (!last) return [{ text, kind }];
    return last.kind === kind ? [...line.slice(0, -1), { text: `${last.text}${sep}${text}`, kind }] : [...line, { text: `${sep}${text}`, kind }];
  };
  const breakLine = () => {
    if (line.length) lines.push(line);
    line = [];
  };
  for (const { text, kind } of parts) {
    const next = joined(text, kind, ' · ');
    if (lineWidth(next) <= room()) {
      line = next;
      continue;
    }
    breakLine();
    if (measure(text, fontOf(kind)) <= room()) {
      line = [{ text, kind }];
      continue;
    }
    // The part alone is wider than a line: break it between words (a single word is never split).
    for (const word of text.split(' ').filter(Boolean)) {
      const withWord = joined(word, kind, ' ');
      if (line.length && lineWidth(withWord) > room()) breakLine();
      line = line.length ? joined(word, kind, ' ') : [{ text: word, kind }];
    }
  }
  breakLine();
  return lines;
}

/** The label as one string, for the accessible name. */
export const labelText = (lines: LabelLine[]) => lines.map((l) => l.map((r) => r.text).join('')).join(' ');
