/**
 * Rasterise a plan SVG to PNG at `scale`×. The image is drawn from a copy of the SVG that stands on
 * its own, because a serialised SVG is a separate document: nothing outside it applies.
 *
 *  - Styles: every element's computed paint and type properties are written onto the copy, so CSS
 *    variables, classes and fonts survive.
 *  - Definitions: a fill such as `url(#sp-dots)` points at a `<pattern>` that lives in another SVG of
 *    the page (the shared `<Patterns/>`). Left alone it resolves to nothing in the copy and the sublease
 *    dots and the committed hatching disappear. Every definition the copy refers to is copied into it,
 *    with its own computed colours, and every `url(…#id)` is rewritten to the local `url(#id)`.
 *  - Size: the SVG's rendered box. An SVG that is not rendered (the plan inside the hidden print
 *    layout is the only plan in the page on a phone, and in every view but the Stack) has no box and
 *    is laid out for no width, so it is never rasterised: the page is asked for a plan drawn off-screen
 *    at a fixed width instead (`PLAN_SVG_REQUEST`, answered by `components/print/ExportStage`).
 *
 * Anything that cannot be exported throws an `Error` whose message says why, for the caller's toast.
 */

import { computedStyle, createElement, readRootStyle } from './host';
import { createSignal } from './signal';

/** Width, in CSS px, of the plan drawn off-screen for an export when no plan is on screen. */
export const EXPORT_PLAN_WIDTH = 1200;

export interface PlanSvgRequest {
  provide: (plan: Promise<{ svg: SVGSVGElement; release: () => void }>) => void;
}
/**
 * Asks for a rendered plan SVG. The listener calls `provide` with a promise of the SVG and a function
 * that releases it (unmounts the off-screen plan). No listener, no plan.
 */
export const PLAN_SVG_REQUEST = createSignal<PlanSvgRequest>();

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'letter-spacing', 'text-anchor', 'text-transform', 'dominant-baseline',
  'paint-order', 'display', 'color',
];

/** `url("http://host/page?x=1#sp-dots")` or `url('#sp-dots')` → `url(#sp-dots)`; anything without a fragment is left as it is. */
export function localUrls(value: string): string {
  return value.replace(/url\(\s*(['"]?)[^'")]*#([^'")\s]+)\1\s*\)/g, 'url(#$2)');
}

/** The ids a piece of SVG markup (or a style string) points at: `url(#id)`, with or without quotes or a page URL, and `href="#id"`. */
export function referencedIds(markup: string): string[] {
  const ids = new Set<string>();
  // Serialised markup writes the quotes and ampersands of a style attribute as entities.
  const text = markup.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
  for (const m of text.matchAll(/url\(\s*['"]?[^'")]*#([^'")\s]+)/g)) ids.add(m[1]);
  for (const m of text.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) ids.add(m[1]);
  return [...ids];
}

/**
 * The size of the image, in CSS px: the rendered box, else the SVG's own `width` and `height`, else
 * its `viewBox`. Null when none of them gives a real area (an SVG that was never laid out).
 */
export function imageSize(
  box: { width: number; height: number },
  attrs: { width?: string | null; height?: string | null; viewBox?: string | null } = {},
): { w: number; h: number } | null {
  const real = (w: number, h: number) => (Number.isFinite(w) && Number.isFinite(h) && w >= 1 && h >= 1 ? { w: Math.ceil(w), h: Math.ceil(h) } : null);
  // Only plain numbers count as attributes: "100%" and "auto" say nothing about pixels.
  const px = (v: string | null | undefined) => (v != null && /^\s*\d+(\.\d+)?(px)?\s*$/.test(v) ? parseFloat(v) : NaN);
  const vb = (attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  return real(box.width, box.height) ?? real(px(attrs.width), px(attrs.height)) ?? (vb.length === 4 ? real(vb[2], vb[3]) : null);
}

function inlineStyles(src: Element, dst: Element) {
  const cs = computedStyle(src);
  if (!cs) return;
  const parts: string[] = [];
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) parts.push(`${p}:${localUrls(v)}`);
  }
  dst.setAttribute('style', parts.join(';'));
  // Presentation attributes that point at a definition are made local as well.
  for (const name of ['fill', 'stroke', 'mask', 'clip-path', 'filter']) {
    const v = dst.getAttribute(name);
    if (v && v.includes('url(')) dst.setAttribute(name, localUrls(v));
  }
  const sc = src.children;
  const dc = dst.children;
  for (let i = 0; i < sc.length; i++) if (dc[i]) inlineStyles(sc[i], dc[i]);
}

