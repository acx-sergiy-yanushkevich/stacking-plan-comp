import { useEffect, useState } from 'react';
import { media } from './host';

/** True when the media query matches; updates live. SSR-safe default false. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => media(query).matches());
  useEffect(() => {
    const mq = media(query);
    const on = () => setMatches(mq.matches());
    on();
    return mq.onChange(on);
  }, [query]);
  return matches;
}

export const useIsNarrow = () => useMedia('(max-width: 1099px)');
export const useIsPhone = () => useMedia('(max-width: 760px)');
export const usePrefersReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
export const usePrefersDark = () => useMedia('(prefers-color-scheme: dark)');
