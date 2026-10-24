/**
 * CommandPalette — ⌘K / Ctrl+K, recherche globale (brief 2.4).
 * Sections : Actions rapides (rôles) → Navigation → Résultats
 * (patients, docteurs, factures — debounce 250ms, requêtes mises
 * en cache par React Query et lancées SEULEMENT palette ouverte).
 * Clavier : ↑/↓/Entrée/Échap — le zéro-clic promis par le brief.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { filterNavByRole, NAV_ENTRIES, QUICK_ACTIONS, type UserRole } from './navigation';
import { useDebounce } from '../../shared/hooks';
import { getPatient } from '../../services/patientService';
import { getDocteur } from '../../services/docteurService';
import { getFacture } from '../../services/facturesService';
import { SearchBar } from '../../design-system/components/molecules/SearchBar/SearchBar';
import { EmptyState } from '../../design-system/components/molecules/EmptyState/EmptyState';
import { SearchIcon } from '../../design-system/foundation/icons';
import styles from './commandPalette.module.scss';

// ------------------------------------------------------------
// Contexte d'ouverture (consommé par TopBar et le raccourci clavier)
// ------------------------------------------------------------
const CommandPaletteContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function CommandPaletteProvider({ userRole, children }: { userRole: string | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Raccourci global ⌘K / Ctrl+K (hors champ input, le navigateur gère).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette role={userRole} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette doit être utilisé dans <CommandPaletteProvider>.');
  }
  return context;
}

// ------------------------------------------------------------
// Modèle d'élément navigable au clavier
// ------------------------------------------------------------
interface PaletteItem {
  key: string;
  label: string;
  hint?: string;
  group: 'Actions rapides' | 'Navigation' | 'Patients' | 'Médecins' | 'Factures';
  path: string;
  icon?: ReactNode;
}

export const CommandPalette = ({ role }: { role: string | undefined }) => {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const listId = useId();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Recherche : chargée seulement si palette ouverte + ≥ 2 caractères.
  const canSearch = open && debouncedQuery.trim().length >= 2;
  const { data: patients } = useQuery({
    queryKey: ['palette', 'patients'],
    queryFn: async () => (await getPatient()).data ?? [],
    enabled: canSearch,
    staleTime: 60_000,
  });
  const { data: docteurs } = useQuery({
    queryKey: ['palette', 'docteurs'],
    queryFn: async () => (await getDocteur()).data ?? [],
    enabled: canSearch,
    staleTime: 60_000,
  });
  const { data: factures } = useQuery({
    queryKey: ['palette', 'factures'],
    queryFn: async () => (await getFacture()).data ?? [],
    enabled: canSearch,
    staleTime: 60_000,
  });

  const close = useCallback(() => setOpen(false), [setOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!open) return [];
    const needle = debouncedQuery.trim().toLowerCase();
    const all: PaletteItem[] = [];

    if (!needle) {
      QUICK_ACTIONS.filter((action) => role && action.roles.includes(role as UserRole)).forEach(
        (action) => {
          const Icon = action.icon;
          all.push({
            key: action.key,
            label: action.label,
            group: 'Actions rapides',
            path: action.path,
            icon: <Icon size={16} />,
          });
        },
      );
    }

    filterNavByRole(NAV_ENTRIES, role).forEach((entry) => {
      if ('children' in entry) {
        entry.children.forEach((child) => {
          if (!child.disabled) {
            const Icon = child.icon;
            all.push({
              key: `nav-${child.key}`,
              label: child.label,
              hint: entry.label,
              group: 'Navigation',
              path: child.path,
              icon: <Icon size={16} />,
            });
          }
        });
      } else if (!entry.disabled) {
        const Icon = entry.icon;
        all.push({
          key: `nav-${entry.key}`,
          label: entry.label,
          group: 'Navigation',
          path: entry.path,
          icon: <Icon size={16} />,
        });
      }
    });

    if (needle.length >= 2) {
      const match = (value: unknown) =>
        typeof value === 'string' && value.toLowerCase().includes(needle);

      (patients as Record<string, unknown>[] | undefined)?.forEach((patient, index) => {
        const nom = (patient.nom_patient as string) ?? (patient.nom as string) ?? '';
        const prenom = (patient.prenom as string) ?? '';
        const label = `${prenom} ${nom}`.trim() || `Patient #${patient.id_patient ?? index}`;
        if (match(nom) || match(prenom)) {
          all.push({
            key: `patient-${patient.id_patient ?? index}`,
            label,
            hint: 'Dossier patient',
            group: 'Patients',
            path: '/liste_patient',
            icon: <SearchIcon size={16} />,
          });
        }
      });

      (docteurs as Record<string, unknown>[] | undefined)?.forEach((docteur, index) => {
        const nom = (docteur.nom as string) ?? (docteur.username as string) ?? '';
        const prenom = (docteur.prenom as string) ?? '';
        const label = `${prenom} ${nom}`.trim() || `Médecin #${docteur.id ?? index}`;
        if (match(nom) || match(prenom) || match(docteur.username)) {
          all.push({
            key: `docteur-${docteur.id ?? index}`,
            label,
            hint: 'Personnel médical',
            group: 'Médecins',
            path: '/liste_docteur',
            icon: <SearchIcon size={16} />,
          });
        }
      });

      (factures as Record<string, unknown>[] | undefined)?.forEach((facture, index) => {
        const nomPatient = (facture.nom_patient as string) ?? '';
        const label = nomPatient || `Facture #${facture.id_facture ?? index}`;
        if (match(nomPatient) || match(String(facture.id_facture ?? ''))) {
          all.push({
            key: `facture-${facture.id_facture ?? index}`,
            label,
            hint: 'Facturation',
            group: 'Factures',
            path: '/factures',
            icon: <SearchIcon size={16} />,
          });
        }
      });
    }

    return all;
  }, [open, debouncedQuery, role, patients, docteurs, factures]);

  // Réinitialise le curseur quand la liste change.
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, open]);

  // Garde l'élément actif visible.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const go = useCallback(
    (item: PaletteItem) => {
      close();
      setQuery('');
      navigate(item.path);
    },
    [close, navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) go(item);
    }
  };

  if (!open) return null;

  let lastGroup = '';
  const rendered: ReactNode[] = [];
  items.forEach((item, index) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      rendered.push(
        <li
          key={`group-${item.group}`}
          className={styles.groupLabel}
          role="presentation"
          aria-hidden="true"
        >
          {item.group}
        </li>,
      );
    }
    rendered.push(
      <li
        key={item.key}
        data-index={index}
        role="option"
        aria-selected={index === activeIndex}
        className={`${styles.option} ${index === activeIndex ? styles.optionActive : ''}`}
        onPointerEnter={() => setActiveIndex(index)}
        onClick={() => go(item)}
      >
        <span className={styles.optionIcon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={styles.optionLabel}>{item.label}</span>
        {item.hint && <span className={styles.optionHint}>{item.hint}</span>}
      </li>,
    );
  });

  return createPortal(
    <div className={styles.overlay} onClick={(event) => event.target === event.currentTarget && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
        className={styles.palette}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.searchRow}>
          <SearchBar
            label="Rechercher un patient, un médecin, une facture"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Patient, médecin, facture, action…"
            fullWidth
            autoFocus
          />
          <kbd className={styles.escHint} aria-hidden="true">
            Échap
          </kbd>
        </div>

        {items.length === 0 ? (
          <EmptyState
            size="sm"
            title={
              debouncedQuery.trim().length >= 2
                ? 'Aucun résultat'
                : 'Que voulez-vous faire ?'
            }
            description={
              debouncedQuery.trim().length >= 2
                ? 'Essayez un nom de patient, de médecin ou un numéro de facture.'
                : 'Tapez « patient », « facture »… ou choisissez une action rapide.'
            }
          />
        ) : (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Résultats"
            className={styles.list}
          >
            {rendered}
          </ul>
        )}

        <p className={styles.footer} aria-hidden="true">
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>Échap fermer</span>
        </p>
      </div>
    </div>,
    document.body,
  );
};

CommandPalette.displayName = 'CommandPalette';
export default CommandPalette;