/**
 * Copy into `clone` every definition it refers to and does not contain (patterns, gradients, clip
 * paths, masks), each with the colours it computes to in the page, and repeat for whatever those
 * refer to. Returns the ids that were copied.
 */
function inlineDefinitions(clone: SVGSVGElement, doc: Document): string[] {
  const serializer = new XMLSerializer();
  const defs = doc.createElementNS(SVG_NS, 'defs');
  const copied: string[] = [];
  const missing = new Set<string>();
  for (let pass = 0; pass < 8; pass++) {
    const wanted = referencedIds(serializer.serializeToString(clone) + serializer.serializeToString(defs)).filter((id) => !copied.includes(id) && !missing.has(id));
    let added = 0;
    for (const id of wanted) {
      const inside = [...clone.querySelectorAll('[id]')].some((el) => el.id === id);
      const source = inside ? null : doc.getElementById(id);
      if (!source) {
        if (!inside) missing.add(id);
        continue;
      }
      const copy = source.cloneNode(true) as Element;
      inlineStyles(source, copy);
      defs.appendChild(copy);
      copied.push(id);
      added++;
    }
    if (added === 0) break;
  }
  if (copied.length) clone.insertBefore(defs, clone.firstChild);
  return copied;
}

/** The markup of `svg` as a file of its own (see the header), with the size the image is drawn at. */
export function standaloneSvg(svg: SVGSVGElement): { xml: string; w: number; h: number; definitions: string[] } {
  const size = imageSize(svg.getBoundingClientRect(), { width: svg.getAttribute('width'), height: svg.getAttribute('height'), viewBox: svg.getAttribute('viewBox') });
  if (!size) throw new Error('The plan has no size to export: it is not drawn on this screen.');
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  const definitions = inlineDefinitions(clone, svg.ownerDocument);
  clone.setAttribute('width', String(size.w));
  clone.setAttribute('height', String(size.h));
  clone.setAttribute('xmlns', SVG_NS);
  // Titles become tooltips only; drop them from the image markup.
  clone.querySelectorAll('title').forEach((t) => t.remove());
  return { xml: new XMLSerializer().serializeToString(clone), ...size, definitions };
}

/** True when the SVG is laid out on this screen: only then is its geometry the plan's. */
const isRendered = (svg: SVGSVGElement) => {
  const r = svg.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
};

/** Ask the page for a plan drawn off-screen at `EXPORT_PLAN_WIDTH`; null when nothing answers. */
async function offscreenPlan(): Promise<{ svg: SVGSVGElement; release: () => void } | null> {
  let answer: Promise<{ svg: SVGSVGElement; release: () => void }> | null = null;
  PLAN_SVG_REQUEST.emit({ provide: (plan) => (answer = plan) });
  return answer;
}

async function rasterise(xml: string, w: number, h: number, scale: number, background?: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('The browser could not draw the plan as an image.'));
      img.src = url;
    });
    const canvas = createElement('canvas');
    if (!canvas) throw new Error('The browser could not draw the plan as an image.');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The browser could not draw the plan as an image.');
    ctx.fillStyle = background ?? (readRootStyle('--sp-color-card') || '#fff');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b && b.size > 0 ? res(b) : rej(new Error('The browser produced an empty image.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * PNG of a plan SVG. `svg` is used as given when it is on screen; when it is not rendered (see the
 * header) a plan drawn off-screen takes its place, so the export works from a phone and from every view.
 */
export async function svgToPng(svg: SVGSVGElement, scale = 2, background?: string): Promise<Blob> {
  if (isRendered(svg)) {
    const { xml, w, h } = standaloneSvg(svg);
    return rasterise(xml, w, h, scale, background);
  }
  const plan = await offscreenPlan();
  if (!plan) throw new Error('The plan is not drawn on this screen, so there is nothing to export. Open the Stack view and try again.');
  try {
    const { xml, w, h } = standaloneSvg(plan.svg);
    return await rasterise(xml, w, h, scale, background);
  } finally {
    plan.release();
  }
}
