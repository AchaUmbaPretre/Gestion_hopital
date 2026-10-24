/**
 * Select — liste déroulante NATIVE stylée.
 * Choix délibéré (ADR-007) : le <select> natif offre la meilleure
 * a11y du marché (clavier, mobile, screen readers) sans dépendance.
 * react-select existant sera remplacé progressivement par ce composant.
 */
import { useId, type SelectHTMLAttributes } from 'react';
import styles from './select.module.scss';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOptionItem {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'size'> {
  options: SelectOptionItem[];
  label?: string;
  hideLabel?: boolean;
  helperText?: string;
  error?: string;
  /** Option vide affichée tant qu'aucun choix n'est fait. */
  placeholder?: string;
  selectSize?: SelectSize;
  fullWidth?: boolean;
}

const Select = ({
  options,
  label,
  hideLabel = false,
  helperText,
  error,
  placeholder,
  selectSize = 'md',
  fullWidth = false,
  id: idProp,
  className,
  required,
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: SelectProps) => {
  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const describedBy = [
    ariaDescribedBy,
    helperText ? helperId : '',
    error ? errorId : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  const fieldClasses = [
    styles.field,
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const controlClasses = [
    styles.control,
    styles[selectSize],
    error ? styles.controlError : '',
  ]
    .filter(Boolean)
    .join(' ');

  const labelClasses = [styles.label, hideLabel ? styles.srOnly : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fieldClasses}>
      {label && (
        <label className={labelClasses} htmlFor={id}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}*
            </span>
          )}
        </label>
      )}
      <div className={controlClasses}>
        <select
          id={id}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          disabled={disabled}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {helperText && !error && (
        <p className={styles.helper} id={helperId}>
          {helperText}
        </p>
      )}
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

Select.displayName = 'Select';
export default Select;
export { Select };
