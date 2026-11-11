/**
 * The page the plan lives in, as the few things the plan asks of it: where its state is kept (the
 * address), the title of the tab, flags on the element the styles hang from, and being told when the
 * user goes back or forward.
 *
 * In a browser tab those are `location`, `history` and `document` (`createBrowserHost`). Nothing else
 * in the app reaches for them: it calls the functions at the bottom of this file. A page that owns its
 * own address and title, such as a Salesforce record page hosting the plan as a Lightning web
 * component, supplies the same six functions with `setHost` (state in the page reference, the title
 * left to the record page, flags on the component's own host element) and no other file changes.
 */
export interface Host {
  /** The query string the plan's state is read from: `''` or `?view=stack&…`. */
  readUrl(): string;
  /** Put the plan's state in the address (`''` or `?view=stack&…`) without adding a step to Back. */
  writeUrl(search: string): void;
  /** The whole address of this view, for "Copy link". */
  shareUrl(): string;
  /** Name the tab. */
  setTitle(title: string): void;
  /** Set a `data-<name>` flag on the element the styles hang from; `null` removes it. */
  setRootData(name: string, value: string | null): void;
  /** Call `listener` when the user goes back or forward to another address. Returns the way to stop. */
  onPopState(listener: () => void): () => void;
}

/** The parts of `window` and `document` a browser host uses: small enough to fake in a test. */
export interface BrowserPage {
  location: { pathname: string; search: string; hash: string; href: string };
  history: { state: unknown; replaceState(data: unknown, unused: string, url: string): void };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
  document: { title: string; documentElement: { dataset: Record<string, string | undefined> } };
}

/** The host of a plan that is the page: a browser tab. */
export function createBrowserHost(page: BrowserPage): Host {
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
      page.document.title = title;
    },
    setRootData: (name, value) => {
      const flags = page.document.documentElement.dataset;
      if (value === null) delete flags[name];
      else flags[name] = value;
    },
    onPopState: (listener) => {
      page.addEventListener('popstate', listener);
      return () => page.removeEventListener('popstate', listener);
    },
  };
}

/** Where there is no page at all (a server render, a unit test): nothing to read, nowhere to write. */
export const NO_HOST: Host = {
  readUrl: () => '',
  writeUrl: () => {},
  shareUrl: () => '',
  setTitle: () => {},
  setRootData: () => {},
  onPopState: () => () => {},
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

export const readUrl = (): string => current().readUrl();
export const writeUrl = (search: string): void => current().writeUrl(search);
export const shareUrl = (): string => current().shareUrl();
export const setTitle = (title: string): void => current().setTitle(title);
export const setRootData = (name: string, value: string | null): void => current().setRootData(name, value);
export const onPopState = (listener: () => void): (() => void) => current().onPopState(listener);
