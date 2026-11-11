/**
 * One part of the plan telling another that something should happen, when the two are far apart in
 * the tree (the header's "Record video" and the map; the PNG export and the plan drawn off-screen for
 * it). The signal is a value both import, so nothing is sent through the page they are hosted in.
 */
export interface Signal<T> {
  /** Tell every listener. Returns how many heard it. */
  emit(value: T): number;
  /** Listen. Returns the way to stop. */
  on(listener: (value: T) => void): () => void;
}

export function createSignal<T = void>(): Signal<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    emit: (value) => {
      // A copy: a listener that stops listening while it is being told does not skip the next one.
      const heard = [...listeners];
      heard.forEach((listener) => listener(value));
      return heard.length;
    },
    on: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
