/**
 * Input — champ texte accessible.
 * Label liée (htmlFor), erreurs annoncées (aria-invalid +
 * aria-describedby + live region), helper text, icônes.
 * La validation métier est déléguée à react-hook-form + zod.
 */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './input.module.scss';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Masque visuellement la label (la conserve pour les lecteurs d'écran). */
  hideLabel?: boolean;
  helperText?: string;
  /** Message d'erreur humain : quoi + pourquoi + comment corriger. */
  error?: string;
  leftIcon?: ReactNode;
  inputSize?: InputSize;
  fullWidth?: boolean;
}

const Input = ({
  label,
  hideLabel = false,
  helperText,
  error,
  leftIcon,
  inputSize = 'md',
  fullWidth = false,
  id: idProp,
  className,
  disabled,
  required,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InputProps) => {
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
    styles[inputSize],
    error ? styles.controlError : '',
    leftIcon ? styles.hasLeftIcon : '',
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
        {leftIcon && (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          disabled={disabled}
          {...rest}
        />
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

Input.displayName = 'Input';
export default Input;
export { Input };
