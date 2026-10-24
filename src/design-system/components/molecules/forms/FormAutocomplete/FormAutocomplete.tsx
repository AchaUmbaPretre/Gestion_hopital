/**
 * FormAutocomplete — champ à recherche serveur branché RHF.
 * Spec brief : debounce 250ms (patients), options chargées via
 * `loadOptions`, navigation clavier complète (↑↓↵Échap), listbox
 * ARIA (role/option/aria-activedescendant), spinner de chargement.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Spinner } from '../../../atoms';
import { SearchIcon, XIcon } from '../../../../foundation/icons';
import { useDebounce, useDismiss } from '../../../../../shared/hooks';
import { useDebouncedFieldError } from '../useDebouncedFieldError';
import styles from '../forms.module.scss';

export interface AutocompleteOption {
  value: string;
  label: string;
  /** Métadonnée discrète à droite (ex. téléphone, service). */
  meta?: string;
}

export interface FormAutocompleteProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Charge les options pour une requête (API serveur). */
  loadOptions: (query: string) => Promise<AutocompleteOption[]>;
  /** Nombre de caractères avant déclenchement (défaut 2). */
  minChars?: number;
  /** Débounce de la requête (défaut 250ms — spec brief). */
  debounceMs?: number;
  disabled?: boolean;
}

export function FormAutocomplete<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  hideLabel = false,
  required = false,
  hint,
  placeholder = 'Rechercher…',
  loadOptions,
  minChars = 2,
  debounceMs = 250,
  disabled = false,
}: FormAutocompleteProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const autoId = useId();
        const listId = `${name}-list-${autoId}`;
        const errorId = `${name}-err-${autoId}`;
        const debouncedError = useDebouncedFieldError(fieldState.error?.message);

        const [open, setOpen] = useState(false);
        const [query, setQuery] = useState('');
        const [options, setOptions] = useState<AutocompleteOption[]>([]);
        const [loading, setLoading] = useState(false);
        const [activeIndex, setActiveIndex] = useState(0);
        const hostRef = useRef<HTMLDivElement>(null);

        const debouncedQuery = useDebounce(query, debounceMs);

        // Charge les options quand la requête stabilisée change.
        useEffect(() => {
          let cancelled = false;
          if (debouncedQuery.trim().length < minChars) {
            setOptions([]);
            setLoading(false);
            return;
          }
          setLoading(true);
          loadOptions(debouncedQuery.trim())
            .then((result) => {
              if (!cancelled) {
                setOptions(result);
                setActiveIndex(0);
              }
            })
            .catch(() => {
              if (!cancelled) setOptions([]);
            })
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
          return () => {
            cancelled = true;
          };
        }, [debouncedQuery, loadOptions, minChars]);

        useDismiss({
          enabled: open,
          ref: hostRef,
          onDismiss: () => setOpen(false),
        });

        const selectedLabel = field.value?.label as string | undefined;
        const showList = open && (loading || options.length > 0 || debouncedQuery.trim().length >= minChars);

        const pick = (option: AutocompleteOption) => {
          field.onChange(option);
          setQuery('');
          setOpen(false);
        };

        const handleKeyDown = (event: React.KeyboardEvent) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => (options.length === 0 ? 0 : (index + 1) % options.length));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) =>
              options.length === 0 ? 0 : (index - 1 + options.length) % options.length,
            );
          } else if (event.key === 'Enter' && open && options[activeIndex]) {
            event.preventDefault();
            pick(options[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        };

        const describedBy = [hint && !debouncedError ? `${autoId}-hint` : '', debouncedError ? errorId : '']
          .filter(Boolean)
          .join(' ') || undefined;

        return (
          <div className={styles.field}>
            <label htmlFor={`${autoId}-input`} className={hideLabel ? styles.srOnly : styles.label}>
              {label}
              {required && <span className={styles.required} aria-hidden="true"> *</span>}
            </label>
            <div ref={hostRef} className={styles.autocomplete}>
              <div style={{ position: 'relative' }}>
                <input
                  id={`${autoId}-input`}
                  type="text"
                  role="combobox"
                  aria-expanded={showList}
                  aria-controls={listId}
                  aria-activedescendant={showList && options[activeIndex] ? `${autoId}-opt-${activeIndex}` : undefined}
                  aria-autocomplete="list"
                  aria-invalid={debouncedError ? true : undefined}
                  aria-describedby={describedBy}
                  className={`${styles.autocompleteInput} ${debouncedError ? styles.controlError : ''}`}
                  placeholder={selectedLabel ?? placeholder}
                  value={query}
                  disabled={disabled}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={handleKeyDown}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'inline-flex',
                    color: 'var(--color-text-tertiary)',
                    pointerEvents: 'none',
                  }}
                  aria-hidden="true"
                >
                  {loading ? <Spinner size="xs" decorative /> : <SearchIcon size={16} />}
                </span>
              </div>

              {selectedLabel && field.value && !open && (
                <div className={styles.fileRow} style={{ marginTop: 6 }}>
                  <span className={styles.fileName}>{selectedLabel}</span>
                  <button
                    type="button"
                    className={styles.menuAction}
                    aria-label="Retirer la sélection"
                    onClick={() => field.onChange(null)}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              )}

              {showList && (
                <ul id={listId} role="listbox" aria-label={label} className={styles.listbox}>
                  {loading && (
                    <li className={styles.loadingRow} role="presentation">
                      <Spinner size="xs" decorative /> Recherche…
                    </li>
                  )}
                  {!loading && options.length === 0 && debouncedQuery.trim().length >= minChars && (
                    <li className={styles.noOptions} role="presentation">
                      Aucun résultat
                    </li>
                  )}
                  {options.map((option, index) => (
                    <li
                      key={option.value}
                      id={`${autoId}-opt-${index}`}
                      role="option"
                      aria-selected={field.value?.value === option.value}
                      className={`${styles.option} ${index === activeIndex ? styles.optionActive : ''}`}
                      onPointerEnter={() => setActiveIndex(index)}
                      onClick={() => pick(option)}
                    >
                      <span>{option.label}</span>
                      {option.meta && <span className={styles.optionMeta}>{option.meta}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {hint && !debouncedError && (
              <p className={styles.hint} id={`${autoId}-hint`}>
                {hint}
              </p>
            )}
            {debouncedError && (
              <p className={styles.error} id={errorId} role="alert">
                {debouncedError}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

FormAutocomplete.displayName = 'FormAutocomplete';
export default FormAutocomplete;
