/**
 * Button — action principale du design system.
 *
 * États : default / hover / focus-visible / active / disabled / loading.
 * Règle microcopy (Phase 5) : les libellés sont des verbes d'action
 * ("Enregistrer la consultation"), jamais "OK" / "Valider".
 *
 * A11y : aria-busy en loading ; le Spinner est decorative car l'état
 * est annoncé par aria-busy + le libellé du bouton.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './button.module.scss';

export type ButtonVariant =
  | 'primary'     // action principale — 1 seule par vue
  | 'secondary'   // action secondaire (bordure)
  | 'ghost'       // action tertiaire discrète
  | 'danger'      // action destructive
  | 'subtle';     // action sur fond coloré (bg-primary-subtle)

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Affiche le spinner et désactive le bouton pendant la requête. */
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      iconLeft,
      iconRight,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <Spinner size="xs" decorative />
        ) : (
          iconLeft && <span className={styles.icon}>{iconLeft}</span>
        )}
        {children}
        {!loading && iconRight && (
          <span className={styles.icon}>{iconRight}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
export { Button };
