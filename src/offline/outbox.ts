/**
 * OUTBOX — file d'écriture différée (brief RDC Partie 4.1).
 *
 * Chaque mutation métier (créer patient, ordonnance, mouvement de
 * caisse…) est TRACÉE ici avant/pendant qu'elle soit rejouée vers
 * l'API. Politique :
 *
 *  - cible 'api'     → rejeu automatique au retour du réseau
 *                      (événement online, Background Sync du Service
 *                      Worker, démarrage, périodicité 60 s).
 *  - cible 'local'   → gap backend documenté (triage, mutuelle,
 *                      exonération, seuils…) : la trace reste en file
 *                      locale + imprimée — ZÉRO perte d'information
 *                      (docs/RDC_BUSINESS_LOGIC.md §12).
 *
 * Statuts : en_attente → en_cours → (supprimée si succès |
 * en_attente si erreur réseau/5xx | echec si erreur 4xx permanente).
 * Une entrée en échec reste visible dans l'UI (badge) : le personnel
 * voit combien d'écritures attendent la synchronisation — jamais un
 * écran vide qui prétend que tout est envoyé.
 *
 * Le rejeu reçoit une FONCTION D'ENVOI injectable (`FonctionEnvoi`) :
 * testable sans réseau, et branchée en production sur axios (avec
 * token frais au moment du rejeu, pas à l'heure de la mise en file).
 */

import { useSyncExternalStore } from 'react';
import { db, type EntreeOutbox } from './db';

export type CibleMutation = 'api' | 'local';

export interface DemandeMutation {
  type: string;
  cible: CibleMutation;
  endpoint: string | null;
  payload: unknown;
  methode?: 'POST' | 'PUT';
  /** Optionnel — sinon dérivé du contenu (déterministe). */
  cleIdempotence?: string;
}

/** Nombre max de tentatives de rejeu automatiques avant « echec ». */
export const MAX_ESSAIS = 10;
/** Taille de lot par synchronisation (réseau instable → petit lot). */
export const TAILLE_LOT = 50;

// ------------------------------------------------------------
// Instantané de synchronisation (pub/sub minimal, like rdcStore)
// ------------------------------------------------------------
export interface InstantaneSync {
  /** Mutations api+local en attente de rejeu. */
  enAttente: number;
  /** Mutations rejetées par le serveur (4xx) — action manuelle requise. */
  echecs: number;
  /** Un cycle de synchronisation est en cours. */
  enCours: boolean;
  /** Dernière synchronisation terminée (ISO), null si jamais. */
  dernierSyncIso: string | null;
}

let instantane: InstantaneSync = {
  enAttente: 0,
  echecs: 0,
  enCours: false,
  dernierSyncIso: null,
};

const listeners = new Set<() => void>();

function publier(): void {
  listeners.forEach((l) => l());
}

function majInstantane(patch: Partial<InstantaneSync>): void {
  instantane = { ...instantane, ...patch };
  publier();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstantaneSync(): InstantaneSync {
  return instantane;
}

/** Hook React — badge « en attente de synchronisation » (TopBar, Accueil). */
export function useSyncStatus(): InstantaneSync {
  return useSyncExternalStore(subscribe, getInstantaneSync, getInstantaneSync);
}

/** Recharge les compteurs depuis IndexedDB (au démarrage, après rejeu). */
export async function rafraichirCompteurs(): Promise<void> {
  if (!db) return;
  try {
    const [enAttente, echecs] = await Promise.all([
      db.outbox.where('statut').equals('en_attente').count(),
      db.outbox.where('statut').equals('echec').count(),
    ]);
    const meta = await db.meta.get('dernierSyncIso');
    majInstantane({
      enAttente,
      echecs,
      dernierSyncIso: meta ? meta.valeur : instantane.dernierSyncIso,
    });
  } catch {
    // stockage indisponible : compteurs restent locaux
  }
}

// ------------------------------------------------------------
// Mise en file
// ------------------------------------------------------------
function genererCle(entree: DemandeMutation): string {
  if (entree.cleIdempotence) return entree.cleIdempotence;
  return `${entree.type}:${JSON.stringify(entree.payload).slice(0, 180)}`;
}

/**
 * Trace une mutation dans la file. Fire-and-forget : NE JAMAIS
 * bloquer l'action métier (une panne IndexedDB ne doit pas empêcher
 * un triage rouge d'être enregistré dans le store mémoire).
 */
export function enregistrerMutation(demande: DemandeMutation): Promise<void> {
  const entree: EntreeOutbox = {
    type: demande.type,
    cible: demande.cible,
    endpoint: demande.endpoint,
    methode: demande.methode ?? 'POST',
    payload: demande.payload,
    statut: 'en_attente',
    essais: 0,
    creeLe: new Date().toISOString(),
    dernierEssaiIso: null,
    erreur: null,
    cleIdempotence: genererCle(demande),
  };
  if (!db) return Promise.resolve();
  return (async () => {
    // Déduplication : la même clé d'idempotence remplace l'entrée
    // existante (pas de doublon au re-rejeu, index unique respecté).
    const existante = await db.outbox.where('cleIdempotence').equals(entree.cleIdempotence).first();
    if (existante?.id !== undefined) {
      await db.outbox.put({ ...entree, id: existante.id });
    } else {
      await db.outbox.put(entree);
    }
    await rafraichirCompteurs();
  })().catch(() => undefined);
}

// ------------------------------------------------------------
// Rejeu (synchronisation)
// ------------------------------------------------------------

/**
 * Le rejeu reçoit l'ENTRÉE COMPLÈTE (type métier compris) : certaines
 * mutations exigent un traitement spécial avant l'envoi — la facture
 * doit résoudre l'id serveur du patient, le paiement celui de la facture
 * (réconciliation, phase 3 — voir offline/envoiMetier.ts).
 */
export type FonctionEnvoi = (entree: EntreeOutbox) => Promise<void>;

export interface ResultatSync {
  envoyes: number;
  echecs: number;
  /**
   * Entrées remises en attente SANS consommer d'essai : leur prérequis
   * n'est pas encore synchronisé (patient ou facture attendu) —
   * ErreurAttente levée par l'envoi métier. Visibles dans le badge,
   * rejouées au prochain cycle.
   */
  attendus: number;
}

/**
 * Prérequis non encore résolu (ex. : le patient local n'est pas encore
 * synchronisé, donc la facture ne peut pas porter son id serveur).
 * NE COMPTE PAS comme un essai : l'entrée retourne en « en_attente »
 * et sera rejouée au prochain cycle, sans jamais basculer en « echec »
 * pour une simple question d'ordre de synchronisation.
 */
export class ErreurAttente extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurAttente';
  }
}

