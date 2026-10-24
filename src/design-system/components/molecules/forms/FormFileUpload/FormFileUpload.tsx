/**
 * FormFileUpload — champ fichier branché sur react-hook-form.
 * Dropzone accessible (clic + glisser-déposer), liste des fichiers
 * sélectionnés avec suppression, taille max optionnelle (Mo).
 * Valeur : File (multiple=false) ou File[] (multiple=true).
 */
import { useId, useRef, useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { IconButton } from '../../../atoms';
import { FileTextIcon, UploadIcon, XIcon } from '../../../../foundation/icons';
import { useDebouncedFieldError } from '../useDebouncedFieldError';
import styles from '../forms.module.scss';

export interface FormFileUploadProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  /** Types acceptés (attribut accept, ex. 'image/*,.pdf'). */
  accept?: string;
  multiple?: boolean;
  /** Taille max par fichier en Mo (message d'erreur inline). */
  maxSizeMB?: number;
  disabled?: boolean;
}

const formatSize = (bytes: number): string =>
  bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.ceil(bytes / 1024)} Ko`;

export function FormFileUpload<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  hideLabel = false,
  required = false,
  hint,
  accept,
  multiple = false,
  maxSizeMB,
  disabled = false,
}: FormFileUploadProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const autoId = useId();
        const inputId = `${name}-file-${autoId}`;
        const errorId = `${name}-file-err-${autoId}`;
        const inputRef = useRef<HTMLInputElement>(null);
        const [dragging, setDragging] = useState(false);
        const debouncedError = useDebouncedFieldError(fieldState.error?.message);

        const files: File[] = field.value
          ? (multiple ? (field.value as File[]) : [field.value as File])
          : [];

        const setFiles = (incoming: FileList | null) => {
          if (!incoming) return;
          const list = Array.from(incoming);
          const tooBig = maxSizeMB ? list.find((file) => file.size > maxSizeMB * 1024 * 1024) : undefined;
          if (tooBig) {
            field.onChange(multiple ? [] : null);
            inputRef.current?.setCustomValidity(`« ${tooBig.name} » dépasse ${maxSizeMB} Mo`);
            inputRef.current?.reportValidity();
            return;
          }
          inputRef.current?.setCustomValidity('');
          field.onChange(multiple ? list : list[0] ?? null);
        };

        return (
          <div className={styles.field}>
            <label htmlFor={inputId} className={hideLabel ? styles.srOnly : styles.label}>
              {label}
              {required && <span className={styles.required} aria-hidden="true"> *</span>}
            </label>

            <div
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
              aria-disabled={disabled}
              aria-describedby={hint ? `${autoId}-hint` : undefined}
              onClick={() => !disabled && inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  !disabled && inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (!disabled) setFiles(event.dataTransfer.files);
              }}
            >
              <UploadIcon size={22} />
              <span>
                Glissez-déposez ou <strong>parcourez</strong>
              </span>
              {(hint || maxSizeMB) && !debouncedError && (
                <span className={styles.hint}>
                  {maxSizeMB ? `Taille max : ${maxSizeMB} Mo. ` : ''}
                  {hint ?? ''}
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              className={styles.srOnly}
              onChange={(event) => setFiles(event.target.files)}
            />

            {files.length > 0 && (
              <ul className={styles.fileList}>
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className={styles.fileRow}>
                    <span className={styles.fileName}>
                      <FileTextIcon size={14} /> {file.name}
                    </span>
                    <span className={styles.fileSize}>{formatSize(file.size)}</span>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={`Retirer ${file.name}`}
                      onClick={() => {
                        const next = files.filter((_, position) => position !== index);
                        field.onChange(multiple ? next : null);
                      }}
                    >
                      <XIcon size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
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

FormFileUpload.displayName = 'FormFileUpload';
export default FormFileUpload;
