/**
 * Avatar — identité visuelle (patient, docteur, utilisateur).
 * Fallback automatique sur les initiales si l'image échoue ou est absente.
 * Couleur d'initiales déterministe (hash du nom) → cohérence visuelle.
 */
import { useState } from 'react';
import styles from './avatar.module.scss';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'busy' | 'away' | 'offline';

export interface AvatarProps {
  /** Nom complet — sert aux initiales et à l'alt par défaut. */
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  alt?: string;
  className?: string;
}

const STATUS_LABELS: Record<AvatarStatus, string> = {
  online: 'En ligne',
  busy: 'Occupé',
  away: 'Absent',
  offline: 'Hors ligne',
};

// 6 teintes accessibles (fonds subtle + texte contrasté, clair ET sombre
// via tokens) — choisies par hash du nom pour la stabilité visuelle.
const HUES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
};

const hashName = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const Avatar = ({
  name,
  src,
  size = 'md',
  status,
  alt,
  className,
}: AvatarProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  const showImage = Boolean(src) && !imageFailed;
  const hue = HUES[hashName(name) % HUES.length] ?? 'f';

  const classes = [styles.avatar, styles[size], className]
    .filter(Boolean)
    .join(' ');

  const statusClasses = [
    styles.status,
    status ? styles[`status-${status}`] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {showImage ? (
        <img
          className={classes}
          src={src}
          alt={alt ?? name}
          onError={() => setImageFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className={[classes, styles[hue]].join(' ')} role="img" aria-label={name}>
          {getInitials(name)}
        </span>
      )}
      {status && (
        <>
          <span className={statusClasses} aria-hidden="true" />
          <span className={styles.statusSrOnly}>{STATUS_LABELS[status]}</span>
        </>
      )}
    </span>
  );
};

Avatar.displayName = 'Avatar';
export default Avatar;
export { Avatar };
