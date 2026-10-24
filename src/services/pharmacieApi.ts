/**
 * BRANCHEMENT API PHARMACIE RÉELLE (phase 5 — plan de migration RDC v2).
 *
 * Endpoints api_hopital consommés (audit backend B3 — commit 57217cc) :
 *
 *   GET  /api/ordonnance      → file d'attente pharmacie : UNE ligne par
 *                               médicament (B3 a supprimé le GROUP BY qui
 *                               effondrait N lignes en 1) avec
 *                               id_ordonnance, medicament_id, id_patient ;
 *   POST /api/pharma/stock    → { id, quantite } ajustement ATOMIQUE
 *                               (quantite négative = sortie de stock) —
 *                               emprunté par l'outbox (delivrer_ordonnance,
 *                               vente_directe), PAS par ce service ;
 *   POST /api/pharma/vente    → carnet de ventes directes (VTE-…)
 *                               — pratique réelle HGR : vente au comptoir
 *                               sans facture patient ;
 *   GET  /api/mutuelle        → mutuelles actives (datalistPatients) ;
 *   POST /api/patient/mutuelle → affectation (upsert n° adhérent)
 *                               — emprunté par l'outbox.
 *
 * Les ÉCRITURES n'empruntent PAS ce service : elles passent par
 * l'outbox offline (offline/envoiMetier.ts) qui réutilise ici les
 * mappings, payloads et réconciliations de secours.
 *
 * TypeScript strict, zéro `any` — lecture défensive MySQL.
 */

import axios from 'axios';
import config from '../config';
import { attachResilience } from './resilience';
import { estObjet, estTableau, lireChaine, lireNombre, normaliser } from './apiHelpers';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

/** Instance privée durcie : timeout 8 s, retry ×3 backoff (GET). */
const clientApi = attachResilience(axios.create(), { timeoutMs: 8_000, retries: 3 });

// ------------------------------------------------------------
// File d'attente serveur (GET /api/ordonnance — B3 : une ligne/médicament)
// ------------------------------------------------------------

/** Une ligne d'ordonnance telle que renvoyée par GET /api/ordonnance. */
export interface LigneOrdonnanceServeur {
  idOrdonnance: number;
  /** Id de consultation MySQL (regroupement des lignes d'une même ordonnance). */
  idConsultation: number;
  /** Id du patient MySQL (id_patient) — null si colonne absente. */
  idPatient: number | null;
  idMedicament: number | null;
  nomMedicament: string;
  quantite: number;
  dateOrdre: string;
  nomPatient: string;
  prenomPatient: string;
  nomConsultation: string;
}

export function mapLigneOrdonnanceServeur(brut: Record<string, unknown>): LigneOrdonnanceServeur | null {
  const idOrdonnance = lireNombre(brut['id_ordonnance']);
  const idConsultation = lireNombre(brut['id']);
  if (idOrdonnance === null && idConsultation === null) return null;
  return {
    idOrdonnance: idOrdonnance ?? 0,
    idConsultation: idConsultation ?? 0,
    idPatient: lireNombre(brut['id_patient']),
    idMedicament: lireNombre(brut['medicament_id']),
    nomMedicament: lireChaine(brut['nomMedicament']),
    quantite: lireNombre(brut['quantite']) ?? 1,
    dateOrdre: lireChaine(brut['dateOrdre']),
    nomPatient: lireChaine(brut['nom_patient']),
    prenomPatient: lireChaine(brut['prenom']),
    nomConsultation: lireChaine(brut['nomConsultation']),
  };
}

export function mapOrdonnancesServeurApi(reponse: unknown): LigneOrdonnanceServeur[] {
  if (!estTableau(reponse)) return [];
  const lignes: LigneOrdonnanceServeur[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const ligne = mapLigneOrdonnanceServeur(brut);
    if (ligne !== null) lignes.push(ligne);
  }
  return lignes;
}

