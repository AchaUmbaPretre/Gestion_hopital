/**
 * Moteur de synchronisation (phase 1 — brief RDC Partie 4.1).
 *
 * Déclencheurs du rejeu de l'outbox :
 *  1. retour du réseau (événement `online`) ;
 *  2. message `RDC_SYNC` du Service Worker (Background Sync API —
 *     couvre le cas « l'onglet était fermé au retour du réseau ») ;
 *  3. démarrage de l'application (après 2,5 s — ne pas concurrencer
 *     le chargement initial des écrans) ;
 *  4. périodicité 60 s (les événements network sont peu fiables sur
 *     les réseaux instables des HGR : sondage léger en secours).
 *
 * L'envoi passe par axios (client global durci : timeout 8 s,
 * retry ×3 — voir services/resilience.ts) avec le token lu au
 * moment du rejeu (jamais figé à la mise en file).
 */

import { synchroniser, type ResultatSync } from './outbox';
import { envoiMetier } from './envoiMetier';

const TAG_SYNC_SW = 'RDC_SYNC';

/** Lance une synchronisation — les erreurs réseau sont déjà gérées. */
export function lancerSynchronisation(): Promise<ResultatSync> {
  return synchroniser(envoiMetier).catch(() => ({ envoyes: 0, echecs: 0, attendus: 0 }));
}

let installe = false;

/**
 * Installe les déclencheurs (une seule fois par page).
 * Idempotent et silencieux : aucun crash si les API n'existent pas
 * encore (les entrées restent en file, visible dans le badge).
 */
export function installerSyncEngine(): void {
  if (installe || typeof window === 'undefined') return;
  installe = true;

  // 1. Retour du réseau.
  window.addEventListener('online', () => {
    void lancerSynchronisation();
  });

  // 2. Ping du Service Worker (Background Sync, tag rdc-outbox-sync).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data === TAG_SYNC_SW) void lancerSynchronisation();
    });
  }

  // 3. Au démarrage — après le chargement des écrans.
  window.setTimeout(() => {
    void lancerSynchronisation();
  }, 2500);

  // 4. Sondage léger (réseaux où online/offline ne se déclenche pas).
  window.setInterval(() => {
    if (navigator.onLine) void lancerSynchronisation();
  }, 60_000);
}
