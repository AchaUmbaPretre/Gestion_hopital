// ============================================================
// FORM SYSTEM — champs react-hook-form + zod (étape 4)
// Usage type (étape 5) :
//   const { control, handleSubmit, watch, formState } = useForm({ resolver: zodResolver(schema) });
//   <FormInput name="nom" control={control} label="Nom" required />
//   <FormAutocomplete name="patient" control={control} label="Patient"
//     loadOptions={chercherPatients} />
// ============================================================

export { FormInput } from './FormInput/FormInput';
export type { FormInputProps } from './FormInput/FormInput';

export { FormSelect } from './FormSelect/FormSelect';
export type { FormSelectProps } from './FormSelect/FormSelect';

export { FormDatePicker } from './FormDatePicker/FormDatePicker';
export type { FormDatePickerProps } from './FormDatePicker/FormDatePicker';

export { FormAutocomplete } from './FormAutocomplete/FormAutocomplete';
export type {
  FormAutocompleteProps,
  AutocompleteOption,
} from './FormAutocomplete/FormAutocomplete';

export { FormFileUpload } from './FormFileUpload/FormFileUpload';
export type { FormFileUploadProps } from './FormFileUpload/FormFileUpload';

export { useDebouncedFieldError } from './useDebouncedFieldError';
