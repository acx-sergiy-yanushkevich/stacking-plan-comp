import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_HOST, copyText, createBrowserHost, find, focused, hasPage, onPopState, print, readUrl, requestFrame, setHost, setRootData, setRootStyle, setTitle, shareUrl, viewport, writeUrl, type BrowserPage, type Host } from './host';

/** A page reduced to what a browser host touches, recording what is written to it and what listens. */
function fakePage(search = '?view=stack') {
  const heard = new Map<string, Set<(e: Event) => void>>();
  const listens = (where: string) => ({
    addEventListener: (type: string, listener: (e: Event) => void) => void (heard.get(`${where}:${type}`) ?? heard.set(`${where}:${type}`, new Set()).get(`${where}:${type}`)!).add(listener),
    removeEventListener: (type: string, listener: (e: Event) => void) => void heard.get(`${where}:${type}`)?.delete(listener),
  });
  const replaced: Array<{ data: unknown; url: string }> = [];
  const log: string[] = [];
  const vars: Record<string, string> = { '--sp-color-card': ' #fff ' };
  const media = { matches: true, changed: new Set<() => void>() };
  const frames = new Map<number, (time: number) => void>();
  const body = { appendChild: (el: unknown) => void log.push(`append ${(el as { tag: string }).tag}`) } as unknown as HTMLElement;
  const root = {
    dataset: {} as Record<string, string | undefined>,
    clientWidth: 1265,
    style: { setProperty: (name: string, value: string) => void (vars[name] = value), removeProperty: (name: string) => void delete vars[name] },
  } as unknown as BrowserPage['document']['documentElement'];
  const page: BrowserPage = {
    ...listens('window'),
    location: { pathname: '/plan/', search, hash: '#top', href: `https://example.test/plan/${search}#top` },
    history: {
      state: { kept: true },
      replaceState(data, _unused, url) {
        replaced.push({ data, url });
        page.location.search = url.slice('/plan/'.length).replace(/#.*$/, '');
        page.location.href = `https://example.test${url}`;
      },
    },
    innerHeight: 800,
    navigator: { clipboard: { writeText: async (text) => void log.push(`copy ${text}`) } },
    scrollBy: ({ top, behavior }) => void log.push(`scroll ${top} ${behavior}`),
    print: () => void log.push('print'),
    getComputedStyle: () => ({ getPropertyValue: (name) => vars[name] ?? '' }),
    matchMedia: () => ({
      get matches() {
        return media.matches;
      },
      addEventListener: (_type, listener) => void media.changed.add(listener),
      removeEventListener: (_type, listener) => void media.changed.delete(listener),
    }),
    requestAnimationFrame: (callback) => {
      frames.set(frames.size + 1, callback);
      return frames.size;
    },
    cancelAnimationFrame: (handle) => void frames.delete(handle),
    document: {
      ...listens('document'),
      title: '',
      documentElement: root,
      body,
      activeElement: body,
      querySelector: (selector) => (selector === '.missing' ? null : ({ selector } as unknown as Element)),
      querySelectorAll: (selector) => [{ selector, n: 1 }, { selector, n: 2 }] as unknown as Element[],
      createElement: (tag) => ({ tag, click: () => log.push(`click ${tag}`), remove: () => log.push(`remove ${tag}`) }) as unknown as HTMLElement,
    },
  };
  const fire = (key: string) => heard.get(key)?.forEach((l) => l({ type: key } as unknown as Event));
  return { page, replaced, heard, log, vars, media, frames, body, fire, back: () => fire('window:popstate') };
}

/** A host that is not a browser at all: state in a variable, the way a record page would keep it. */
function memoryHost() {
  const log: string[] = [];
  const pop = new Set<() => void>();
  let search = '?view=map';
  const host: Host = {
    ...NO_HOST,
    readUrl: () => search,
    writeUrl: (next) => {
      search = next;
      log.push(`url ${next}`);
    },
    shareUrl: () => `record://plan${search}`,
    setTitle: (title) => void log.push(`title ${title}`),
    setRootData: (name, value) => void log.push(`data ${name}=${value}`),
    setRootStyle: (name, value) => void log.push(`style ${name}=${value}`),
    print: () => void log.push('print'),
    copyText: async (text) => void log.push(`copy ${text}`),
    viewport: () => ({ width: 640, height: 480 }),
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
    const { page, heard, back } = fakePage();
    let calls = 0;
    const stop = createBrowserHost(page).onPopState(() => calls++);
    back();
    back();
    expect(calls).toBe(2);
    stop();
    expect(heard.get('window:popstate')?.size).toBe(0);
    back();
    expect(calls).toBe(2);
  });
});

