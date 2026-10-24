/**
 * Tests résilience axios (phase 1 RDC) :
 *  - timeout 8 s posé sur l'instance ;
 *  - rejeu ×3 backoff sur erreurs transitoires (GET uniquement) ;
 *  - AUCUN rejeu sur 4xx métier ni sur POST (un encaissement ne doit
 *    jamais être re-joué aveuglément — l'outbox gère les mutations).
 */

import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { attachResilience, erreurTransitoire, installerResilienceGlobale } from './resilience';

/** Construit une AxiosError réaliste (comme axios la produit). */
function erreurAxios(
  config: Parameters<AxiosAdapter>[0],
  opts: { reponse?: number; code?: string },
): AxiosError {
  const response: AxiosResponse | undefined = opts.reponse !== undefined
    ? {
        data: {},
        status: opts.reponse,
        statusText: 'Erreur simulée',
        headers: {},
        config,
      }
    : undefined;
  return new AxiosError(
    'Erreur réseau simulée',
    opts.code ?? (response ? undefined : 'ERR_NETWORK'),
    config,
    undefined,
    response,
  );
}

interface Atelier {
  instance: ReturnType<typeof axios.create>;
  appels: () => number;
}

/** Instance de test : l'adaptateur échoue N fois puis réussit. */
function atelierAxios(echecsAvantSucces: number, opts: { reponse?: number; code?: string }): Atelier {
  let appels = 0;
  const adapter: AxiosAdapter = (config) => {
    appels += 1;
    if (appels <= echecsAvantSucces) {
      return Promise.reject(erreurAxios(config, opts));
    }
    return Promise.resolve({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };
  const instance = axios.create({ adapter, timeout: 0 });
  return { instance, appels: () => appels };
}

describe('resilience axios', () => {
  test('rejoue un GET après erreurs 5xx transitoires (2 échecs puis succès)', async () => {
    const { instance, appels } = atelierAxios(2, { reponse: 503 });
    attachResilience(instance, { retries: 3, delaiBaseMs: 1 });
    const reponse = await instance.get('/api/test');
    expect(reponse.status).toBe(200);
    expect(appels()).toBe(3); // 1 tentative + 2 rejeux
  });

  test('rejoue un GET sur timeout (ECONNABORTED) jusqu à épuisement des rejeux', async () => {
    const { instance, appels } = atelierAxios(99, { code: 'ECONNABORTED' });
    attachResilience(instance, { retries: 3, delaiBaseMs: 1 });
    await expect(instance.get('/api/test')).rejects.toBeDefined();
    expect(appels()).toBe(4); // 1 tentative + 3 rejeux, puis propagation
  });

  test('ne rejoue PAS un GET rejeté en 4xx métier (404)', async () => {
    const { instance, appels } = atelierAxios(99, { reponse: 404 });
    attachResilience(instance, { retries: 3, delaiBaseMs: 1 });
    await expect(instance.get('/api/test')).rejects.toBeDefined();
    expect(appels()).toBe(1);
  });

  test('ne rejoue JAMAIS un POST (mutation : passera par l outbox)', async () => {
    const { instance, appels } = atelierAxios(99, { reponse: 503 });
    attachResilience(instance, { retries: 3, delaiBaseMs: 1 });
    await expect(instance.post('/api/paiement', { amount: 10 })).rejects.toBeDefined();
    expect(appels()).toBe(1);
  });

  test('pose le timeout 8 s par défaut sur l instance', () => {
    const { instance } = atelierAxios(0, {});
    attachResilience(instance, {});
    expect(instance.defaults.timeout).toBe(8000);
  });

  test('erreurTransitoire : réseau/timeout/5xx/429/408 oui — 401/404 non', () => {
    expect(erreurTransitoire({ config: { method: 'get' } } as unknown as AxiosError)).toBe(true);
    expect(erreurTransitoire({ config: { method: 'get' }, response: { status: 500 } } as unknown as AxiosError)).toBe(true);
    expect(erreurTransitoire({ config: { method: 'get' }, response: { status: 429 } } as unknown as AxiosError)).toBe(true);
    expect(erreurTransitoire({ config: { method: 'get' }, response: { status: 408 } } as unknown as AxiosError)).toBe(true);
    expect(erreurTransitoire({ config: { method: 'get' }, response: { status: 404 } } as unknown as AxiosError)).toBe(false);
    expect(erreurTransitoire({ config: { method: 'get' }, response: { status: 401 } } as unknown as AxiosError)).toBe(false);
    expect(erreurTransitoire({ config: { method: 'post' }, response: { status: 503 } } as unknown as AxiosError)).toBe(false);
  });

  test('installerResilienceGlobale est idempotent et durcit le client global', () => {
    installerResilienceGlobale();
    installerResilienceGlobale(); // pas de double interceptor qui doublerait les rejeux
    expect(axios.defaults.timeout).toBe(8000);
  });
});
