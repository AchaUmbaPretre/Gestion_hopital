/**
 * ThemeProvider — gestion du thème clair / sombre / auto.
 *
 * Stratégie (ADR-004) :
 *  - Préférence persistée dans localStorage (clé 'gh.theme').
 *  - <html data-theme="light|dark"> piloté ici + script anti-FOUC
 *    inline dans public/index.html (applique le thème AVANT le montage React).
 *  - 'auto' suit prefers-color-scheme en temps réel (listener matchMedia).
 *  - Les composants ne lisent que les tokens sémantiques → dark mode gratuit.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'gh.theme';

interface ThemeContextValue {
  /** Préférence utilisateur stockée ('auto' par défaut). */
  preference: ThemePreference;
  /** Thème effectivement rendu à l'écran. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Bascule rapide light ↔ dark (menu utilisateur). */
  toggle: () => void;
}

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

const readStoredPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'auto'
      ? value
      : 'auto';
  } catch {
    return 'auto';
  }
};

const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : preference;

const applyThemeToDocument = (resolved: ResolvedTheme): void => {
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredPreference(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredPreference()),
  );

  // Applique le thème résolu sur <html> à chaque changement.
  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  // Mode auto : suit les changements du système en temps réel.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preference === 'auto') {
        setResolvedTheme(resolveTheme('auto'));
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage indisponible (navigation privée) : thème en mémoire.
      }
      setResolvedTheme(resolveTheme(next));
    },
    [],
  );

  const toggle = useCallback(() => {
    setPreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setPreference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, toggle }),
    [preference, resolvedTheme, setPreference, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé dans <ThemeProvider>.');
  }
  return context;
}
