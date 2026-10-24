/**
 * SearchBar — molecule de recherche (topbar ⌘K, listes).
 * Controlée : l'état appartient au parent ; le debounce serveur
 * se fait côté consommateur via useDebounce (250ms).
 * A11y : <form role="search">, bouton effacer avec libellé explicite.
 */
import { type ChangeEvent, type FormEvent } from 'react';
import { IconButton, Spinner } from '../../atoms';
import { SearchIcon, XIcon } from '../../../foundation/icons';
import styles from './searchBar.module.scss';

export type SearchBarSize = 'sm' | 'md';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Libellé accessible du champ (visuellement masqué). */
  label: string;
  size?: SearchBarSize;
  loading?: boolean;
  fullWidth?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const SearchBar = ({
  value,
  onChange,
  onClear,
  onSubmit,
  placeholder = 'Rechercher…',
  label,
  size = 'md',
  loading = false,
  fullWidth = false,
  autoFocus = false,
  className,
}: SearchBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(value);
  };

  const classes = [
    styles.searchBar,
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form role="search" className={classes} onSubmit={handleSubmit}>
      <span className={styles.icon} aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        type="search"
        className={styles.input}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
      {loading && (
        <span className={styles.spinner} aria-hidden="true">
          <Spinner size="xs" decorative />
        </span>
      )}
      {!loading && value.length > 0 && (
        <IconButton
          variant="ghost"
          size="sm"
          label="Effacer la recherche"
          className={styles.clear}
          onClick={() => {
            onClear?.();
            onChange('');
          }}
        >
          <XIcon size={14} />
        </IconButton>
      )}
    </form>
  );
};

SearchBar.displayName = 'SearchBar';
export default SearchBar;
