/**
 * FilterBar — molecule de filtres actifs (listes, étape 4 DataTable).
 * Chaque filtre = Tag supprimable ; "Effacer" apparaît si ≥ 1 filtre.
 * Les filtres avancés (selects, dates) passent en `children` à gauche.
 */
import type { ReactNode } from 'react';
import { Tag } from '../../atoms';
import styles from './filterBar.module.scss';

export interface ActiveFilter {
  /** Clé stable du filtre (ex. 'sexe'). */
  key: string;
  /** Libellé complet affiché (ex. 'Sexe : F'). */
  label: string;
}

export interface FilterBarProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  clearAllLabel?: string;
  children?: ReactNode;
  className?: string;
}

export const FilterBar = ({
  filters,
  onRemove,
  onClearAll,
  clearAllLabel = 'Effacer les filtres',
  children,
  className,
}: FilterBarProps) => {
  const hasFilters = filters.length > 0;
  if (!hasFilters && !children) return null;

  const classes = [styles.bar, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
      {hasFilters && (
        <>
          <span className={styles.count} aria-hidden="true">
            {filters.length}
          </span>
          <ul className={styles.chips} aria-label="Filtres actifs">
            {filters.map((filter) => (
              <li key={filter.key}>
                <Tag
                  variant="neutral"
                  onRemove={() => onRemove(filter.key)}
                >
                  {filter.label}
                </Tag>
              </li>
            ))}
          </ul>
          {onClearAll && (
            <button type="button" className={styles.clearAll} onClick={onClearAll}>
              {clearAllLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
};

FilterBar.displayName = 'FilterBar';
export default FilterBar;
