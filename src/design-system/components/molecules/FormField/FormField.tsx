/**
 * FormField — molecule d'habillage de contrôle de formulaire.
 * Associe label ↔ contrôle (htmlFor), marque le requis, affiche
 * hint / erreur (role="alert"). Pour les champs utilisant l'atome
 * Input (qui gère déjà label+erreur), ne PAS doubler l'habillage.
 */
import { useId, type ReactNode } from 'react';
import styles from './formField.module.scss';

export interface FormFieldProps {
  label: string;
  /** id du contrôle à associer (sinon dérivé automatiquement). */
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export const FormField = ({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className,
}: FormFieldProps) => {
  const autoId = useId();
  const hintId = `${htmlFor ?? autoId}-hint`;
  const errorId = `${htmlFor ?? autoId}-error`;

  const classes = [styles.field, error ? styles.hasError : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className={styles.hint} id={hintId}>
          {hint}
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

FormField.displayName = 'FormField';
export default FormField;
