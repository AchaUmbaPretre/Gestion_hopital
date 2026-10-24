/**
 * Breadcrumb — molecule de fil d'Ariane (fiches détail, étape 5).
 * Dernier élément : aria-current="page" (pas un lien).
 * Auto-repli : au-delà de 4 niveaux, le milieu est condensé en "…"
 * cliquable (déplie tout — jamais de perte d'accès).
 */
import { useState } from 'react';
import { ChevronRightIcon } from '../../../foundation/icons';
import styles from './breadcrumb.module.scss';

export interface BreadcrumbItem {
  label: string;
  /** Absent pour l'élément courant (page active). */
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const COLLAPSE_THRESHOLD = 4;

export const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = items.length > COLLAPSE_THRESHOLD && !isExpanded;
  const last = items[items.length - 1];
  const first = items[0];

  const classes = [styles.breadcrumb, className].filter(Boolean).join(' ');

  return (
    <nav className={classes} aria-label="Fil d'Ariane">
      <ol className={styles.list}>
        {shouldCollapse && first && (
          <li className={styles.item}>
            <a className={styles.link} href={first.href} onClick={first.onClick}>
              {first.label}
            </a>
            <span className={styles.separator} aria-hidden="true">
              <ChevronRightIcon size={14} />
            </span>
          </li>
        )}
        {shouldCollapse && (
          <li className={styles.item}>
            <button
              type="button"
              className={styles.expand}
              aria-expanded="false"
              aria-label="Afficher tous les niveaux"
              onClick={() => setIsExpanded(true)}
            >
              …
            </button>
            <span className={styles.separator} aria-hidden="true">
              <ChevronRightIcon size={14} />
            </span>
          </li>
        )}
        {!shouldCollapse &&
          items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isInteractive = !isLast && (item.href || item.onClick);
            return (
              <li key={`${item.label}-${index}`} className={styles.item}>
                {isInteractive ? (
                  <>
                    <a
                      className={styles.link}
                      href={item.href}
                      onClick={(event) => {
                        if (item.onClick) {
                          event.preventDefault();
                          item.onClick();
                        }
                      }}
                    >
                      {item.label}
                    </a>
                    <span className={styles.separator} aria-hidden="true">
                      <ChevronRightIcon size={14} />
                    </span>
                  </>
                ) : (
                  <span className={styles.current} aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        {shouldCollapse && last && (
          <li className={styles.item}>
            <span className={styles.current} aria-current="page">
              {last.label}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
};

Breadcrumb.displayName = 'Breadcrumb';
export default Breadcrumb;
