/**
 * useMediaQuery — réactif aux breakpoints (sidebar drawer < 960px,
 * bottom-bar mobile étape 6). SSR-safe et jsdom-safe.
 */
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/** Breakpoint sidebar du shell (< 960px = tablette/mobile → drawer). */
export const SIDEBAR_MEDIA_QUERY = '(max-width: 960px)';