/**
 * Rejet DÉFINITIF identifié côté client (sans statut HTTP 4xx) :
 * l'entrée bascule immédiatement en « echec » — SANS consommer les
 * 10 essais de rejeu. Cas d'usage : 501 « migration 001 non appliquée
 * côté serveur » — rejouer 10 fois ne créera jamais la table, autant
 * marquer l'échec tout de suite avec un message explicite (la trace
 * reste en file, visible et imprimable — zéro perte).
 */
export class ErreurDefinitive extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurDefinitive';
  }
}

/** Erreur HTTP côté serveur avec statut identifiable (4xx/5xx). */
export function statutHttpErreur(erreur: unknown): number | null {
  if (typeof erreur !== 'object' || erreur === null) return null;
  const reponse = (erreur as { response?: { status?: unknown } }).response;
  const statut = reponse?.status;
  return typeof statut === 'number' ? statut : null;
}

/**
 * 4xx (sauf 408/429) = rejet permanent du serveur → statut « echec »
 * (traitement manuel, la trace reste imprimée). Le reste (réseau,
 * timeout, 5xx, 429) → retour en « en_attente », rejeu plus tard.
 */
function erreurPermanente(erreur: unknown): boolean {
  const statut = statutHttpErreur(erreur);
  if (statut === null) return false;
  return statut >= 400 && statut < 500 && statut !== 408 && statut !== 429;
}

/**
 * Rejoue les mutations en attente (lot de TAILLE_LOT max).
 * Ne rejeu PAS les entrées « echec » (action manuelle) ni les
 * cibles « local » (gaps backend).
 */
export async function synchroniser(envoi: FonctionEnvoi): Promise<ResultatSync> {
  if (!db) return { envoyes: 0, echecs: 0, attendus: 0 };
  if (getInstantaneSync().enCours) return { envoyes: 0, echecs: 0, attendus: 0 };
  majInstantane({ enCours: true });
  try {
    const lot = await db.outbox
      .where('statut')
      .equals('en_attente')
      .limit(TAILLE_LOT)
      .toArray();

    let envoyes = 0;
    let echecs = 0;
    let attendus = 0;

    for (const entree of lot) {
      // Cible 'local' : gap backend — la trace reste en file, jamais envoyée.
      if (entree.cible !== 'api' || !entree.endpoint) continue;
      if (entree.id === undefined) continue; // jamais le cas après lecture

      await db.outbox.update(entree.id, { statut: 'en_cours', dernierEssaiIso: new Date().toISOString() });
      try {
        await envoi(entree);
        await db.outbox.delete(entree.id);
        envoyes += 1;
      } catch (erreur: unknown) {
        if (erreur instanceof ErreurAttente) {
          // Prérequis pas encore synchronisé : retour en file SANS
          // consommer d'essai — ce n'est ni une panne réseau ni un
          // rejet métier, juste une question d'ordre.
          attendus += 1;
          await db.outbox.update(entree.id, {
            statut: 'en_attente',
            erreur: `en attente : ${erreur.message}`,
          });
          continue;
        }
        if (erreur instanceof ErreurDefinitive) {
          // Rejet identifié côté client (501 migration absente…) :
          // échec immédiat, message explicite, pas de rejeu inutile.
          echecs += 1;
          await db.outbox.update(entree.id, {
            statut: 'echec',
            essais: entree.essais + 1,
            erreur: erreur.message,
          });
          continue;
        }
        echecs += 1;
        const echec = erreurPermanente(erreur) || entree.essais + 1 >= MAX_ESSAIS;
        await db.outbox.update(entree.id, {
          statut: echec ? 'echec' : 'en_attente',
          essais: entree.essais + 1,
          erreur: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
    }

    const horodatage = new Date().toISOString();
    try {
      await db.meta.put({ cle: 'dernierSyncIso', valeur: horodatage });
    } catch {
      // non bloquant
    }
    majInstantane({ enCours: false, dernierSyncIso: horodatage });
    await rafraichirCompteurs();
    return { envoyes, echecs, attendus };
  } finally {
    majInstantane({ enCours: false });
  }
}

// ------------------------------------------------------------
// Réinitialisation (démo / formation / tests)
// ------------------------------------------------------------
export async function reinitialiserOutbox(): Promise<void> {
  instantane = { enAttente: 0, echecs: 0, enCours: false, dernierSyncIso: null };
  publier();
  if (!db) return;
  try {
    await db.outbox.clear();
    await rafraichirCompteurs();
  } catch {
    // non bloquant
  }
}
