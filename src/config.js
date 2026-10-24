import axios from "axios";
// Résilience RDC (phase 1) : durcit userRequest (timeout 8 s,
// retry ×3 backoff exponentiel, erreurs transitoires uniquement —
// les mutations POST passent par l'outbox offline). Voir
// services/resilience.ts.
import { attachResilience } from './services/resilience';

export default {
      REACT_APP_SERVER_DOMAIN : 'http://localhost:8080' 
};

// ------------------------------------------------------------
// FIX (étape 3) : l'ancien code envoyait `header:` (clé ignorée
// par axios) et figeait le token au chargement du module (avant
// login → jamais à jour). Interceptor lazy : lit le token au
// moment de CHAQUE requête depuis redux-persist, et utilise la
// vraie clé `headers` + schéma `Authorization: Bearer` attendu
// par le backend (api_hopital/middleware/auth.middleware.js).
// ------------------------------------------------------------
export const userRequest = axios.create({
      baseURL: 'http://localhost:8080',
});

userRequest.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('persist:root');
    const user = raw && JSON.parse(raw)?.user;
    const currentUser = user && JSON.parse(user)?.currentUser;
    const token = currentUser?.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // persist:root absent (non connecté) : requête anonyme.
  }
  return config;
});

// ------------------------------------------------------------
// Application de la résilience (import en tête de module).
// ------------------------------------------------------------
attachResilience(userRequest, { timeoutMs: 8000, retries: 3 });
