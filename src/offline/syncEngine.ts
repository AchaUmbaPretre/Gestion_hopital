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

import axios from 'axios';
import config from '../config';
import { synchroniser, type ResultatSync } from './outbox';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';
const TAG_SYNC_SW = 'RDC_SYNC';

/** Envoi réel : axios + en-tête d'idempotence (dédup côté serveur). */
export async function envoiAxios(
  methode: 'POST' | 'PUT',
  endpoint: string,
  payload: unknown,
  cleIdempotence: string,
): Promise<void> {
  await axios.request({
    method: methode,
    url: `${DOMAINE}${endpoint}`,
    data: payload,
    headers: { 'X-Idempotence-Key': cleIdempotence },
  });
}

/** Lance une synchronisation — les erreurs réseau sont déjà gérées. */
export function lancerSynchronisation(): Promise<ResultatSync> {
  return synchroniser(envoiAxios).catch(() => ({ envoyes: 0, echecs: 0 }));
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
