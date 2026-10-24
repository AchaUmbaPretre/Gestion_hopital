/**
 * FormDatePicker — champ date branché sur react-hook-form.
 * Input natif type="date" : picker natif de l'OS (mobile-first,
 * clavier, langue du système) — zéro dépendance, calme. Un calendrier
 * maison n'est justifiable qu'en cas de besoin métier précis
 * (créneaux RDV — étape 5.4).
 */
import { useId } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useDebouncedFieldError } from '../useDebouncedFieldError';
import styles from '../forms.module.scss';

export interface FormDatePickerProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  /** Date ISO minimale (ex. aujourd'hui pour un RDV). */
  min?: string;
  max?: string;
  disabled?: boolean;
}

export function FormDatePicker<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  hideLabel = false,
  required = false,
  hint,
  min,
  max,
  disabled = false,
}: FormDatePickerProps<TFieldValues>) {
  const autoId = useId();
  const id = `${name}-field-${autoId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const debouncedError = useDebouncedFieldError(fieldState.error?.message);
        const describedBy = [hint && !debouncedError ? hintId : '', debouncedError ? errorId : '']
          .filter(Boolean)
          .join(' ') || undefined;

        return (
          <div className={styles.field}>
            <label htmlFor={id} className={hideLabel ? styles.srOnly : styles.label}>
              {label}
              {required && <span className={styles.required} aria-hidden="true"> *</span>}
            </label>
            <input
              id={id}
              type="date"
              className={`${styles.control} ${debouncedError ? styles.controlError : ''}`}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              min={min}
              max={max}
              disabled={disabled}
              aria-required={required || undefined}
              aria-invalid={debouncedError ? true : undefined}
              aria-describedby={describedBy}
            />
            {hint && !debouncedError && (
              <p className={styles.hint} id={hintId}>
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

FormDatePicker.displayName = 'FormDatePicker';
export default FormDatePicker;
