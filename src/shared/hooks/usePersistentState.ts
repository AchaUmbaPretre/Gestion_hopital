/**
 * usePersistentState — state React persisté en localStorage
 * (collapse sidebar 'gh.sidebar.collapsed', densité tables étape 4…).
 * Échoue silencieusement en navigation privée : l'UI reste fonctionnelle.
 */
import { useCallback, useState } from 'react';

export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      return initialValue;
    }
  };

  const [value, setValue] = useState<T>(read);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // localStorage indisponible : l'état reste en mémoire.
      }
    },
    [key],
  );

  return [value, set];
}
