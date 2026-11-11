/**
 * The page the plan lives in, as the things the plan asks of it:
 *
 *  - the address its state is kept in, and the title of the tab;
 *  - the element it is drawn in: flags and style variables the styles read, finding an element of the
 *    plan, and which of them has the keyboard;
 *  - the window it is shown in: its size, scrolling, media queries, and keys, pointers and printing
 *    that happen anywhere on the page;
 *  - services of the page: printing, the clipboard, saving a file, an element to measure with, fonts,
 *    and the next frame.
 *
 * In a browser tab those are `window` and `document` (`createBrowserHost`). No other file names
 * either of them (`host.boundary.test.ts` fails if one does, the entry point `main.tsx` aside): they
 * call the functions at the bottom of this file. A page that owns its own address, title and
 * document, such as a Salesforce record page hosting the plan as a Lightning web component, supplies
 * the same functions with `setHost` (state in the page reference, the title left to the record page,
 * flags and queries on the component's own element, focus read from its shadow root) and no other
 * file changes.
 *
 * What is not a host matter and is used directly: an element's own API (`getBoundingClientRect`,
 * `getComputedStyle(el)`, `ResizeObserver`, `MutationObserver`, `CSS.escape`), the browser's media
 * APIs a feature probes for itself (`MediaRecorder`, `canvas.captureStream`), and the language's own
 * timers, `performance.now()` and `URL`. They work the same on an element wherever it is hosted.
 *
 * Messages from one part of the plan to another go through a value both import (`lib/signal.ts`), never
 * through events dispatched on the page.
 */
export interface Host {
  // ── The address and the tab ────────────────────────────────────────────────────────────────────
  /** The query string the plan's state is read from: `''` or `?view=stack&…`. */
  readUrl(): string;
  /** Put the plan's state in the address (`''` or `?view=stack&…`) without adding a step to Back. */
  writeUrl(search: string): void;
  /** The whole address of this view, for "Copy link". */
  shareUrl(): string;
  /** Name the tab. */
  setTitle(title: string): void;
  /** Call `listener` when the user goes back or forward to another address. Returns the way to stop. */
  onPopState(listener: () => void): () => void;

  // ── The element the plan is drawn in ───────────────────────────────────────────────────────────
  /** Set a `data-<name>` flag on the element the styles hang from; `null` removes it. */
  setRootData(name: string, value: string | null): void;
  /** Set a style variable (`--sp-…`) on the element the styles hang from; `null` removes it. */
  setRootStyle(name: string, value: string | null): void;
  /** The value the styles give a variable (`--sp-…`) there, trimmed; `''` when there is none. */
  readRootStyle(name: string): string;
  /** The first element of the plan that matches `selector`. */
  find<E extends Element = HTMLElement>(selector: string): E | null;
  /** Every element of the plan that matches `selector`, in document order. */
  findAll<E extends Element = HTMLElement>(selector: string): E[];
  /** The element of the plan that has the keyboard; `null` when nothing in the plan does. */
  focused(): Element | null;

  // ── The window the plan is shown in ────────────────────────────────────────────────────────────
  /** The visible area, in CSS px: the width content is laid out in, and the height that can be seen. */
  viewport(): { width: number; height: number };
  /** Scroll the page down by `top` px (up when negative). */
  scrollBy(top: number, smooth?: boolean): void;
  /** A media query: whether it holds now, and being told when that changes. */
  media(query: string): HostMedia;
  /** Listen for something that happens anywhere on the page. Returns the way to stop. */
  on<K extends keyof HostEvents>(type: K, listener: (event: HostEvents[K]) => void, options?: { passive?: boolean }): () => void;

  // ── Services of the page ───────────────────────────────────────────────────────────────────────
  /** Open the print dialog. */
  print(): void;
  /** Put text on the clipboard. Rejects when the page may not. */
  copyText(text: string): Promise<void>;
  /** Hand the user a file to keep. */
  saveFile(blob: Blob, name: string): void;
  /** A new element that is not in the page yet (a canvas to draw on, a span to measure); `null` where there is no page. */
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] | null;
  /** Put an element made with `createElement` in the page so it is laid out. The caller keeps it out of sight. */
  attach(element: HTMLElement): void;
  /** Call `listener` when the fonts have loaded, and each time more of them do. */
  onFontsLoaded(listener: () => void): void;
  /**
   * Run `callback` before the next repaint, with the frame's time in ms (the clock of `performance.now()`).
   * Returns a handle for `cancelFrame`, or `null` where nothing is painted.
   */
  requestFrame(callback: (time: number) => void): number | null;
  /** Call off a frame asked for with `requestFrame`. */
  cancelFrame(handle: number | null): void;
  /** Leave a named handle where a test script driving the page can find it. */
  expose(name: string, value: unknown): void;
}