export async function getOrdonnancesServeurApi(): Promise<LigneOrdonnanceServeur[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/ordonnance`);
  return mapOrdonnancesServeurApi(reponse.data);
}

// ------------------------------------------------------------
// Mutuelles (GET /api/mutuelle — B3)
// ------------------------------------------------------------

/** Une mutuelle active telle que renvoyée par GET /api/mutuelle. */
export interface MutuelleApi {
  id: number;
  nomOrganisme: string;
  tauxCouverture: number;
}

export function mapMutuellesApi(reponse: unknown): MutuelleApi[] {
  if (!estTableau(reponse)) return [];
  const mutuelles: MutuelleApi[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const id = lireNombre(brut['id_mutuelle']);
    const nom = lireChaine(brut['nom_organisme']);
    if (id === null || nom === '') continue;
    mutuelles.push({
      id,
      nomOrganisme: nom,
      tauxCouverture: lireNombre(brut['taux_couverture']) ?? 0,
    });
  }
  return mutuelles;
}

export async function getMutuellesApi(): Promise<MutuelleApi[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/mutuelle`);
  return mapMutuellesApi(reponse.data);
}

/** Réconciliation : id mutuelle par nom normalisé (affectation hors ligne). */
export async function reconcilierIdMutuelleParNom(nomOrganisme: string): Promise<number | null> {
  const cible = normaliser(nomOrganisme);
  if (cible === '') return null;
  try {
    // Client axios GLOBAL (durci par installerResilienceGlobale) —
    // même convention que les réconciliations de consultationApi.
    const reponse = await axios.get(`${DOMAINE}/api/mutuelle`);
    for (const m of mapMutuellesApi(reponse.data)) {
      if (normaliser(m.nomOrganisme) === cible) return m.id;
    }
    return null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Payloads backend (empruntés par l'outbox / envoiMetier)
// ------------------------------------------------------------

/**
 * Affectation d'un patient à une mutuelle — POST /api/patient/mutuelle.
 * L'id patient est résolu AVANT l'envoi (payload du store : numérique,
 * cache map_patient, réconciliation identité) ; l'id mutuelle est
 * résolu par nom au rejeu (reconcilierIdMutuelleParNom).
 */
export function construirePayloadAffectationMutuelle(entree: {
  patientIdServeur: number;
  idMutuelle: number;
  numeroAdherent: string;
}): Record<string, unknown> {
  return {
    patient_id: entree.patientIdServeur,
    mutuelle_id: entree.idMutuelle,
    numero_adherent: entree.numeroAdherent !== '' ? entree.numeroAdherent : null,
    date_affiliation: new Date().toISOString().slice(0, 10),
  };
}

/** Une ligne de vente directe (carnet pharmacie). */
export interface LigneVenteDirecte {
  medicament_id: number | null;
  nom: string;
  quantite: number;
  prix_usd: number;
}

/**
 * Enregistrement d'une vente directe — POST /api/pharma/vente
 * (table vente_pharma, carnet remplaçant la facture pour les ventes
 * au comptoir sans dossier patient).
 */
export function construirePayloadVenteDirecte(entree: {
  referenceLocale: string;
  clientNom: string;
  lignes: LigneVenteDirecte[];
  montantTotalUsd: number;
  tauxFcUsd: number;
  dateVente: string;
}): Record<string, unknown> {
  return {
    facture_locale: entree.referenceLocale,
    client_nom: entree.clientNom !== '' ? entree.clientNom : null,
    lignes: entree.lignes,
    montant_total_usd: entree.montantTotalUsd,
    taux_fc_usd: entree.tauxFcUsd,
    date_vente: entree.dateVente,
  };
}

/**
 * Sortie de stock d'une délivrance — POST /api/pharma/stock
 * (quantite NÉGATIVE = sortie ; ajustement atomique GREATEST(0,…)).
 * L'id serveur du médicament est résolu AVANT l'envoi (numérique,
 * cache map_medic, réconciliation par nom).
 */
export function construirePayloadSortieStock(entree: {
  idMedicament: number;
  quantite: number;
}): Record<string, unknown> {
  return { id: entree.idMedicament, quantite: -Math.abs(Math.round(entree.quantite)) };
}
