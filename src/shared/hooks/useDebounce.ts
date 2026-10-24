/**
 * useDebounce — diffère la propagation d'une valeur (recherche ⌘K,
 * filtres serveur). Respecte la spec brief : debounce 250ms.
 */
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
