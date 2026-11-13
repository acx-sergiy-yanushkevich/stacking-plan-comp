import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The motion rules (docs/DESIGN.md §3.5), read from every stylesheet: motion stays short, a figure never
 * moves, and an entrance never runs where a copy of the plan is taken (the PNG export inlines the
 * opacity it finds, and the print layout is the PDF).
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : [],
  );
}

interface Rule {
  file: string;
  selector: string;
  body: string;
}

/** The style rules of a stylesheet, those inside @media, @supports and @container included; keyframes are left out. */
function rules(css: string, file: string): Rule[] {
  const out: Rule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) return;
      const prelude = s.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        j++;
      }
      const inner = s.slice(open + 1, j - 1);
      if (prelude.startsWith('@keyframes')) {
        // Frames, not rules.
      } else if (prelude.startsWith('@')) walk(inner);
      else out.push({ file, selector: prelude, body: inner });
      i = j;
    }
  };
  walk(text);
  return out;
}

const files = cssFiles(SRC);
const all = files.flatMap((f) => rules(readFileSync(f, 'utf8'), f.slice(SRC.length)));

/** Custom properties as declared anywhere (the first declaration wins): enough to read a duration token. */
const vars = new Map<string, string>();
for (const r of all) for (const m of r.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
const resolve = (v: string): string => {
  let out = v;
  for (let n = 0; n < 5; n++) out = out.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^()]*))?\)/g, (_, name: string, fallback?: string) => vars.get(name) ?? fallback ?? '');
  return out;
};

const declarations = (body: string, props: RegExp) =>
  [...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/g)].filter((m) => props.test(m[1])).map((m) => ({ prop: m[1], value: m[2].trim() }));

const ms = (t: string) => (t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000);
const LOOPS = /sp-rec-pulse|sp-skel-shimmer/;

describe('motion', () => {
  it('reads the stylesheets', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(all.length).toBeGreaterThan(500);
    // The only motion longer than the limit is the two loops excused below: the reader must see them.
    const loops = all.flatMap((r) => declarations(r.body, /^animation$/)).filter((d) => LOOPS.test(d.value));
    expect(loops.length).toBeGreaterThanOrEqual(2);
    expect(all.some((r) => declarations(r.body, /^transition$/).some((d) => resolve(d.value).includes('120ms')))).toBe(true);
  });

  it('keeps every animation and transition at 450 ms or less, loops aside', () => {
    const long: string[] = [];
    for (const r of all) {
      for (const d of declarations(r.body, /^(animation|transition)(-duration)?$/)) {
        if (LOOPS.test(d.value)) continue;
        for (const part of resolve(d.value).split(/,(?![^(]*\))/)) {
          // The first time in a part is its duration; a later one is its delay.
          const first = part.match(/(?<![\w-])(\d*\.?\d+)(ms|s)(?![\w-])/);
          if (first && ms(first[0]) > 450) long.push(`${r.file} ${r.selector} → ${d.prop}: ${d.value}`);
        }
      }
    }
    expect(long).toEqual([]);
  });

  it('never animates a figure or the as-of cursor', () => {
    const moving = all
      .filter((r) => /\.sp-kpi__(figure|delta|value)|\.sp-cursor/.test(r.selector))
      .flatMap((r) => declarations(r.body, /^(animation|transition)/).filter((d) => !/^none\b/.test(d.value)).map((d) => `${r.file} ${r.selector} → ${d.prop}: ${d.value}`));
    expect(moving).toEqual([]);
  });

  it('runs entrances only on the live page', () => {
    const LIVE = /\.sp-stage|\.sp-kpis|\.sp-inspector|\.sp-sheet/;
    const loose = all
      // A keyframes name, not a token such as `--sp-enter-curve`.
      .filter((r) => declarations(r.body, /^animation(-name)?$/).some((d) => /(?<![\w-])sp-enter-/.test(d.value)))
      .flatMap((r) => r.selector.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => !LIVE.test(s)).map((s) => `${r.file} ${s}`));
    expect(loose).toEqual([]);
  });

  it('turns every animation and transition off under reduced motion', () => {
    const base = readFileSync(join(SRC, 'styles/base.css'), 'utf8');
    expect(base).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ transition: none !important; animation: none !important;/);
  });
});
