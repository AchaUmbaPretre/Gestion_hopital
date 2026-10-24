/**
 * FormInput — champ texte branché sur react-hook-form (Controller).
 * Validation zod côté formulaire ; l'erreur s'affiche après 300ms
 * de pause de frappe (useDebouncedFieldError).
 */
import type { ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Input, type InputSize } from '../../../atoms';
import { useDebouncedFieldError } from '../useDebouncedFieldError';

export interface FormInputProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'search' | 'url';
  inputSize?: InputSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  disabled?: boolean;
  autoComplete?: string;
}

export function FormInput<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  hideLabel = false,
  required = false,
  hint,
  placeholder,
  type = 'text',
  inputSize = 'md',
  fullWidth = true,
  leftIcon,
  disabled = false,
  autoComplete,
}: FormInputProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const debouncedError = useDebouncedFieldError(fieldState.error?.message);
        return (
          <Input
            id={`${name}-field`}
            label={label}
            hideLabel={hideLabel}
            required={required}
            helperText={hint}
            error={debouncedError}
            placeholder={placeholder}
            type={type}
            inputSize={inputSize}
            fullWidth={fullWidth}
            leftIcon={leftIcon}
            disabled={disabled}
            autoComplete={autoComplete}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
          />
        );
      }}
    />
  );
}

FormInput.displayName = 'FormInput';
export default FormInput;
