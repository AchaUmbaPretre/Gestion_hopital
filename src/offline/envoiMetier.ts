/**
 * ENVOI MÉTIER — rejeu adapté par type de mutation (phases 3-4 RDC).
 *
 * La majorité des mutations part telles quelles (envoiAxios). Quatre
 * types exigent un traitement spécial AVANT/AUTOUR de l'envoi :
 *
 *  - `creer_patient` (B1)  : le backend renvoie DÉSORMAIS id_patient →
 *    mis en cache (meta `map_patient:<dossier>`) pour lier
 *    immédiatement caisse/ordonnances sans réconciliation.
 *
 *  - `creer_facture`  : le payload porte patient_id = null quand le
 *    patient a été créé localement (dossier INIT-ANNÉE-N°). Le patient
 *    a normalement été synchronisé AVANT (ordre FIFO de l'outbox) →
 *    réconciliation par identité (GET /api/patient). Sans id résolu →
 *    ErreurAttente (l'entrée attend le prochain cycle, sans consommer
 *    d'essai). Depuis B1, POST /api/factures renvoie id_facture →
 *    mise en cache DIRECTE (la réconciliation par correspondance
 *    patient+montant+date ne sert plus que de secours).
 *
 *  - `creer_paiement` : id facture depuis le cache puis réconciliation
 *    live, POST avec l'id RÉSOLU — jamais de paiement orphelin.
 *
 *  - `creer_ordonnance` (phase 4) : UNE consultation réelle doit
 *    précéder les lignes d'ordonnance. Chaîne de rejeu :
 *      1. id patient (numérique, cache ou réconciliation identité) ;
 *      2. id médecin (personnel_id) — JAMAIS deviné : ErreurAttente ;
 *      3. id type de consultation (numérique ou réconciliation par nom) ;
 *      4. POST /api/consult → id_consultation (B1) sinon réconciliation
 *         patient+date+diagnostic — on ne relance JAMAIS le POST ;
 *      5. PAR ligne : id médicament (numérique, cache ou correspondance
 *         par nom sur GET /api/pharma) puis POST /api/ordonnance +
 *         POST /api/traitement (l'INNER JOIN traitement de la requête
 *         de détail impose la ligne de traitement).
 *    Tout prérequis manquant → ErreurAttente (retour en file SANS
 *    consommer d'essai) : jamais d'ordonnance partielle.
 *
 *  - `delivrer_ordonnance` / `vente_directe` (phase 5, B3) : chaque
 *    sortie de stock est un POST /api/pharma/stock ATOMIQUE
 *    (quantite négative). L'id serveur du médicament est résolu
 *    (numérique, cache map_medic, réconciliation par nom) — clé
 *    d'idempotence dérivée par ligne : le middleware B2 rejoue la
 *    réponse stockée, un rejeu après coupure ne décrémente JAMAIS
 *    deux fois le stock.
 *
 *  - `creer_vente` (phase 5, B3) : carnet de ventes directes
 *    POST /api/pharma/vente — vente au comptoir SANS dossier patient
 *    (table vente_pharma, le carnet remplace la facture).
 *
 *  - `affecter_mutuelle` (phase 5, B3) : résolution du patient
 *    (réutilisation de la chaîne standard) PUIS de l'id mutuelle par
 *    nom (GET /api/mutuelle), POST /api/patient/mutuelle (upsert).
 *
 *  - `creer_triage` (phase 5, endpoint B2) : résolution du patient
 *    puis POST /api/triage avec le payload snake_case — l'urgence
 *    vitale exige autorise_par + motif (arrêté n°1250/2025).
 *
 * 501 = migration 001_rdc_metier.sql non appliquée côté serveur →
 * ErreurDefinitive (échec immédiat avec message explicite, la trace
 * reste en file et imprimée — rejouer 10 fois ne créera jamais la
 * table).
 *
 * Les réconciliations lisent le réseau en GET : le client axios global
 * est durci (timeout 8 s, retry ×3 sur GET — services/resilience.ts).
 */

