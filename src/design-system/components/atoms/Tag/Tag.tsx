/**
 * Tag — étiquette interactive potentiellement supprimable
 * (filtres actifs, spécialités d'un docteur, allergies…).
 * Différence avec Badge : le Tag peut être retiré (onRemove).
 */
import type { HTMLAttributes } from 'react';
import styles from './tag.module.scss';

export type TagVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  /** Callback de suppression — active la croix si fourni. */
  onRemove?: () => void;
  disabled?: boolean;
}

const Tag = ({
  variant = 'neutral',
  onRemove,
  disabled = false,
  className,
  children,
  ...rest
}: TagProps) => {
  const classes = [styles.tag, styles[variant], className]
    .filter(Boolean)
    .join(' ');

  const textContent = typeof children === 'string' ? children : undefined;

  return (
    <span className={classes} {...rest}>
      <span className={styles.label}>{children}</span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={disabled}
          aria-label={textContent ? `Retirer ${textContent}` : 'Retirer'}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1L9 9M9 1L1 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

Tag.displayName = 'Tag';
export default Tag;
export { Tag };
