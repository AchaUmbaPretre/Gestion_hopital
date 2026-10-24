/**
 * ENVOI MÉTIER — rejeu adapté par type de mutation (phase 3 RDC).
 *
 * La majorité des mutations part telles quelles (envoiAxios). Deux
 * types exigent un traitement spécial AVANT l'envoi, car api_hopital
 * (gelé) ne renvoie pas les ids créés :
 *
 *  - `creer_facture`  : le payload porte patient_id = null quand le
 *    patient a été créé localement (dossier INIT-ANNÉE-N°). Le patient
 *    a normalement été synchronisé AVANT (ordre FIFO de l'outbox) →
 *    réconciliation par identité (GET /api/patient). Sans id résolu →
 *    ErreurAttente (l'entrée attend le prochain cycle, sans consommer
 *    d'essai). Après succès, l'id serveur de la FACTURE est résolu et
 *    mis en cache (meta `map_facture:<référence>`) pour les acomptes.
 *
 *  - `creer_paiement` : id_facture = null à la mise en file. Résolution
 *    à l'envoi : 1) cache meta ; 2) correspondance live GET /api/factures
 *    (patient + montant + date, en excluant les ids déjà appariés).
 *    Sans facture résolue → ErreurAttente (l'acompte attendra que la
 *    facture soit réellement sur le serveur — jamais de paiement orphelin).
 *
 * Les réconciliations lisent le réseau en GET : le client axios global
 * est durci (timeout 8 s, retry ×3 sur GET — services/resilience.ts).
 */

import axios from 'axios';
import config from '../config';
import { db, type EntreeOutbox } from './db';
import { ErreurAttente } from './outbox';
import {
  reconcilierIdFacture,
  reconcilierIdPatientServeur,
  type IdentitePatient,
} from '../services/facturationApi';
import { estObjet, lireChaine, lireNombre } from '../services/apiHelpers';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

/** Envoi HTTP brut (inchangé depuis la phase 1) — exporté pour tests. */
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

// ------------------------------------------------------------
// Cache de réconciliation (Dexie meta)
// ------------------------------------------------------------

const PREFIXE_MAP = 'map_facture:';

async function lireMapFacture(reference: string): Promise<number | null> {
  if (!db || reference === '') return null;
  try {
    const entree = await db.meta.get(`${PREFIXE_MAP}${reference}`);
    const n = entree ? Number(entree.valeur) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function ecrireMapFacture(reference: string, idFacture: number): Promise<void> {
  if (!db || reference === '') return;
  try {
    await db.meta.put({ cle: `${PREFIXE_MAP}${reference}`, valeur: String(idFacture) });
  } catch {
    // cache indisponible : la réconciliation live prendra le relais
  }
}

/** Ids serveur déjà attribués à des factures locales (anti double-appariement). */
async function idsFacturesMappees(): Promise<Set<number>> {
  const ids = new Set<number>();
  if (!db) return ids;
  try {
    const entrees = await db.meta.where('cle').startsWith(PREFIXE_MAP).toArray();
    for (const e of entrees) {
      const n = Number(e.valeur);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  } catch {
    // cache indisponible : appariement sans exclusion (risque documenté §16.5)
  }
  return ids;
}

// ------------------------------------------------------------
// Résolution du patient serveur
// ------------------------------------------------------------

function identiteDepuis(brut: Record<string, unknown>): IdentitePatient | null {
  const v = brut['patient_identite'];
  if (!estObjet(v)) return null;
  return {
    nom: lireChaine(v['nom']),
    prenom: lireChaine(v['prenom']),
    telephone: lireChaine(v['telephone']),
  };
}

/**
 * Id MySQL du patient : numérique dans le payload (patient venu de
 * l'API) sinon réconciliation par identité. Null → ErreurAttente.
 */
async function resoudrePatientId(
  patientIdPayload: unknown,
  identite: IdentitePatient | null,
): Promise<number> {
  const direct = lireNombre(patientIdPayload);
  if (direct !== null) return direct;
  if (identite === null) {
    throw new ErreurAttente('patient sans identité de réconciliation (payload prototype antérieur ?)');
  }
  const id = await reconcilierIdPatientServeur(identite);
  if (id === null) {
    throw new ErreurAttente('patient local pas encore synchronisé vers le serveur');
  }
  return id;
}

// ------------------------------------------------------------
// creer_facture
// ------------------------------------------------------------

async function envoyerFacture(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const identite = identiteDepuis(brut);
  const patientId = await resoudrePatientId(brut['patient_id'], identite);

  await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/factures',
    { ...brut, patient_id: patientId },
    entree.cleIdempotence,
  );

  // La facture existe côté serveur : résoudre et cacher son id pour
  // les acomptes à venir. Échec de réconciliation = non bloquant
  // (les paiements réconcilieront en live au prochain cycle).
  const reference = lireChaine(brut['facture_locale']);
  const montant = lireNombre(brut['montant_total']);
  if (reference === '' || montant === null) return;
  const idsMappees = await idsFacturesMappees();
  const idFacture = await reconcilierIdFacture({
    patientIdServeur: patientId,
    montantTotal: montant,
    dateEmission: lireChaine(brut['date_emission']),
    idsDejaMappees: idsMappees,
  });
  if (idFacture !== null) await ecrireMapFacture(reference, idFacture);
}

// ------------------------------------------------------------
// creer_paiement
// ------------------------------------------------------------

async function envoyerPaiement(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const reference = lireChaine(brut['facture_locale']);

  // 1. Id facture : cache d'abord — si le cache connaît la facture,
  //    AUCUNE résolution de patient n'est nécessaire (un acompte part
  //    tout seul, même si le patient est encore en file).
  let idFacture = await lireMapFacture(reference);
  if (idFacture === null) {
    // 1bis. Réconciliation live : id patient (réconciliation identité
    // si nécessaire) puis correspondance sur GET /api/factures.
    const identite = identiteDepuis(brut);
    const patientId = await resoudrePatientId(brut['patient_id'], identite);
    const montantFacture = lireNombre(brut['montant_facture']);
    const dateEmission = lireChaine(brut['date_emission_facture']);
    if (montantFacture === null || dateEmission === '') {
      throw new ErreurAttente('facture sans critères de réconciliation (payload prototype antérieur ?)');
    }
    idFacture = await reconcilierIdFacture({
      patientIdServeur: patientId,
      montantTotal: montantFacture,
      dateEmission,
      idsDejaMappees: await idsFacturesMappees(),
    });
    if (idFacture === null) {
      throw new ErreurAttente('facture pas encore synchronisée — paiement rejoué plus tard');
    }
    await ecrireMapFacture(reference, idFacture);
  }

  await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/paiement',
    { ...brut, id_facture: idFacture },
    entree.cleIdempotence,
  );
}

// ------------------------------------------------------------
// Dispatch
// ------------------------------------------------------------

/**
 * Fonction d'envoi injectée dans `synchroniser` : traite spécialement
 * factures et paiements, laisse le reste partir tel quel.
 */
export async function envoiMetier(entree: EntreeOutbox): Promise<void> {
  switch (entree.type) {
    case 'creer_facture':
      return envoyerFacture(entree);
    case 'creer_paiement':
      return envoyerPaiement(entree);
    default:
      if (!entree.endpoint) return; // cible 'local' — ne devrait pas arriver ici
      return envoiAxios(entree.methode, entree.endpoint, entree.payload, entree.cleIdempotence);
  }
}
