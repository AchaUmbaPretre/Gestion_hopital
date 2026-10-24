/**
 * Pagination — molecule de navigation par pages.
 * Fenêtre glissante avec ellipses (…), aria-current="page",
 * libellés explicites (Page précédente/suivante).
 */
import { ChevronLeftIcon, ChevronRightIcon } from '../../../foundation/icons';
import styles from './pagination.module.scss';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Pages affichées de part et d'autre de la page courante. */
  siblingCount?: number;
  className?: string;
}

/** Construit la plage [1 … (p-1) p (p+1) … N] avec ellipses. */
export function buildPageRange(page: number, pageCount: number, siblingCount: number): (number | '…')[] {
  const totalSlots = siblingCount * 2 + 5; // 1re, dernière, courante, 2 ellipses
  if (pageCount <= totalSlots) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, pageCount);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < pageCount - 1;

  const range: (number | '…')[] = [1];
  if (showLeftEllipsis) range.push('…');
  for (let p = left; p <= right; p += 1) {
    if (p !== 1 && p !== pageCount) range.push(p);
  }
  if (showRightEllipsis) range.push('…');
  range.push(pageCount);
  return range;
}

export const Pagination = ({
  page,
  pageCount,
  onChange,
  siblingCount = 1,
  className,
}: PaginationProps) => {
  if (pageCount <= 1) return null;
  const range = buildPageRange(page, pageCount, siblingCount);

  const classes = [styles.pagination, className].filter(Boolean).join(' ');

  return (
    <nav className={classes} aria-label="Pagination">
      <button
        type="button"
        className={styles.arrow}
        aria-label="Page précédente"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeftIcon size={16} />
      </button>
      {range.map((item, index) =>
        item === '…' ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={`${styles.page} ${item === page ? styles.active : ''}`}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.arrow}
        aria-label="Page suivante"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRightIcon size={16} />
      </button>
      <span className={styles.caption} aria-hidden="true">
        Page {page} sur {pageCount}
      </span>
    </nav>
  );
};

Pagination.displayName = 'Pagination';
export default Pagination;
