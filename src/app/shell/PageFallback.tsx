/**
 * PageFallback — squelette de page pendant le chargement lazy
 * (React.lazy + Suspense). Garde la structure visuelle : titre +
 * rangée de KPI + bloc tableau → zéro layout shift.
 */
import { Skeleton } from '../../design-system/components/atoms';
import styles from './pageFallback.module.scss';

export const PageFallback = () => (
  <div className={styles.fallback} aria-hidden="true">
    <Skeleton variant="text" width={240} height={24} />
    <div className={styles.kpiRow}>
      <Skeleton variant="rectangular" height={96} className={styles.kpi} />
      <Skeleton variant="rectangular" height={96} className={styles.kpi} />
      <Skeleton variant="rectangular" height={96} className={styles.kpi} />
      <Skeleton variant="rectangular" height={96} className={styles.kpi} />
    </div>
    <Skeleton variant="rectangular" height={280} />
  </div>
);

PageFallback.displayName = 'PageFallback';
export default PageFallback;