import axios from 'axios';
import config from '../config';
import { db, type EntreeOutbox } from './db';
import { ErreurAttente, ErreurDefinitive, statutHttpErreur } from './outbox';
import {
  construirePayloadAffectationMutuelle,
  construirePayloadSortieStock,
  construirePayloadVenteDirecte,
  reconcilierIdMutuelleParNom,
  type LigneVenteDirecte,
} from '../services/pharmacieApi';
import { construirePayloadTriage } from '../services/triageApi';
import {
  reconcilierIdFacture,
  reconcilierIdPatientServeur,
  type IdentitePatient,
} from '../services/facturationApi';
import {
  construirePayloadConsultation,
  construirePayloadLigneOrdonnance,
  construirePayloadTraitement,
  lireIdCree,
  reconcilierIdConsultation,
  reconcilierIdMedicamentParNom,
  reconcilierIdTypeConsultation,
} from '../services/consultationApi';
import { estObjet, estTableau, lireChaine, lireNombre, normaliser } from '../services/apiHelpers';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

/**
 * Envoi HTTP brut — renvoie le CORPS de réponse (les ids créés par le
 * backend B1 s'y trouvent) ; exporté pour tests.
 */
export async function envoiAxios(
  methode: 'POST' | 'PUT',
  endpoint: string,
  payload: unknown,
  cleIdempotence: string,
): Promise<unknown> {
  try {
    const reponse = await axios.request({
      method: methode,
      url: `${DOMAINE}${endpoint}`,
      data: payload,
      headers: { 'X-Idempotence-Key': cleIdempotence },
    });
    return reponse?.data;
  } catch (erreur: unknown) {
    // 501 : endpoint RDC présent mais migration 001 non appliquée
    // (tables triage/mutuelle/vente_pharma absentes). Rejouer 10 fois
    // ne créera jamais la table → échec immédiat et explicite, la
    // trace reste en file (visible + imprimable).
    if (statutHttpErreur(erreur) === 501) {
      throw new ErreurDefinitive(
        'migration 001_rdc_metier.sql non appliquée côté serveur — trace conservée localement (lire docs/MIGRATION_PLAN.md §Gaps)',
      );
    }
    throw erreur;
  }
}

// ------------------------------------------------------------
// Cache de réconciliation (Dexie meta) — factures, patients,
// consultations, médicaments
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

// --- cache patients (B1) ---

const PREFIXE_MAP_PATIENT = 'map_patient:';

