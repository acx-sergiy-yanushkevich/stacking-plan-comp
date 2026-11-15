import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every source file under src/components and src/App.tsx. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('closing a requirement resets its kind of space (round 36)', () => {
  it('every patch that clears req also sets fit to any, an inquiry pick included (round 36: it kept a leftover fit)', () => {
    const root = join(__dirname, '..', '..');
    const files = [...sources(join(root, 'components')), join(root, 'App.tsx')];
    const missing: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/patch\(\{[^}]*\breq: null[^}]*\}|patch\(\{ q: '' \}/g)) {
        const call = m[0];
        if (!/fit: 'any'/.test(call)) missing.push(`${f.slice(root.length + 1)}: ${call.slice(0, 80)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
