/**
 * NotificationCenter — panneau de notifications du TopBar.
 * Réplique la logique de l'ancien TopBar.jsx :
 *  - DOCTEUR → RDV à confirmer (getRdvDocteurConfirmation(userId))
 *  - autres rôles → prescriptions labo en attente (getPrescriptionLaboNotif)
 * Premier consommateur de React Query : cache ['notifications', role, id].
 */
import { useQuery } from '@tanstack/react-query';
import { getRdvDocteurConfirmation, } from '../../services/rdvService';
import { getPrescriptionLaboNotif } from '../../services/laboService';
import { Badge, Spinner } from '../../design-system/components/atoms';
import { EmptyState } from '../../design-system/components/molecules/EmptyState/EmptyState';
import { ActivityIcon, CalendarIcon, ClockIcon } from '../../design-system/foundation/icons';
import styles from './notificationCenter.module.scss';

export interface NotificationItem {
  id: number | string;
  title: string;
  meta?: string;
}

export interface NotificationCenterProps {
  role: string | undefined;
  userId: number | string | undefined;
  className?: string;
}

/** Détermine les notifications pour un rôle donné (source unique, tests inclus). */
export function useNotifications(role: string | undefined, userId: number | string | undefined) {
  return useQuery({
    queryKey: ['notifications', role, userId],
    queryFn: async (): Promise<NotificationItem[]> => {
      if (role === 'DOCTEUR') {
        const response = await getRdvDocteurConfirmation(userId);
        return (response.data ?? []).map(
          (item: Record<string, unknown>, index: number): NotificationItem => ({
            id: (item.id_rdv as number | string) ?? (item.id as number | string) ?? index,
            title:
              (item.nom_patient as string) ??
              (item.patient as string) ??
              'Rendez-vous à confirmer',
            meta: (item.date_rdv as string) ?? (item.date as string) ?? undefined,
          }),
        );
      }
      const response = await getPrescriptionLaboNotif();
      return (response.data ?? []).map(
        (item: Record<string, unknown>, index: number): NotificationItem => ({
          id: (item.id_prescription as number | string) ?? (item.id as number | string) ?? index,
          title:
            (item.nom_patient as string) ??
            (item.patient as string) ??
            'Prescription labo en attente',
          meta: (item.date_prescription as string) ?? (item.date as string) ?? undefined,
        }),
      );
    },
    staleTime: 60_000,
  });
}

export const NotificationCenter = ({ role, userId, className }: NotificationCenterProps) => {
  const { data, isLoading, isError } = useNotifications(role, userId);

  const classes = [styles.panel, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="region" aria-label="Notifications">
      <p className={styles.header}>
        Notifications
        {data && data.length > 0 && (
          <Badge variant="info" size="sm">
            {data.length}
          </Badge>
        )}
      </p>

      {isLoading && (
        <div className={styles.loading}>
          <Spinner size="md" />
          <span>Chargement…</span>
        </div>
      )}

      {isError && (
        <EmptyState
          size="sm"
          icon={ActivityIcon}
          title="Impossible de charger les notifications"
          description="Vérifiez la connexion au serveur, puis réessayez."
        />
      )}

      {data && data.length === 0 && (
        <EmptyState
          size="sm"
          icon={ClockIcon}
          title="Rien pour le moment"
          description="Les nouveaux événements apparaîtront ici."
        />
      )}

      {data && data.length > 0 && (
        <ul className={styles.list}>
          {data.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true">
                {role === 'DOCTEUR' ? <CalendarIcon size={16} /> : <ActivityIcon size={16} />}
              </span>
              <div className={styles.itemContent}>
                <p className={styles.itemTitle}>{item.title}</p>
                {item.meta && <p className={styles.itemMeta}>{item.meta}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

NotificationCenter.displayName = 'NotificationCenter';
export default NotificationCenter;
