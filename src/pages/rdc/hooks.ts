/**
 * Hooks de résilience RDC (brief Partie 4) :
 *  - useOnlineStatus  : indicateur permanent 🟢 / 🟠 / 🔴
 *  - useDraftAutosave : auto-save localStorage toutes les 30 s
 *    (résiste aux coupures d'électricité — brief 4.1 / 3.4)
 *  - useHorloge       : date/heure courante (bureau d'accueil)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type StatutConnexion = 'en_ligne' | 'degrade' | 'hors_ligne';

/** Information réseau standard (navigator.connection) — typée sans `any`. */
interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

function lireStatut(): StatutConnexion {
  if (typeof navigator === 'undefined' || !navigator.onLine) return 'hors_ligne';
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  const t = nav.connection?.effectiveType;
  // Réseau 2G/slow-2g = mode dégradé (payload minimal, sync différée).
  return t === '2g' || t === 'slow-2g' ? 'degrade' : 'en_ligne';
}

/** Indicateur de connexion : réagit aux events online/offline + 2G. */
export function useOnlineStatus(): StatutConnexion {
  const [statut, setStatut] = useState<StatutConnexion>(lireStatut);

  useEffect(() => {
    const maj = () => setStatut(lireStatut);
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    const nav = navigator as Navigator & { connection?: NetworkInformation };
    nav.connection?.addEventListener('change', maj);
    // Sondage léger : la connexion peut changer sans événement (réseau instable).
    const iv = window.setInterval(maj, 15000);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
      nav.connection?.removeEventListener('change', maj);
      window.clearInterval(iv);
    };
  }, []);

  return statut;
}

export interface Draft<T> {
  savedAt: number;
  data: T;
}

export function loadDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft<T>) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorer
  }
}

/**
 * Auto-save toutes les 30 s + à la fermeture de l'onglet
 * (brief RDC 3.4 : "Auto-save toutes les 30 secondes (localStorage)
 * pour résister aux coupures d'électricité").
 *
 * @param key      clé localStorage (inclure l'ID patient)
 * @param getData  getter du brouillon (ref mise à jour à chaque rendu)
 */
export function useDraftAutosave<T>(
  key: string,
  getData: () => T,
  intervalMs = 30_000,
): { lastSaved: number | null; saveNow: () => void } {
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const getterRef = useRef(getData);
  getterRef.current = getData;

  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: getterRef.current() }));
      setLastSaved(Date.now());
    } catch {
      // quota / mode privé : le brouillon reste en mémoire React
    }
  }, [key]);

  useEffect(() => {
    const iv = window.setInterval(saveNow, intervalMs);
    window.addEventListener('beforeunload', saveNow);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('beforeunload', saveNow);
      saveNow(); // sauvegarde au démontage (navigation entre écrans)
    };
  }, [key, intervalMs, saveNow]);

  return { lastSaved, saveNow };
}

/** Horloge courante (maj toutes les 30 s — bureau d'accueil). */
export function useHorloge(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(iv);
  }, []);
  return now;
}
