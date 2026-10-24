/**
 * Spinner — indicateur d'activité compact.
 *
 * A11y : role="status" + texte sr-only ("Chargement…") par défaut ;
 * passez decorative pour les usages purement visuels (bouton loading,
 * où l'état est déjà annoncé via aria-busy).
 */
import styles from './spinner.module.scss';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** true = purement visuel, aucune annonce screen reader. */
  decorative?: boolean;
  /** Libellé annoncé aux lecteurs d'écran (défaut : "Chargement…"). */
  label?: string;
  className?: string;
}

const Spinner = ({
  size = 'md',
  decorative = false,
  label = 'Chargement…',
  className,
}: SpinnerProps) => {
  const classes = [styles.spinner, styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative || undefined}
    >
      {!decorative && <span className={styles.srOnly}>{label}</span>}
      <svg className={styles.circle} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          className={styles.track}
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2.5"
        />
        <circle
          className={styles.progress}
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
};

Spinner.displayName = 'Spinner';
export default Spinner;
export { Spinner };
