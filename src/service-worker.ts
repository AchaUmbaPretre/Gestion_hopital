/**
 * Service Worker — PWA offline-first (phase 1, brief RDC Partie 4).
 *
 * Compilé par CRA 5 via WorkboxWebpackPlugin.InjectManifest : le
 * manifeste de précache est injecté dans `self.__WB_MANIFEST`
 * (app shell complet : HTML, JS, CSS, polices — tout est en cache
 * au premier chargement, l'app démarre donc SANS réseau ensuite).
 *
 * Stratégies runtime :
 *  - Navigations (SPA)        → index.html préchargé (offline OK).
 *  - GET /api/*               → NetworkFirst (timeout 8 s) avec cache
 *    de secours : les données déjà vues restent consultables hors ligne
 *    (connexion ~32 % au HGR — le réseau est le PLUS lent des chemins).
 *  - Background Sync (tag
 *    'rdc-outbox-sync')       → postMessage 'RDC_SYNC' à l'app, qui
 *    rejoue sa file outbox (Dexie) via le moteur de synchronisation.
 *
 * Mise à jour : message SKIP_WAITING (géré par serviceWorkerRegistration).
 */

/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// `__WB_MANIFEST` est déjà typé par les types workbox (augmentation
// globale de ServiceWorkerGlobalScope) : InjectManifest y injecte le
// manifeste de précache au build.
declare const self: ServiceWorkerGlobalScope;

// ---------- Précache de l'app shell (manifeste injecté par CRA) ----------
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// ---------- Navigations SPA → index.html préchargé ----------
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html'),
);
registerRoute(navigationRoute);

// ---------- GET API → NetworkFirst + cache de secours ----------
// Réseau instable : on tente le frais (8 s max), sinon on répond
// depuis le cache — un dossier déjà consulté reste accessible hors ligne.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.includes('/api/'),
  new NetworkFirst({
    cacheName: 'rdc-api-v1',
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
        purgeOnQuotaError: true, // jamais de crash pour cause de quota
      }),
    ],
  }),
);

// ---------- Background Sync → prévenir l'app de rejouer l'outbox ----------
// L'événement 'sync' (Background Sync API) n'est pas dans l'event map
// du DOM lib : listener typé EventListener + lecture du tag par cast.
self.addEventListener(
  'sync',
  ((event: ExtendableEvent) => {
    const tag = (event as ExtendableEvent & { tag?: string }).tag;
    if (tag !== 'rdc-outbox-sync') return;
    event.waitUntil(
      self.clients
        .matchAll({ includeUncontrolled: true, type: 'window' })
        .then((clients) => {
          clients.forEach((client) => client.postMessage('RDC_SYNC'));
          return undefined;
        })
        .catch(() => undefined),
    );
  }) as EventListener,
);

// ---------- Mise à jour : SKIP_WAITING depuis l'application ----------
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
