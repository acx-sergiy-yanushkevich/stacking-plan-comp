import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The plan asks its page for things through `lib/host.ts` only, so that a page that is not a browser
 * tab (a Salesforce record page hosting it as a Lightning web component) can supply them. This fails,
 * naming file and line, when any other file reaches for the page's globals itself. The entry point
 * (`main.tsx`) is the one exception: it finds the element React renders into.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const EXEMPT = new Set(['lib/host.ts', 'main.tsx']);

/** Objects of the page: a use is reading something off one, or testing for it. */
const OBJECTS = 'document|window|navigator|localStorage|sessionStorage';
/** Functions of the page: a use is any mention of the name that is not a property or an object key. */
const FUNCTIONS = 'requestAnimationFrame|cancelAnimationFrame|matchMedia';

const PATTERNS: RegExp[] = [
  // `window.x`, `document?.x`, `window['x']`, `(window as …)`: not `page.window` and not `state.window`.
  new RegExp(`(?<![\\w$.])(?:${OBJECTS})\\s*(?:\\??\\.\\s*[\\w$]|\\[|\\s+as\\b)`),
  // `typeof document`, `'x' in window`
  new RegExp(`\\b(?:typeof|in)\\s+(?:${OBJECTS})\\b`),
  // `requestAnimationFrame(…)` or the function passed on: not `page.matchMedia` and not a key `matchMedia: …`.
  new RegExp(`(?<![\\w$.])(?:${FUNCTIONS})\\b(?!\\s*\\??:)`),
];

/**
 * The source with comments and the text of string literals blanked (template literals keep their
 * `${…}` parts, which are code), line breaks kept so that line numbers still match. Rough: a regular
 * expression literal is read as code, which is harmless here.
 */
export function codeOnly(source: string): string {
  let out = '';
  let i = 0;
  /** Open template literals' brace depth inside their `${…}`, innermost last. */
  const templates: number[] = [];
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      out += c + blank(source.slice(i + 1, j)) + (source[j] ?? '');
      i = j + 1;
    } else if (c === '`' || (c === '}' && templates.length > 0 && templates[templates.length - 1] === 0)) {
      // The text of a template literal, from its opening backtick (or the `}` closing a `${…}`) on.
      if (c === '}') templates.pop();
      let j = i + 1;
      while (j < source.length && source[j] !== '`' && !(source[j] === '$' && source[j + 1] === '{')) j += source[j] === '\\' ? 2 : 1;
      out += c + blank(source.slice(i + 1, j));
      if (source[j] === '`') {
        out += '`';
        i = j + 1;
      } else {
        out += '${';
        templates.push(0);
        i = j + 2;
      }
    } else {
      if (templates.length > 0) {
        if (c === '{') templates[templates.length - 1]++;
        else if (c === '}') templates[templates.length - 1]--;
      }
      out += c;
      i++;
    }
  }
  return out;
}

/** Every use of a page global in `source`, as `line: text`. */
export function pageGlobals(source: string): string[] {
  const lines = codeOnly(source).split('\n');
  const original = source.split('\n');
  return lines.flatMap((line, n) => (PATTERNS.some((p) => p.test(line)) ? [`${n + 1}: ${original[n].trim()}`] : []));
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('the host boundary', () => {
  it('finds a use of the page in code, and not in comments, strings, properties or keys', () => {
    expect(pageGlobals('const a = document.activeElement;')).toHaveLength(1);
    expect(pageGlobals('if (typeof window === "undefined") return;')).toHaveLength(1);
    expect(pageGlobals('(window as unknown as X).__spMap = m;')).toHaveLength(1);
    expect(pageGlobals('const h = requestAnimationFrame(step);')).toHaveLength(1);
    expect(pageGlobals('const t = `${window.innerHeight}px`;')).toHaveLength(1);
    expect(pageGlobals('navigator?.clipboard;')).toHaveLength(1);
    expect(
      pageGlobals(
        [
          '// window.print() is what the host does',
          '/* document.title */',
          "const s = 'the window. document.body';",
          'const t = `in this window. ${n} floors`;',
          'patch({ window: null, mode });',
          'const w = state.window ?? page.document;',
          'function rows(window: WindowKey) {}',
          'const page = { matchMedia: () => null };',
          '<p>Try a longer window.</p>',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('no file but the host adapter and the entry point uses the page globals', () => {
    const found = sources(SRC)
      .map((path) => [relative(SRC, path).split('\\').join('/'), path] as const)
      .filter(([name]) => !EXEMPT.has(name))
      .flatMap(([name, path]) => pageGlobals(readFileSync(path, 'utf8')).map((use) => `src/${name}:${use}`));
    expect(found, `Use lib/host.ts instead of the page globals:\n${found.join('\n')}`).toEqual([]);
  });
});