describe('browser host: the element the plan is drawn in', () => {
  it('sets, reads and removes a style variable on the root element', () => {
    const { page, vars } = fakePage();
    const host = createBrowserHost(page);
    host.setRootStyle('--sp-sheet-cover', '320px');
    expect(vars['--sp-sheet-cover']).toBe('320px');
    expect(host.readRootStyle('--sp-sheet-cover')).toBe('320px');
    // What the styles give is trimmed: a custom property keeps the spaces it was written with.
    expect(host.readRootStyle('--sp-color-card')).toBe('#fff');
    host.setRootStyle('--sp-sheet-cover', null);
    expect(host.readRootStyle('--sp-sheet-cover')).toBe('');
  });

  it('finds elements with the selector it is given', () => {
    const host = createBrowserHost(fakePage().page);
    expect(host.find('.sp-sheet')).toEqual({ selector: '.sp-sheet' });
    expect(host.find('.missing')).toBeNull();
    expect(host.findAll('.sp-stage button')).toHaveLength(2);
  });

  it('reports the focused element, and nothing when focus is on the page itself', () => {
    const { page, body } = fakePage();
    const host = createBrowserHost(page);
    expect(page.document.activeElement).toBe(body);
    expect(host.focused()).toBeNull();
    page.document.activeElement = page.document.documentElement;
    expect(host.focused()).toBeNull();
    page.document.activeElement = null;
    expect(host.focused()).toBeNull();
    const button = { tag: 'button' } as unknown as Element;
    page.document.activeElement = button;
    expect(host.focused()).toBe(button);
  });
});

describe('browser host: the window the plan is shown in', () => {
  it('gives the layout width and the visible height', () => {
    expect(createBrowserHost(fakePage().page).viewport()).toEqual({ width: 1265, height: 800 });
  });

  it('scrolls the page, smoothly only when asked', () => {
    const { page, log } = fakePage();
    const host = createBrowserHost(page);
    host.scrollBy(120);
    host.scrollBy(-40, true);
    expect(log).toEqual(['scroll 120 auto', 'scroll -40 smooth']);
  });

  it('answers a media query now and tells a listener when the answer changes', () => {
    const { page, media } = fakePage();
    const query = createBrowserHost(page).media('(max-width: 760px)');
    expect(query.matches()).toBe(true);
    let calls = 0;
    const stop = query.onChange(() => calls++);
    media.matches = false;
    media.changed.forEach((l) => l());
    expect(query.matches()).toBe(false);
    expect(calls).toBe(1);
    stop();
    expect(media.changed.size).toBe(0);
  });

  it('answers false where the page has no media queries', () => {
    const { page } = fakePage();
    page.matchMedia = undefined;
    const query = createBrowserHost(page).media('(prefers-reduced-motion: reduce)');
    expect(query.matches()).toBe(false);
    expect(() => query.onChange(() => {})()).not.toThrow();
  });

  it('hears keys and pointers on the document and the rest on the window, until told to stop', () => {
    const { page, heard, fire } = fakePage();
    const host = createBrowserHost(page);
    const got: string[] = [];
    const stops = [
      host.on('keydown', (e) => got.push(e.type)),
      host.on('pointerdown', (e) => got.push(e.type)),
      host.on('resize', (e) => got.push(e.type)),
      host.on('wheel', (e) => got.push(e.type), { passive: true }),
      host.on('beforeprint', (e) => got.push(e.type)),
    ];
    for (const key of ['document:keydown', 'document:pointerdown', 'window:resize', 'window:wheel', 'window:beforeprint']) fire(key);
    expect(got).toEqual(['document:keydown', 'document:pointerdown', 'window:resize', 'window:wheel', 'window:beforeprint']);
    // Nothing was put on the other target.
    expect(heard.has('window:keydown')).toBe(false);
    expect(heard.has('document:resize')).toBe(false);
    stops.forEach((stop) => stop());
    expect([...heard.values()].every((set) => set.size === 0)).toBe(true);
  });
});

