/**
 * SyncBadge — badge « en attente de synchronisation » (brief RDC 4.1).
 *
 * Visible et simple (pas de progressif disclosure) : le personnel doit
 * TOUJOURS voir combien d'écritures attendent le réseau — un badge
 * caché serait un mensonge silencieux. États :
 *
 *  - orange : N en attente (clic = synchroniser maintenant)
 *  - bleu   : synchronisation en cours
 *  - rouge  : N échec(s) rejetés par le serveur (action manuelle)
 *  - rien   : file vide → aucun bruit visuel
 *
 * Cliquable (rejeu manuel) ; accessible (role=status, aria-live).
 */

import styles from './syncBadge.module.scss';
import { useSyncStatus } from './outbox';
import { lancerSynchronisation } from './syncEngine';
import { useOnlineStatus } from '../pages/rdc/hooks';

export function SyncBadge() {
  const { enAttente, echecs, enCours } = useSyncStatus();
  const statutReseau = useOnlineStatus();

  // Hors ligne : le nombre en attente est attendu — on l'affiche
  // seulement s'il y a des échecs ou une sync en cours.
  const horsLigne = statutReseau === 'hors_ligne';

  if (enCours) {
    return (
      <span className={`${styles.badge} ${styles.enCours}`} role="status" aria-live="polite">
        ⟳ Synchronisation…
      </span>
    );
  }

  if (echecs > 0) {
    return (
      <button
        type="button"
        className={`${styles.badge} ${styles.echec}`}
        onClick={() => void lancerSynchronisation()}
        title="Des écritures ont été rejetées par le serveur. Cliquer pour réessayer."
      >
        ⚠ {echecs} échec{echecs > 1 ? 's' : ''} de sync
      </button>
    );
  }

  if (enAttente > 0 && !horsLigne) {
    return (
      <button
        type="button"
        className={`${styles.badge} ${styles.attente}`}
        onClick={() => void lancerSynchronisation()}
        title="Écritures en attente du réseau. Cliquer pour synchroniser maintenant."
      >
        ⏳ {enAttente} en attente de synchronisation
      </button>
    );
  }

  if (enAttente > 0) {
    return (
      <span className={`${styles.badge} ${styles.attenteHorsLigne}`} role="status" aria-live="polite">
        ⏳ {enAttente} en attente — retour du réseau
      </span>
    );
  }

  return null;
}

SyncBadge.displayName = 'SyncBadge';
export default SyncBadge;
