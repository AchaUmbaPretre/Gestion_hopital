/**
 * Enregistrement du Service Worker (production uniquement).
 * Basé sur le template CRA — épuré et typé strict.
 *
 * Flux de mise à jour : quand un nouveau SW est en attente, on lui
 * envoie SKIP_WAITING immédiatement (l'app est utilisée par postes :
 * prendre la mise à jour au rechargement suivant est acceptable et
 * évite un écran de confirmation que le personnel ignorerait).
 */

export type ConfigEnregistrement = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

export function register(config?: ConfigEnregistrement): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

  window.addEventListener('load', () => {
    const estLocalhost = window.location.hostname === 'localhost' ||
      // [::1] = adresse IPv6 localhost.
      window.location.hostname === '[::1]' ||
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(window.location.hostname);

    if (estLocalhost) {
      // Développement local : vérifier que le SW est servi correctement
      // (diagnostic clair plutôt qu'un échec silencieux).
      void verifierSwValide(swUrl, config);
      void navigator.serviceWorker.register(swUrl).then((registration) => {
        brancherMiseAJour(registration, config);
      }).catch(() => {
        console.info('Service Worker non enregistré (développement sans SW).');
      });
    } else {
      void navigator.serviceWorker.register(swUrl).then((registration) => {
        brancherMiseAJour(registration, config);
      }).catch(() => {
        console.info('Service Worker indisponible : mode en ligne simple.');
      });
    }
  });
}

async function verifierSwValide(swUrl: string, config?: ConfigEnregistrement): Promise<void> {
  try {
    const reponse = await fetch(swUrl, { headers: { 'Service-Worker': 'script' } });
    const contentType = reponse.headers.get('content-type') ?? '';
    if (reponse.status === 404 || !contentType.includes('javascript')) {
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      window.location.reload();
    } else {
      const registration = await navigator.serviceWorker.register(swUrl);
      brancherMiseAJour(registration, config);
    }
  } catch {
    console.info('Pas de connexion Internet détectée : app en mode hors ligne.');
  }
}

function brancherMiseAJour(registration: ServiceWorkerRegistration, config?: ConfigEnregistrement): void {
  if (registration.waiting && navigator.serviceWorker.controller) {
    // Un SW plus récent attend déjà : le laisser prendre la main.
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  registration.addEventListener('updatefound', () => {
    const installant = registration.installing;
    if (!installant) return;
    installant.addEventListener('statechange', () => {
      if (installant.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // Nouvelle version prête → activer dès que possible.
          installant.postMessage({ type: 'SKIP_WAITING' });
          config?.onUpdate?.(registration);
        } else {
          config?.onSuccess?.(registration);
        }
      }
    });
  });
}
