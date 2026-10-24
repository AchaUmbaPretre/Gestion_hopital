/**
 * EmptyState — molecule "aucun résultat" (Calm Technology).
 * Explique POURQUOI la zone est vide et propose l'action suivante
 * (Progressive Disclosure : jamais de cul-de-sac).
 */
import type { ReactNode } from 'react';
import { InboxIcon, type IconProps } from '../../../foundation/icons';
import styles from './emptyState.module.scss';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Action principale (Button) rendue sous la description. */
  action?: ReactNode;
  /** Icône personnalisée ; par défaut Inbox (calme, neutre). */
  icon?: (props: IconProps) => ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  action,
  icon: Icon = InboxIcon,
  size = 'md',
  className,
}: EmptyStateProps) => {
  const classes = [styles.empty, styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status">
      <span className={styles.icon} aria-hidden="true">
        <Icon size={size === 'sm' ? 28 : 40} />
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
export default EmptyState;
