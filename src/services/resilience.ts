/**
 * Résilience réseau axios (phase 1 — brief RDC Partie 4.2) :
 *  - timeout 8 s (un poste HGR sur réseau instable ne doit pas
 *    attendre le timeout par défaut de ~2 min) ;
 *  - retry ×3 avec backoff exponentiel (1 s, 2 s, 4 s) ;
 *  - rejeu UNIQUEMENT des méthodes sûres (GET/HEAD/OPTIONS) : un POST
 *    re-joué aveuglément peut doubler un encaissement — les mutations
 *    passent par l'outbox (clé d'idempotence) pour le rejeu sûr ;
 *  - rejeu UNIQUEMENT sur erreurs transitoires : timeout (ECONNABORTED),
 *    réseau (pas de réponse), 5xx, 429, 408 — jamais sur un 4xx métier
 *    (401/404/422 : re-jouer ne changera pas la réponse).
 *
 * La compression (gzip/brotli) est gérée nativement par le navigateur
 * via Accept-Encoding : rien à activer côté client.
 */

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export interface OptionsResilience {
  /** Timeout par requête en ms (défaut 8 000 — brief RDC 4.2). */
  timeoutMs?: number;
  /** Nombre de rejeux après la tentative initiale (défaut 3). */
  retries?: number;
  /** Délai de base du backoff en ms (défaut 1 000 → 1 s, 2 s, 4 s). */
  delaiBaseMs?: number;
}

const METHODES_REJEUABLES = new Set(['GET', 'HEAD', 'OPTIONS']);

interface ConfigAvecEssais extends InternalAxiosRequestConfig {
  __essais?: number;
}

/** L'erreur est-elle transitoire (mérite un rejeu) ? */
export function erreurTransitoire(erreur: AxiosError): boolean {
  const methode = (erreur.config?.method ?? 'get').toUpperCase();
  if (!METHODES_REJEUABLES.has(methode)) return false;
  // Pas de réponse (réseau coupé) ou timeout local → transitoire.
  if (!erreur.response) return true;
  const s = erreur.response.status;
  return s >= 500 || s === 429 || s === 408;
}

const pause = (ms: number): Promise<void> =>
  new Promise((resoudre) => {
    setTimeout(resoudre, ms);
  });

/**
 * Durcit une instance axios : timeout + interceptor de rejeu.
 * Retourne la même instance (chaînable sur l'existant).
 */
export function attachResilience(
  instance: AxiosInstance,
  options: OptionsResilience = {},
): AxiosInstance {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retries = options.retries ?? 3;
  const delaiBaseMs = options.delaiBaseMs ?? 1_000;

  instance.defaults.timeout = timeoutMs;

  instance.interceptors.response.use(
    (reponse) => reponse,
    async (erreur: AxiosError) => {
      const config = erreur.config as ConfigAvecEssais | undefined;
      if (!config || !erreurTransitoire(erreur)) throw erreur;
      const essais = (config.__essais ?? 0) + 1;
      if (essais > retries) throw erreur;
      config.__essais = essais;
      await pause(delaiBaseMs * 2 ** (essais - 1));
      return instance.request(config);
    },
  );

  return instance;
}

let globaleInstallee = false;

/**
 * Durcit le client axios GLOBAL (utilisé par les services .jsx
 * existants qui appellent `axios.get` directement). Idempotent.
 */
export function installerResilienceGlobale(): void {
  if (globaleInstallee) return;
  globaleInstallee = true;
  attachResilience(axios, { timeoutMs: 8_000, retries: 3 });
}
