/**
 * useDraftAutosave — auto-save brouillon en localStorage (étape 4).
 * Écriture debouncée (500ms) : la frappe ne déclenche pas 10 writes/s.
 * API minimaliste, découplée de RHF :
 *   const { loadDraft, saveDraft, clearDraft } = useDraftAutosave<Values>('gh.draft.patient');
 *   useEffect(() => { if (isDirty) saveDraft(values); }, [values, isDirty]);
 * Restauration : loadDraft() au montage → reset(draft). Nettoyage :
 * clearDraft() après soumission réussie.
 */
import { useCallback, useRef } from 'react';

export interface DraftAutosaveOptions {
  /** Délai d'écriture (défaut 500ms). */
  debounceMs?: number;
}

export function useDraftAutosave<T>(key: string, options: DraftAutosaveOptions = {}) {
  const { debounceMs = 500 } = options;
  const timer = useRef<number | null>(null);

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [key]);

  const write = useCallback(
    (value: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage plein / navigation privée : brouillon en mémoire seule.
      }
    },
    [key],
  );

  const saveDraft = useCallback(
    (value: T) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => write(value), debounceMs);
    },
    [debounceMs, write],
  );

  const clearDraft = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // rien à faire : la clé disparaîtra au prochain write réussi.
    }
  }, [key]);

  return { loadDraft, saveDraft, clearDraft } as const;
}