async function lireMapPatient(dossier: string): Promise<number | null> {
  if (!db || dossier === '') return null;
  try {
    const entree = await db.meta.get(`${PREFIXE_MAP_PATIENT}${dossier}`);
    const n = entree ? Number(entree.valeur) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function ecrireMapPatient(dossier: string, idPatient: number): Promise<void> {
  if (!db || dossier === '') return;
  try {
    await db.meta.put({ cle: `${PREFIXE_MAP_PATIENT}${dossier}`, valeur: String(idPatient) });
  } catch {
    // non bloquant : la réconciliation identité reste disponible
  }
}

// --- cache consultations + médicaments (phase 4) ---

const PREFIXE_MAP_CONSULT = 'map_consult:';
const PREFIXE_MAP_MEDIC = 'map_medic:';

async function lireMapConsult(ordonnanceLocale: string): Promise<number | null> {
  if (!db || ordonnanceLocale === '') return null;
  try {
    const entree = await db.meta.get(`${PREFIXE_MAP_CONSULT}${ordonnanceLocale}`);
    const n = entree ? Number(entree.valeur) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function ecrireMapConsult(ordonnanceLocale: string, idConsultation: number): Promise<void> {
  if (!db || ordonnanceLocale === '') return;
  try {
    await db.meta.put({
      cle: `${PREFIXE_MAP_CONSULT}${ordonnanceLocale}`,
      valeur: String(idConsultation),
    });
  } catch {
    // non bloquant : l'id est consommé immédiatement après l'envoi
  }
}

async function lireMapMedic(nomNormalise: string): Promise<number | null> {
  if (!db || nomNormalise === '') return null;
  try {
    const entree = await db.meta.get(`${PREFIXE_MAP_MEDIC}${nomNormalise}`);
    const n = entree ? Number(entree.valeur) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function ecrireMapMedic(nomNormalise: string, idMedic: number): Promise<void> {
  if (!db || nomNormalise === '') return;
  try {
    await db.meta.put({ cle: `${PREFIXE_MAP_MEDIC}${nomNormalise}`, valeur: String(idMedic) });
  } catch {
    // non bloquant : la correspondance live prendra le relais
  }
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
 * Id MySQL du patient : numérique dans le payload, cache B1
 * (map_patient:<dossier>) sinon réconciliation par identité.
 * Null → ErreurAttente.
 */
async function resoudrePatientId(
  patientIdPayload: unknown,
  identite: IdentitePatient | null,
  dossier = '',
): Promise<number> {
  const direct = lireNombre(patientIdPayload);
  if (direct !== null) return direct;
  const idCache = await lireMapPatient(dossier);
  if (idCache !== null) return idCache;
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
// creer_patient (B1 : id_patient renvoyé → cache)
// ------------------------------------------------------------

async function envoyerPatient(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const reponse = await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/patient',
    brut,
    entree.cleIdempotence,
  );
  const idPatient = lireIdCree(reponse, ['id_patient']);
  const dossier = lireChaine(brut['dossier']);
  if (idPatient !== null && dossier !== '') await ecrireMapPatient(dossier, idPatient);
}

// ------------------------------------------------------------
// creer_facture
// ------------------------------------------------------------

async function envoyerFacture(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const identite = identiteDepuis(brut);
  const dossier = lireChaine(brut['dossier_patient']);
  const patientId = await resoudrePatientId(brut['patient_id'], identite, dossier);

  const reponse = await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/factures',
    { ...brut, patient_id: patientId },
    entree.cleIdempotence,
  );

  const reference = lireChaine(brut['facture_locale']);
  // B1 : le POST renvoie id_facture → cache DIRECT, plus de
  // réconciliation par correspondance (patient + montant + date).
  const idFactureDirect = lireIdCree(reponse, ['id_facture']);
  if (idFactureDirect !== null) {
    if (reference !== '') await ecrireMapFacture(reference, idFactureDirect);
    return;
  }

  // Secours (serveur antérieur à B1) : réconciliation live. La facture
  // existe côté serveur : résoudre et cacher son id pour les acomptes
  // à venir. Échec de réconciliation = non bloquant (les paiements
  // réconcilieront en live au prochain cycle).
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
    // 1bis. Réconciliation live : id patient (cache B1, réconciliation
    // identité si nécessaire) puis correspondance sur GET /api/factures.
    const identite = identiteDepuis(brut);
    const patientId = await resoudrePatientId(
      brut['patient_id'],
      identite,
      lireChaine(brut['dossier_patient']),
    );
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
// creer_ordonnance (phase 4 : consultation réelle + lignes)
// ------------------------------------------------------------

/** Ligne de prescription extraite du payload structuré. */
interface LigneOrdonnancePayload {
  medicament_id: number | null;
  nom_medicament: string;
  quantite: number;
  posologie: string;
  duree_jours: number;
}

function lireLignesPayload(brut: Record<string, unknown>): LigneOrdonnancePayload[] {
  const brutLignes = brut['lignes'];
  if (!estTableau(brutLignes)) return [];
  const lignes: LigneOrdonnancePayload[] = [];
  for (const l of brutLignes) {
    if (!estObjet(l)) continue;
    lignes.push({
      medicament_id: lireNombre(l['medicament_id']),
      nom_medicament: lireChaine(l['nom_medicament']),
      quantite: lireNombre(l['quantite']) ?? 1,
      posologie: lireChaine(l['posologie']),
      duree_jours: lireNombre(l['duree_jours']) ?? 0,
    });
  }
  return lignes;
}

/** Id numérique du médicament : payload, cache, puis GET /api/pharma. */
async function resoudreMedicamentId(ligne: LigneOrdonnancePayload): Promise<number | null> {
  if (ligne.medicament_id !== null) return ligne.medicament_id;
  const nom = normaliser(ligne.nom_medicament);
  if (nom === '') return null;
  const idCache = await lireMapMedic(nom);
  if (idCache !== null) return idCache;
  const idLive = await reconcilierIdMedicamentParNom(ligne.nom_medicament);
  if (idLive !== null) await ecrireMapMedic(nom, idLive);
  return idLive;
}

async function envoyerOrdonnance(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const consultation = estObjet(brut['consultation']) ? brut['consultation'] : {};

  // 1. Patient serveur (numérique, cache B1, réconciliation identité).
  const patientId = await resoudrePatientId(
    consultation['patient_id'],
    identiteDepuis(brut),
  );

  // 2. Médecin : JAMAIS deviné — une attribution d'acte médical
  //    erronée est une faute de dossier. La liste des médecins est
  //    chargée à l'écran ; si elle n'a JAMAIS été joignable, l'entrée
  //    attend (sans consommer d'essai).
  const personnelId = lireNombre(consultation['personnel_id']);
  if (personnelId === null) {
    throw new ErreurAttente(
      "médecin non résolu — la liste des médecins n'a jamais été chargée sur ce poste",
    );
  }

  // 3. Type de consultation : id numérique sinon réconciliation par nom.
  let idType = lireNombre(consultation['id_type_consultation']);
  if (idType === null) {
    const nomType = lireChaine(consultation['nom_type_consultation']);
    idType = await reconcilierIdTypeConsultation(nomType);
    if (idType === null) {
      throw new ErreurAttente(`type de consultation « ${nomType} » introuvable côté serveur`);
    }
  }

  // 4. POST consultation → id (B1) sinon réconciliation patient+date+
  //    diagnostic. On ne relance JAMAIS le POST (doublon médical) :
  //    si un cycle précédent a déjà créé la consultation puis attendu
  //    (ligne en ErreurAttente), l'id est repris du cache map_consult.
  const dateConsultation = lireChaine(consultation['date_consultation']);
  const diagnostic = lireChaine(consultation['diagnostic']);
  const ordonnanceLocale = lireChaine(brut['ordonnance_locale']);
  let idConsultation = await lireMapConsult(ordonnanceLocale);
  if (idConsultation === null) {
    const reponseConsult = await envoiAxios(
      entree.methode,
      entree.endpoint ?? '/api/consult',
      construirePayloadConsultation({
        patientIdServeur: patientId,
        personnelId,
        idTypeConsultation: idType,
        dateConsultation,
        diagnostic,
        notes: lireChaine(consultation['notes']),
      }),
      entree.cleIdempotence,
    );
    idConsultation = lireIdCree(reponseConsult, ['id_consultation', 'insertId']);
    if (idConsultation === null) {
      idConsultation = await reconcilierIdConsultation({
        patientIdServeur: patientId,
        date: dateConsultation,
        diagnostic,
      });
    }
    if (idConsultation === null) {
      throw new ErreurAttente(
        'consultation créée mais id non confirmable — rejeu évité pour éviter le doublon',
      );
    }
    await ecrireMapConsult(ordonnanceLocale, idConsultation);
  }

  // 5. PAR ligne : id médicament puis POST ordonnance + traitement.
  //    Les POST de lignes réutilisent des clés d'idempotence dérivées
  //    (une erreur réseau rejoue TOUTE l'entrée — le dédupe serveur
  //    X-Idempotence-Key neutralise les doublons dès que B2 est déployé).
  const lignes = lireLignesPayload(brut);
  const dateOrdre = lireChaine(brut['date_ordre']) || dateConsultation;
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i] as LigneOrdonnancePayload;
    const idMedicament = await resoudreMedicamentId(ligne);
    if (idMedicament === null) {
      throw new ErreurAttente(
        `médicament « ${ligne.nom_medicament || 'sans nom'} » introuvable côté serveur (GET /api/pharma)`,
      );
    }
    await envoiAxios(
      'POST',
      '/api/ordonnance',
      construirePayloadLigneOrdonnance({
        consultationId: idConsultation,
        medicamentId: idMedicament,
        quantite: ligne.quantite,
        dateOrdre,
      }),
      `${entree.cleIdempotence}:ordo:${i}`,
    );
    await envoiAxios(
      'POST',
      '/api/traitement',
      construirePayloadTraitement({
        consultationId: idConsultation,
        medicamentId: idMedicament,
        posologie: ligne.posologie,
        dureeJours: ligne.duree_jours,
      }),
      `${entree.cleIdempotence}:trait:${i}`,
    );
  }
}

// ------------------------------------------------------------
// delivrer_ordonnance / vente_directe (phase 5 : sorties de stock)
// ------------------------------------------------------------

/**
 * Rejeu d'une sortie de stock : PAR ligne, id médicament résolu
 * (numérique, cache map_medic, réconciliation par nom) puis
 * POST /api/pharma/stock avec quantité NÉGATIVE (ajustement atomique
 * GREATEST(0,…) côté MySQL). La clé d'idempotence dérivée
 * `<clé>:stock:<i>` fait rejouer la réponse stockée par le middleware
 * B2 : un rejeu après coupure réseau ne décrémente JAMAIS deux fois.
 */
async function envoyerSortieStock(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const sorties = lireLignesPayload({ lignes: brut['sorties'] });
  if (sorties.length === 0) {
    throw new ErreurAttente('sortie de stock sans ligne (payload prototype antérieur ?)');
  }
  for (let i = 0; i < sorties.length; i++) {
    const ligne = sorties[i] as LigneOrdonnancePayload;
    const idMedicament = await resoudreMedicamentId(ligne);
    if (idMedicament === null) {
      throw new ErreurAttente(
        `médicament « ${ligne.nom_medicament || 'sans nom'} » introuvable côté serveur (GET /api/pharma)`,
      );
    }
    await envoiAxios(
      'POST',
      '/api/pharma/stock',
      construirePayloadSortieStock({ idMedicament, quantite: ligne.quantite }),
      `${entree.cleIdempotence}:stock:${i}`,
    );
  }
}

// ------------------------------------------------------------
// creer_vente (phase 5 : carnet de ventes directes)
// ------------------------------------------------------------

/** Ligne de vente directe lue défensivement depuis le payload. */
function lireLignesVente(brut: Record<string, unknown>): LigneVenteDirecte[] {
  const brutLignes = brut['lignes'];
  if (!estTableau(brutLignes)) return [];
  const lignes: LigneVenteDirecte[] = [];
  for (const l of brutLignes) {
    if (!estObjet(l)) continue;
    lignes.push({
      medicament_id: lireNombre(l['medicament_id']),
      nom: lireChaine(l['nom']),
      quantite: lireNombre(l['quantite']) ?? 1,
      prix_usd: lireNombre(l['prix_usd']) ?? 0,
    });
  }
  return lignes;
}

/**
 * Rejeu d'une vente directe : POST /api/pharma/vente — AUCUNE
 * résolution de patient (vente au comptoir, table vente_pharma sans
 * FK patient). Le carnet porte la référence locale VTE-…, le client
 * (nommé ou anonyme), le total USD et le taux FC (audit bidevise).
 */
async function envoyerVenteDirecte(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const lignes = lireLignesVente(brut);
  if (lignes.length === 0) {
    throw new ErreurAttente('vente directe sans ligne (payload prototype antérieur ?)');
  }
  const reference = lireChaine(brut['facture_locale']);
  if (reference === '') {
    throw new ErreurAttente('vente directe sans référence locale (VTE-…)');
  }
  await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/pharma/vente',
    construirePayloadVenteDirecte({
      referenceLocale: reference,
      clientNom: lireChaine(brut['client_nom']),
      lignes,
      montantTotalUsd: lireNombre(brut['montant_total_usd']) ?? 0,
      tauxFcUsd: lireNombre(brut['taux_fc_usd']) ?? 0,
      dateVente: lireChaine(brut['date_vente']),
    }),
    entree.cleIdempotence,
  );
}

// ------------------------------------------------------------
// affecter_mutuelle (phase 5 : prise en charge mutuelle)
// ------------------------------------------------------------

/**
 * Rejeu d'une affectation mutuelle : résolution du patient (chaîne
 * standard : numérique, cache B1, réconciliation identité) puis de
 * l'id mutuelle (numérique dans le payload, sinon GET /api/mutuelle
 * par nom normalisé), POST /api/patient/mutuelle (upsert n° adhérent).
 */
async function envoyerAffectationMutuelle(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const identite = identiteDepuis(brut);
  const patientId = await resoudrePatientId(
    brut['patient_id'],
    identite,
    lireChaine(brut['dossier_patient']),
  );

  let idMutuelle = lireNombre(brut['mutuelle_id']);
  if (idMutuelle === null) {
    const nomMutuelle = lireChaine(brut['mutuelle_nom']);
    idMutuelle = await reconcilierIdMutuelleParNom(nomMutuelle);
    if (idMutuelle === null) {
      throw new ErreurAttente(
        `mutuelle « ${nomMutuelle || 'sans nom'} » introuvable côté serveur (GET /api/mutuelle) — création manuelle requise`,
      );
    }
  }

  await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/patient/mutuelle',
    construirePayloadAffectationMutuelle({
      patientIdServeur: patientId,
      idMutuelle,
      numeroAdherent: lireChaine(brut['numero_adherent']),
    }),
    entree.cleIdempotence,
  );
}

// ------------------------------------------------------------
// creer_triage (endpoint B2 : table triage 4 niveaux)
// ------------------------------------------------------------

/**
 * Rejeu d'un triage : résolution du patient puis POST /api/triage
 * (payload snake_case — le contrôleur B2 refuse une urgence vitale
 * sans autorise_par/motif : le formulaire de l'écran Accueil l'impose
 * déjà localement).
 */
async function envoyerTriage(entree: EntreeOutbox): Promise<void> {
  const brut = estObjet(entree.payload) ? entree.payload : {};
  const identite = identiteDepuis(brut);
  const patientId = await resoudrePatientId(
    brut['patient_id'],
    identite,
    lireChaine(brut['dossier_patient']),
  );
  const urgenceVitale = brut['urgence_vitale'] === true;
  await envoiAxios(
    entree.methode,
    entree.endpoint ?? '/api/triage',
    construirePayloadTriage({
      patientIdServeur: patientId,
      niveau: lireChaine(brut['niveau']) || 'vert',
      motif: lireChaine(brut['motif']),
      orientation: lireChaine(brut['orientation']),
      urgenceVitale,
      autorisePar: lireChaine(brut['autorise_par']),
      motifAutorisation: lireChaine(brut['motif_autorisation']),
      montantDuUsd: lireNombre(brut['montant_du_usd']) ?? 0,
      dateTriage: lireChaine(brut['date_triage']),
    }),
    entree.cleIdempotence,
  );
}

// ------------------------------------------------------------
// Dispatch
// ------------------------------------------------------------

/**
 * Fonction d'envoi injectée dans `synchroniser` : traite spécialement
 * patients, factures, paiements, ordonnances, sorties de stock, ventes
 * directes, mutuelles et triages ; laisse le reste partir tel quel.
 */
export async function envoiMetier(entree: EntreeOutbox): Promise<void> {
  switch (entree.type) {
    case 'creer_patient':
      return envoyerPatient(entree);
    case 'creer_facture':
      return envoyerFacture(entree);
    case 'creer_paiement':
      return envoyerPaiement(entree);
    case 'creer_ordonnance':
      return envoyerOrdonnance(entree);
    case 'delivrer_ordonnance':
    case 'vente_directe':
      return envoyerSortieStock(entree);
    case 'creer_vente':
      return envoyerVenteDirecte(entree);
    case 'affecter_mutuelle':
      return envoyerAffectationMutuelle(entree);
    case 'creer_triage':
      return envoyerTriage(entree);
    default:
      if (!entree.endpoint) return; // cible 'local' — ne devrait pas arriver ici
      return envoiAxios(entree.methode, entree.endpoint, entree.payload, entree.cleIdempotence).then(
        () => undefined,
      );
  }
}
