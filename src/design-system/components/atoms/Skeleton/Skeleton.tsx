/**
 * Skeleton — placeholder de chargement (jamais de spinner plein écran
 * sur les listes). aria-hidden : prévoir un texte d'attente au niveau
 * de la page (live region) si le contexte l'exige.
 */
import type { CSSProperties } from 'react';
import styles from './skeleton.module.scss';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /** Désactive l'animation shimmer (false = statique). */
  animated?: boolean;
  className?: string;
}

const Skeleton = ({
  variant = 'text',
  width,
  height,
  animated = true,
  className,
}: SkeletonProps) => {
  const inlineStyle: CSSProperties = {};
  if (width !== undefined) inlineStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) inlineStyle.height = typeof height === 'number' ? `${height}px` : height;

  const classes = [
    styles.skeleton,
    styles[variant],
    animated ? styles.animated : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes} style={inlineStyle} aria-hidden="true" />;
};

Skeleton.displayName = 'Skeleton';
export default Skeleton;
export { Skeleton };