/** What can be listened for on the whole page, and the event each one brings. */
export interface HostEvents {
  keydown: KeyboardEvent;
  pointerdown: PointerEvent;
  wheel: WheelEvent;
  touchmove: TouchEvent;
  resize: UIEvent;
  beforeprint: Event;
  afterprint: Event;
}

export interface HostMedia {
  matches(): boolean;
  /** Call `listener` when the answer changes. Returns the way to stop. */
  onChange(listener: () => void): () => void;
}

type PageListener = (event: Event) => void;
interface Listens {
  addEventListener(type: string, listener: PageListener, options?: { passive?: boolean }): void;
  removeEventListener(type: string, listener: PageListener): void;
}

/** The parts of `window` and `document` a browser host uses: small enough to fake in a test. */
export interface BrowserPage extends Listens {
  location: { pathname: string; search: string; hash: string; href: string };
  history: { state: unknown; replaceState(data: unknown, unused: string, url: string): void };
  innerHeight: number;
  navigator: { clipboard?: { writeText(text: string): Promise<void> } };
  scrollBy(options: { top: number; behavior: 'smooth' | 'auto' }): void;
  print(): void;
  getComputedStyle(element: Element): { getPropertyValue(name: string): string };
  matchMedia?(query: string): {
    matches: boolean;
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
  };
  requestAnimationFrame?(callback: (time: number) => void): number;
  cancelAnimationFrame?(handle: number): void;
  document: Listens & {
    title: string;
    documentElement: Element & {
      dataset: Record<string, string | undefined>;
      clientWidth: number;
      style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
    };
    body: HTMLElement | null;
    activeElement: Element | null;
    querySelector(selector: string): Element | null;
    querySelectorAll(selector: string): ArrayLike<Element>;
    createElement(tag: string): HTMLElement;
    fonts?: { ready: Promise<unknown>; addEventListener?(type: 'loadingdone', listener: () => void): void };
  };
}

/** Keys and pointers are heard on the document, as the plan's own handlers expect; the rest on the window. */
const ON_DOCUMENT: ReadonlySet<keyof HostEvents> = new Set<keyof HostEvents>(['keydown', 'pointerdown']);

/** How long a saved file's object URL is kept after the click that saves it. */
const SAVE_URL_MS = 2000;

/** The host of a plan that is the page: a browser tab. */
export function createBrowserHost(page: BrowserPage): Host {
  const doc = page.document;
  return {
    readUrl: () => page.location.search,
    writeUrl: (search) => {
      const { pathname, hash } = page.location;
      // Only a real change is written: the address is not touched when the state already matches it.
      if (search === page.location.search) return;
      page.history.replaceState(page.history.state, '', `${pathname}${search}${hash}`);
    },
    shareUrl: () => page.location.href,
    setTitle: (title) => {
      doc.title = title;
    },
    onPopState: (listener) => {
      page.addEventListener('popstate', listener);
      return () => page.removeEventListener('popstate', listener);
    },

    setRootData: (name, value) => {
      const flags = doc.documentElement.dataset;
      if (value === null) delete flags[name];
      else flags[name] = value;
    },
    setRootStyle: (name, value) => {
      if (value === null) doc.documentElement.style.removeProperty(name);
      else doc.documentElement.style.setProperty(name, value);
    },
    readRootStyle: (name) => page.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(),
    find: <E extends Element>(selector: string) => doc.querySelector(selector) as E | null,
    findAll: <E extends Element>(selector: string) => Array.from(doc.querySelectorAll(selector)) as E[],
    focused: () => {
      const el = doc.activeElement;
      // With nothing focused a browser reports the body (or the root element): neither is part of the plan.
      return el && el !== doc.body && el !== doc.documentElement ? el : null;
    },

    viewport: () => ({ width: doc.documentElement.clientWidth, height: page.innerHeight }),
    scrollBy: (top, smooth = false) => page.scrollBy({ top, behavior: smooth ? 'smooth' : 'auto' }),
    media: (query) => {
      const list = page.matchMedia?.(query);
      return {
        matches: () => list?.matches ?? false,
        onChange: (listener) => {
          list?.addEventListener('change', listener);
          return () => list?.removeEventListener('change', listener);
        },
      };
    },
    on: (type, listener, options) => {
      const target: Listens = ON_DOCUMENT.has(type) ? doc : page;
      const heard = listener as PageListener;
      target.addEventListener(type, heard, options);
      return () => target.removeEventListener(type, heard);
    },

    print: () => page.print(),
    copyText: (text) => page.navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('This page cannot use the clipboard.')),
    saveFile: (blob, name) => {
      // A temporary link, clicked: the object URL is let go once the browser has started the download.
      const url = URL.createObjectURL(blob);
      const link = doc.createElement('a') as HTMLAnchorElement;
      link.href = url;
      link.download = name;
      link.rel = 'noopener';
      doc.body?.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), SAVE_URL_MS);
    },
    createElement: <K extends keyof HTMLElementTagNameMap>(tag: K) => doc.createElement(tag) as HTMLElementTagNameMap[K],
    attach: (element) => {
      doc.body?.appendChild(element);
    },
    onFontsLoaded: (listener) => {
      const fonts = doc.fonts;
      if (!fonts) return;
      fonts.ready.then(listener).catch(() => undefined);
      fonts.addEventListener?.('loadingdone', listener);
    },
    requestFrame: (callback) => page.requestAnimationFrame?.(callback) ?? null,
    cancelFrame: (handle) => {
      if (handle !== null) page.cancelAnimationFrame?.(handle);
    },
    expose: (name, value) => {
      (page as unknown as Record<string, unknown>)[name] = value;
    },
  };
}

