/**
 * Rasterise an on-screen SVG to PNG at `scale`×, inlining computed styles so CSS variables,
 * patterns and fonts survive outside the document. Background is the card colour.
 */
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'fill-opacity', 'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'text-transform', 'display', 'color'];

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const parts: string[] = [];
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) parts.push(`${p}:${v}`);
  }
  dst.setAttribute('style', parts.join(';'));
  const sc = src.children;
  const dc = dst.children;
  for (let i = 0; i < sc.length; i++) inlineStyles(sc[i], dc[i]);
}

export async function svgToPng(svg: SVGSVGElement, scale = 2, background?: string): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  const rect = svg.getBoundingClientRect();
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // Titles become tooltips only; drop them from the image markup.
  clone.querySelectorAll('title').forEach((t) => t.remove());
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG rasterisation failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background ?? (getComputedStyle(document.documentElement).getPropertyValue('--sp-color-card').trim() || '#fff');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
