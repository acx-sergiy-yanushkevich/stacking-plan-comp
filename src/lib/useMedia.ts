import { useEffect, useState } from 'react';

/** True when the media query matches; updates live. SSR-safe default false. */
export function useMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export const useIsNarrow = () => useMedia('(max-width: 1099px)');
export const useIsPhone = () => useMedia('(max-width: 760px)');
export const usePrefersReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
export const usePrefersDark = () => useMedia('(prefers-color-scheme: dark)');
