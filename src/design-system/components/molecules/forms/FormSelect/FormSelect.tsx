/**
 * FormSelect — champ liste branché sur react-hook-form.
 * Atome Select natif : accessible et mobile-first (zéro dépendance).
 */
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Select, type SelectOptionItem, type SelectSize } from '../../../atoms';
import { useDebouncedFieldError } from '../useDebouncedFieldError';

export interface FormSelectProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options: SelectOptionItem[];
  selectSize?: SelectSize;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  hideLabel = false,
  required = false,
  hint,
  placeholder,
  options,
  selectSize = 'md',
  fullWidth = true,
  disabled = false,
}: FormSelectProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const debouncedError = useDebouncedFieldError(fieldState.error?.message);
        return (
          <Select
            id={`${name}-field`}
            label={label}
            hideLabel={hideLabel}
            required={required}
            helperText={hint}
            error={debouncedError}
            placeholder={placeholder}
            options={options}
            selectSize={selectSize}
            fullWidth={fullWidth}
            disabled={disabled}
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

FormSelect.displayName = 'FormSelect';
export default FormSelect;
