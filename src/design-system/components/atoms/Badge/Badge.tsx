/**
 * Badge — état ou statut compact (non interactif).
 * Exemples cliniques : "Stable", "Critique", "En attente labo".
 * Le point coloré (dot) est décoratif ; le sens est porté par le texte.
 */
import type { HTMLAttributes } from 'react';
import styles from './badge.module.scss';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Affiche un point de statut (pulse respectant reduced-motion). */
  dot?: boolean;
}

const Badge = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) => {
  const classes = [
    styles.badge,
    styles[variant],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';
export default Badge;
export { Badge };
