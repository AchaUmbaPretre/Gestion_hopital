/**
 * IconButton — bouton icône seule. `label` est OBLIGATOIRE :
 * tout bouton icon-only porte un aria-label accessible (WCAG 4.1.2).
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './iconButton.module.scss';

export type IconButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'subtle';
export type IconButtonSize = 'sm' | 'md';
export type IconButtonShape = 'square' | 'circle';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Texte d'accessibilité obligatoire (ex. "Supprimer le patient Dupont"). */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  loading?: boolean;
  children: ReactNode;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      variant = 'ghost',
      size = 'md',
      shape = 'square',
      loading = false,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const classes = [
      styles.iconButton,
      styles[variant],
      styles[size],
      styles[shape],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        title={label}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <Spinner size="xs" decorative /> : children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
export default IconButton;
export { IconButton };