describe('browser host: services of the page', () => {
  it('prints, and copies text', async () => {
    const { page, log } = fakePage();
    const host = createBrowserHost(page);
    host.print();
    await host.copyText('https://example.test/plan/?view=map');
    expect(log).toEqual(['print', 'copy https://example.test/plan/?view=map']);
  });

  it('rejects a copy where the page has no clipboard', async () => {
    const { page } = fakePage();
    page.navigator = {};
    await expect(createBrowserHost(page).copyText('x')).rejects.toThrow('clipboard');
  });

  it('saves a file through a temporary link that is clicked, then removed', () => {
    vi.useFakeTimers();
    const { page, log } = fakePage();
    createBrowserHost(page).saveFile(new Blob(['suite,sf']), 'rent-roll.csv');
    expect(log).toEqual(['append a', 'click a', 'remove a']);
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('makes an element, and puts it in the page only when asked', () => {
    const { page, log } = fakePage();
    const host = createBrowserHost(page);
    const span = host.createElement('span');
    expect(span).toMatchObject({ tag: 'span' });
    expect(log).toEqual([]);
    host.attach(span!);
    expect(log).toEqual(['append span']);
  });

  it('asks for a frame and can call it off', () => {
    const { page, frames } = fakePage();
    const host = createBrowserHost(page);
    let ran = 0;
    const first = host.requestFrame(() => ran++);
    const second = host.requestFrame(() => ran++);
    host.cancelFrame(first);
    host.cancelFrame(null);
    frames.forEach((callback) => callback(0));
    expect(second).toBe(2);
    expect(ran).toBe(1);
  });

  it('hands a frame its time', () => {
    const { page } = fakePage();
    page.requestAnimationFrame = (callback) => {
      callback(1234.5);
      return 7;
    };
    const times: number[] = [];
    expect(createBrowserHost(page).requestFrame((time) => times.push(time))).toBe(7);
    expect(times).toEqual([1234.5]);
  });

  it('has no frames where the page does not paint: the caller is told with null', () => {
    const { page } = fakePage();
    page.requestAnimationFrame = undefined;
    expect(createBrowserHost(page).requestFrame(() => {})).toBeNull();
  });

  it('tells a listener when the fonts have loaded, and again when more load', async () => {
    const { page } = fakePage();
    const later = new Set<() => void>();
    page.document.fonts = { ready: Promise.resolve(), addEventListener: (_type, listener) => void later.add(listener) };
    let calls = 0;
    createBrowserHost(page).onFontsLoaded(() => calls++);
    await Promise.resolve();
    expect(calls).toBe(1);
    later.forEach((l) => l());
    expect(calls).toBe(2);
  });

  it('leaves a named handle on the page for a test script', () => {
    const { page } = fakePage();
    createBrowserHost(page).expose('__spMap', { zoom: 15 });
    expect((page as unknown as Record<string, unknown>).__spMap).toEqual({ zoom: 15 });
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
    // Nothing to find, nothing focused, no size, and no frame: the caller is told, not left waiting.
    expect(hasPage()).toBe(false);
    expect(find('.sp-sheet')).toBeNull();
    expect(focused()).toBeNull();
    expect(viewport()).toEqual({ width: 0, height: 0 });
    expect(requestFrame(() => {})).toBeNull();
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
    // The duties beyond the address go to it too.
    expect(hasPage()).toBe(true);
    setRootStyle('--sp-sheet-cover', '40px');
    print();
    void copyText('record://plan');
    expect(log.slice(-3)).toEqual(['style --sp-sheet-cover=40px', 'print', 'copy record://plan']);
    expect(viewport()).toEqual({ width: 640, height: 480 });
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

describe('browser host: what the browser keeps between visits (round 26)', () => {
  it('reads and writes the local storage, and is quiet where the browser keeps nothing', () => {
    const kept = new Map<string, string>();
    const { page } = fakePage();
    const host = createBrowserHost({ ...page, localStorage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) } });
    expect(host.readStore('a')).toBeNull();
    host.writeStore('a', '1');
    expect(host.readStore('a')).toBe('1');
    // Blocked site data throws on use; a page without storage has none: neither breaks the plan.
    const refusing = createBrowserHost({ ...page, localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(refusing.readStore('a')).toBeNull();
    expect(() => refusing.writeStore('a', '1')).not.toThrow();
    expect(createBrowserHost(page).readStore('a')).toBeNull();
    expect(NO_HOST.readStore('a')).toBeNull();
  });
});

