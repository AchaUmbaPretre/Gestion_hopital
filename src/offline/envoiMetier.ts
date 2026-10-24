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
  const reponse = await axios.request({
    method: methode,
    url: `${DOMAINE}${endpoint}`,
    data: payload,
    headers: { 'X-Idempotence-Key': cleIdempotence },
  });
  return reponse?.data;
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
// Dispatch
// ------------------------------------------------------------

/**
 * Fonction d'envoi injectée dans `synchroniser` : traite spécialement
 * patients, factures, paiements et ordonnances, laisse le reste partir
 * tel quel.
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
    default:
      if (!entree.endpoint) return; // cible 'local' — ne devrait pas arriver ici
      return envoiAxios(entree.methode, entree.endpoint, entree.payload, entree.cleIdempotence).then(
        () => undefined,
      );
  }
}
