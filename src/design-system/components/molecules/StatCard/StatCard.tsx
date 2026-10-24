/**
 * StatCard — molecule KPI (dashboard étape 5.2).
 * Valeur en chiffres tabulaires (alignement vertical des colonnes
 * de KPI), tendance directionnelle, état loading (skeleton).
 * Ton optionnel pour les KPI critiques (lits disponibles, alertes).
 */
import type { ReactNode } from 'react';
import { Skeleton } from '../../atoms';
import {
  TrendingDownIcon,
  TrendingFlatIcon,
  TrendingUpIcon,
  type IconProps,
} from '../../../foundation/icons';
import styles from './statCard.module.scss';

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger';
export type StatCardTrend = 'up' | 'down' | 'flat';

export interface StatCardProps {
  label: string;
  /** Valeur affichée : nombre formaté côté appelant (Intl.NumberFormat). */
  value: string | number;
  icon?: (props: IconProps) => ReactNode;
  trend?: { direction: StatCardTrend; label: string };
  tone?: StatCardTone;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const trendIcon: Record<StatCardTrend, (props: IconProps) => ReactNode> = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
  flat: TrendingFlatIcon,
};

export const StatCard = ({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'default',
  loading = false,
  onClick,
  className,
}: StatCardProps) => {
  const classes = [
    styles.card,
    styles[tone],
    onClick ? styles.clickable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const TrendIcon = trend ? trendIcon[trend.direction] : null;
  const trendClass = trend
    ? trend.direction === 'up'
      ? styles.trendUp
      : trend.direction === 'down'
        ? styles.trendDown
        : styles.trendFlat
    : '';

  const content = (
    <>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <span className={styles.icon} aria-hidden="true">
            <Icon size={20} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton variant="rectangular" className={styles.valueSkeleton} />
      ) : (
        <span className={styles.value}>{value}</span>
      )}
      {trend && TrendIcon && !loading && (
        <span className={`${styles.trend} ${trendClass}`}>
          <TrendIcon size={14} />
          {trend.label}
        </span>
      )}
    </>
  );

  if (onClick && !loading) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
};

StatCard.displayName = 'StatCard';
export default StatCard;
