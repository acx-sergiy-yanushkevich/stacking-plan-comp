import { afterEach, describe, expect, it } from 'vitest';
import { NO_HOST, createBrowserHost, onPopState, readUrl, setHost, setRootData, setTitle, shareUrl, writeUrl, type BrowserPage, type Host } from './host';

/** A page reduced to what a browser host touches, recording what is written to it. */
function fakePage(search = '?view=stack') {
  const listeners = new Set<() => void>();
  const replaced: Array<{ data: unknown; url: string }> = [];
  const page: BrowserPage = {
    location: { pathname: '/plan/', search, hash: '#top', href: `https://example.test/plan/${search}#top` },
    history: {
      state: { kept: true },
      replaceState(data, _unused, url) {
        replaced.push({ data, url });
        page.location.search = url.slice('/plan/'.length).replace(/#.*$/, '');
        page.location.href = `https://example.test${url}`;
      },
    },
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    document: { title: '', documentElement: { dataset: {} } },
  };
  return { page, replaced, listeners, back: () => listeners.forEach((l) => l()) };
}

/** A host that is not a browser at all: state in a variable, the way a record page would keep it. */
function memoryHost() {
  const log: string[] = [];
  const pop = new Set<() => void>();
  let search = '?view=map';
  const host: Host = {
    readUrl: () => search,
    writeUrl: (next) => {
      search = next;
      log.push(`url ${next}`);
    },
    shareUrl: () => `record://plan${search}`,
    setTitle: (title) => void log.push(`title ${title}`),
    setRootData: (name, value) => void log.push(`data ${name}=${value}`),
    onPopState: (listener) => {
      pop.add(listener);
      return () => void pop.delete(listener);
    },
  };
  return { host, log, pop };
}

afterEach(() => {
  setHost(null);
});

describe('browser host', () => {
  it('reads the query string the state is parsed from', () => {
    expect(createBrowserHost(fakePage('?lens=rent&safe=1').page).readUrl()).toBe('?lens=rent&safe=1');
    expect(createBrowserHost(fakePage('').page).readUrl()).toBe('');
  });

  it('writes the state with replaceState, keeping the path, the hash and the history state', () => {
    const { page, replaced } = fakePage('?view=stack');
    const host = createBrowserHost(page);
    host.writeUrl('?view=stack&safe=1');
    expect(replaced).toEqual([{ data: { kept: true }, url: '/plan/?view=stack&safe=1#top' }]);
    expect(host.readUrl()).toBe('?view=stack&safe=1');
    // The default state is an empty query string: the address goes back to the bare path.
    host.writeUrl('');
    expect(replaced.at(-1)?.url).toBe('/plan/#top');
  });

  it('does not touch the address when the state already matches it', () => {
    const { page, replaced } = fakePage('?view=stack');
    const host = createBrowserHost(page);
    host.writeUrl('?view=stack');
    expect(replaced).toEqual([]);
  });

  it('gives the whole address for a copied link', () => {
    expect(createBrowserHost(fakePage('?view=map').page).shareUrl()).toBe('https://example.test/plan/?view=map#top');
  });

  it('names the tab', () => {
    const { page } = fakePage();
    createBrowserHost(page).setTitle('Preston Park · Stacking plan (prospect-safe)');
    expect(page.document.title).toBe('Preston Park · Stacking plan (prospect-safe)');
  });

  it('sets and removes a flag on the root element', () => {
    const { page } = fakePage();
    const host = createBrowserHost(page);
    host.setRootData('theme', 'dark');
    host.setRootData('palette', 'vice');
    expect(page.document.documentElement.dataset).toEqual({ theme: 'dark', palette: 'vice' });
    host.setRootData('theme', null);
    expect(page.document.documentElement.dataset).toEqual({ palette: 'vice' });
    expect('theme' in page.document.documentElement.dataset).toBe(false);
  });

  it('tells a listener about Back and Forward until it is told to stop', () => {
    const { page, listeners, back } = fakePage();
    let calls = 0;
    const stop = createBrowserHost(page).onPopState(() => calls++);
    back();
    back();
    expect(calls).toBe(2);
    stop();
    expect(listeners.size).toBe(0);
    back();
    expect(calls).toBe(2);
  });
});

describe('the host in use', () => {
  it('is nothing where there is no page: reads are empty and writes do nothing', () => {
    // The unit tests run without a window.
    expect(typeof window).toBe('undefined');
    expect(readUrl()).toBe('');
    expect(shareUrl()).toBe('');
    expect(() => {
      writeUrl('?view=stack');
      setTitle('x');
      setRootData('theme', 'dark');
      onPopState(() => {})();
    }).not.toThrow();
    expect(NO_HOST.readUrl()).toBe('');
  });

  it('is the one supplied: every call goes to it, and none to a browser', () => {
    const { host, log, pop } = memoryHost();
    expect(setHost(host)).toBeNull();
    expect(readUrl()).toBe('?view=map');
    writeUrl('?view=map&lens=rent');
    expect(readUrl()).toBe('?view=map&lens=rent');
    expect(shareUrl()).toBe('record://plan?view=map&lens=rent');
    setTitle('Stacking plan');
    setRootData('skin', 'classic');
    setRootData('palette', null);
    expect(log).toEqual(['url ?view=map&lens=rent', 'title Stacking plan', 'data skin=classic', 'data palette=null']);
    const stop = onPopState(() => log.push('popped'));
    pop.forEach((l) => l());
    stop();
    expect(log.at(-1)).toBe('popped');
    expect(pop.size).toBe(0);
  });

  it('setHost returns the host it replaced, so it can be put back', () => {
    const a = memoryHost().host;
    const b = memoryHost().host;
    setHost(a);
    expect(setHost(b)).toBe(a);
    expect(setHost(null)).toBe(b);
    expect(readUrl()).toBe('');
  });
});