/** Where there is no page at all (a server render, a unit test): nothing to read, nowhere to write. */
export const NO_HOST: Host = {
  readUrl: () => '',
  writeUrl: () => {},
  shareUrl: () => '',
  setTitle: () => {},
  onPopState: () => () => {},
  setRootData: () => {},
  setRootStyle: () => {},
  readRootStyle: () => '',
  find: () => null,
  findAll: () => [],
  focused: () => null,
  viewport: () => ({ width: 0, height: 0 }),
  scrollBy: () => {},
  media: () => ({ matches: () => false, onChange: () => () => {} }),
  on: () => () => {},
  print: () => {},
  copyText: () => Promise.resolve(),
  saveFile: () => {},
  createElement: () => null,
  attach: () => {},
  onFontsLoaded: () => {},
  requestFrame: () => null,
  cancelFrame: () => {},
  expose: () => {},
};

let host: Host | null = null;

/** The host in use: the one supplied, else the browser tab, else none. */
function current(): Host {
  if (host) return host;
  return typeof window === 'undefined' ? NO_HOST : (host = createBrowserHost(window));
}

/**
 * Supply the host (before the plan is rendered). Returns the host that was in use, so a test or an
 * embedding page can put it back; `null` goes back to the default.
 */
export function setHost(next: Host | null): Host | null {
  const before = host;
  host = next;
  return before;
}

/** True where there is a page to draw in: false in a server render and in the unit tests. */
export const hasPage = (): boolean => current() !== NO_HOST;

export const readUrl = (): string => current().readUrl();
export const writeUrl = (search: string): void => current().writeUrl(search);
export const shareUrl = (): string => current().shareUrl();
export const setTitle = (title: string): void => current().setTitle(title);
export const onPopState = (listener: () => void): (() => void) => current().onPopState(listener);

export const setRootData = (name: string, value: string | null): void => current().setRootData(name, value);
export const setRootStyle = (name: string, value: string | null): void => current().setRootStyle(name, value);
export const readRootStyle = (name: string): string => current().readRootStyle(name);
export const find = <E extends Element = HTMLElement>(selector: string): E | null => current().find<E>(selector);
export const findAll = <E extends Element = HTMLElement>(selector: string): E[] => current().findAll<E>(selector);
export const focused = (): Element | null => current().focused();

export const viewport = (): { width: number; height: number } => current().viewport();
export const scrollBy = (top: number, smooth?: boolean): void => current().scrollBy(top, smooth);
export const media = (query: string): HostMedia => current().media(query);
export const on = <K extends keyof HostEvents>(type: K, listener: (event: HostEvents[K]) => void, options?: { passive?: boolean }): (() => void) =>
  current().on(type, listener, options);

export const print = (): void => current().print();
export const copyText = (text: string): Promise<void> => current().copyText(text);
export const saveFile = (blob: Blob, name: string): void => current().saveFile(blob, name);
export const createElement = <K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] | null => current().createElement(tag);
export const attach = (element: HTMLElement): void => current().attach(element);
export const onFontsLoaded = (listener: () => void): void => current().onFontsLoaded(listener);
export const requestFrame = (callback: (time: number) => void): number | null => current().requestFrame(callback);
export const cancelFrame = (handle: number | null): void => current().cancelFrame(handle);
export const expose = (name: string, value: unknown): void => current().expose(name, value);
