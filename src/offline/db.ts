/**
 * Base IndexedDB offline (phase 1 — brief RDC Partie 4).
 *
 * Dexie encapsule IndexedDB : les données critiques survivent aux
 * coupures d'électricité ET aux purges de localStorage (quota,
 * mode privé). Trois tables :
 *
 *  - outbox          : file des mutations en attente de synchronisation
 *                      (statut : en_attente / en_cours / echec) —
 *                      zéro perte d'information, rejeu au retour réseau.
 *  - patients_recent : LRU des derniers patients consultés (cap 200) —
 *                      hydratera le cache React Query en phase 2.
 *  - meta            : comptes divers (dernier sync, versions…).
 *
 * ⚠️ IndexedDB peut être absent (anciens navigateurs, jsdom des tests) :
 * `db` vaut alors null et TOUTES les opérations deviennent des no-op
 * — l'application continue de fonctionner (store mémoire), seule la
 * persistance est perdue. Jamais de crash pour cause de stockage.
 */

import Dexie, { type Table } from 'dexie';

/** Une mutation métier en attente d'être rejouée vers l'API. */
export interface EntreeOutbox {
  id?: number; // auto-incrément Dexie
  /** Type métier : creer_patient, creer_ordonnance, enregistrer_mouvement… */
  type: string;
  /**
   * 'api'     : endpoint existant dans api_hopital → rejeu automatique.
   * 'local'   : gap backend documenté (triage, mutuelle, seuils…) →
   *             reste en file locale, TRACÉ mais jamais envoyé tant que
   *             le backend n'expose pas l'endpoint (zéro perte).
   */
  cible: 'api' | 'local';
  /** Endpoint relatif (ex : '/api/patient') — null si cible 'local'. */
  endpoint: string | null;
  methode: 'POST' | 'PUT';
  /** Charge utile JSON-sérialisable (payload complet, gaps inclus). */
  payload: unknown;
  statut: 'en_attente' | 'en_cours' | 'echec';
  /** Nombre de tentatives de rejeu déjà effectuées. */
  essais: number;
  creeLe: string; // ISO
  dernierEssaiIso: string | null;
  /** Message de la dernière erreur (audit). */
  erreur: string | null;
  /** Clé d'idempotence unique (le serveur pourra dédupliquer). */
  cleIdempotence: string;
}

/** Patient consulté récemment (LRU — offline patients récents). */
export interface PatientRecent {
  patientId: string;
  nom: string;
  prenom: string;
  consulteLe: string; // ISO — clé de tri LRU
}

/** Petite valeur clé/valeur (état de la dernière synchronisation…). */
export interface EntreeMeta {
  cle: string;
  valeur: string;
}

export class RdcOfflineDb extends Dexie {
  outbox!: Table<EntreeOutbox, number>;
  patientsRecent!: Table<PatientRecent, string>;
  meta!: Table<EntreeMeta, string>;

  constructor() {
    super('rdc_offline_v1');
    this.version(1).stores({
      // index : statut (comptages), cle idempotence unique (dédup)
      outbox: '++id, statut, type, &cleIdempotence, creeLe',
      patientsRecent: 'patientId, consulteLe',
      meta: 'cle',
    });
  }
}

function creerDb(): RdcOfflineDb | null {
  try {
    if (typeof indexedDB === 'undefined') return null;
    return new RdcOfflineDb();
  } catch {
    return null;
  }
}

/** Instance unique — null si IndexedDB indisponible (mode dégradé). */
export const db: RdcOfflineDb | null = creerDb();

/** Plafond LRU des patients récents (évite de saturer le quota). */
export const CAP_PATIENTS_RECENTS = 200;

/**
 * Enregistre (ou rafraîchit) un patient dans le LRU puis rogne
 * au-delà du plafond. No-op si IndexedDB indisponible.
 */
export async function noterPatientRecent(p: PatientRecent): Promise<void> {
  if (!db) return;
  try {
    await db.patientsRecent.put(p);
    const total = await db.patientsRecent.count();
    if (total > CAP_PATIENTS_RECENTS) {
      const surplus = total - CAP_PATIENTS_RECENTS;
      const aSupprimer = await db.patientsRecent.orderBy('consulteLe').limit(surplus).toArray();
      await db.patientsRecent.bulkDelete(aSupprimer.map((x) => x.patientId));
    }
  } catch {
    // stockage indisponible : non bloquant
  }
}
