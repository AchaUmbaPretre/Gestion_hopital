/**
 * BRANCHEMENT API CONSULTATION & ORDONNANCES RÉELLES (phase 4 — plan
 * de migration RDC v2).
 *
 * Endpoints api_hopital consommés (audit backend B1 — commit 2b9da37 :
 * les POST renvoient DÉSORMAIS les ids créés) :
 *
 *   GET  /api/consult/consult_type → types de consultation (nom + prix)
 *   GET  /api/docteur              → médecins (réponse enveloppée {data})
 *   GET  /api/pharma               → stock médicaments temps réel
 *   POST /api/consult              → {patientId, personnelId,
 *                                    id_typeConsultation, dateConsultation,
 *                                    diagnostic, notes} → id_consultation
 *   POST /api/ordonnance           → {consultationId, medicamentId,
 *                                    quantite, dateOrdre} → id_ordonnance
 *                                    (UNE ligne par médicament)
 *   POST /api/traitement           → {consultationId, medicament, dose,
 *                                    frequence, duree, instructions}
 *                                    (requis : GET /api/ordonnance/one
 *                                    INNER JOIN traitement)
 *
 * Les ÉCRITURES n'empruntent PAS ce service : elles passent par
 * l'outbox offline (offline/envoiMetier.ts → envoyerOrdonnance) qui
 * réutilise ici les payloads, la lecture défensive des ids et les
 * réconciliations de secours (id non renvoyé par un serveur antérieur
 * à B1).
 *
 * TypeScript strict, zéro `any` — lecture défensive MySQL (un champ
 * manquant devient '', 0 ou null, jamais un crash dans un écran de soin).
 */

import axios from 'axios';
import config from '../config';
import { attachResilience } from './resilience';
import { estObjet, estTableau, lireChaine, lireNombre, normaliser } from './apiHelpers';
import type { Medicament } from '../pages/rdc/data/types';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

/** Instance privée durcie : timeout 8 s, retry ×3 backoff (GET). */
const clientApi = attachResilience(axios.create(), { timeoutMs: 8_000, retries: 3 });

// ------------------------------------------------------------
// Types de consultation (GET /api/consult/consult_type)
// ------------------------------------------------------------

export interface TypeConsultationApi {
  id: number;
  nom: string;
  /** Tarif de référence (USD) — alimente la caisse. */
  prixUsd: number;
}

export function mapTypesConsultationApi(reponse: unknown): TypeConsultationApi[] {
  if (!estTableau(reponse)) return [];
  const types: TypeConsultationApi[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const id = lireNombre(brut['id_typeConsultation']);
    const nom = lireChaine(brut['nomConsultation']);
    if (id === null || nom === '') continue;
    types.push({ id, nom, prixUsd: lireNombre(brut['prixConsultation']) ?? 0 });
  }
  return types;
}

export async function getTypesConsultationApi(): Promise<TypeConsultationApi[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/consult/consult_type`);
  return mapTypesConsultationApi(reponse.data);
}

// ------------------------------------------------------------
// Médecins (GET /api/docteur — enveloppe { success, data })
// ------------------------------------------------------------

export interface DocteurApi {
  /** Id MySQL `users.id` — obligatoire pour POST /api/consult. */
  id: number;
  nom: string;
  specialite: string;
}

export function mapDocteursApi(reponse: unknown): DocteurApi[] {
  const donnees = estObjet(reponse) && estTableau(reponse['data']) ? reponse['data'] : reponse;
  if (!estTableau(donnees)) return [];
  const docteurs: DocteurApi[] = [];
  for (const brut of donnees) {
    if (!estObjet(brut)) continue;
    const id = lireNombre(brut['id']);
    if (id === null) continue;
    // Affichage lisible : prénom + postnom (login `username` en secours).
    const nomCompose = `${lireChaine(brut['prenom'])} ${lireChaine(brut['postnom'])}`.trim();
    docteurs.push({
      id,
      nom: nomCompose !== '' ? nomCompose : lireChaine(brut['username']) || `Docteur ${id}`,
      specialite: lireChaine(brut['nom_specialite']),
    });
  }
  return docteurs;
}

export async function getDocteursApi(): Promise<DocteurApi[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/docteur`);
  return mapDocteursApi(reponse.data);
}

// ------------------------------------------------------------
// Médicaments (GET /api/pharma — stock temps réel)
// ------------------------------------------------------------

/**
 * Seuil d'alerte « stock bas » par défaut : la table `medicament` n'a
 * PAS de colonne `seuil` (gap documenté §Gaps) — la valeur est
 * paramétrable côté établissement (phase 5).
 */
export const SEUIL_STOCK_DEFAUT = 10;

/**
 * Ligne `medicament` MySQL -> Medicament RDC.
 *  - id : numérique (string) → directement réutilisable comme
 *    `medicamentId` de POST /api/ordonnance ;
 *  - classe : la table n'a pas de colonne `classe_therepeutique` (gap)
 *    → la description sert de libellé, sinon '—' (l'alternative
 *    thérapeutique par classe reste opérationnelle sur le stock LOCAL ;
 *    pour le stock serveur elle retombe sur le choix manuel du soignant) ;
 *  - prix : colonne `montant` (USD).
 */
export function mapMedicamentApi(brut: Record<string, unknown>): Medicament {
  return {
    id: lireChaine(brut['id']),
    nom: lireChaine(brut['nomMedicament']) || 'Médicament sans nom',
    classe: lireChaine(brut['description']) || '—',
    forme: '—',
    prixUsd: lireNombre(brut['montant']) ?? 0,
    stock: lireNombre(brut['stock']) ?? 0,
    seuil: SEUIL_STOCK_DEFAUT,
    source: 'api',
  };
}

export function mapMedicamentsApi(reponse: unknown): Medicament[] {
  if (!estTableau(reponse)) return [];
  const medicaments: Medicament[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const med = mapMedicamentApi(brut);
    if (med.id !== '') medicaments.push(med);
  }
  return medicaments;
}

export async function getMedicamentsApi(): Promise<Medicament[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/pharma`);
  return mapMedicamentsApi(reponse.data);
}

// ------------------------------------------------------------
// Payloads backend (colonnes exactes des contrôleurs)
// ------------------------------------------------------------

export function construirePayloadConsultation(entree: {
  patientIdServeur: number;
  personnelId: number;
  idTypeConsultation: number;
  dateConsultation: string;
  diagnostic: string;
  notes: string;
}): Record<string, unknown> {
  return {
    patientId: entree.patientIdServeur,
    personnelId: entree.personnelId,
    id_typeConsultation: entree.idTypeConsultation,
    dateConsultation: entree.dateConsultation,
    diagnostic: entree.diagnostic,
    notes: entree.notes,
  };
}

/** Une ordonnance = UNE ligne POST par médicament (table ordonnance). */
export function construirePayloadLigneOrdonnance(entree: {
  consultationId: number;
  medicamentId: number;
  quantite: number;
  dateOrdre: string;
}): Record<string, unknown> {
  return {
    consultationId: entree.consultationId,
    medicamentId: entree.medicamentId,
    quantite: entree.quantite,
    dateOrdre: entree.dateOrdre,
  };
}

/**
 * Ligne de traitement (dose/frequence/duree) — OBLIGATOIRE : la
 * requête GET /api/ordonnance/one fait un INNER JOIN traitement ; sans
 * ligne de traitement, le détail d'une ordonnance renvoie une liste
 * vide à la pharmacie.
 */
export function construirePayloadTraitement(entree: {
  consultationId: number;
  medicamentId: number;
  posologie: string;
  dureeJours: number;
}): Record<string, unknown> {
  return {
    consultationId: entree.consultationId,
    medicament: entree.medicamentId,
    dose: entree.posologie,
    frequence: '',
    duree: String(entree.dureeJours),
    instructions: '',
  };
}

// ------------------------------------------------------------
// Lecture défensive des ids créés (backend B1)
// ------------------------------------------------------------

/**
 * Extrait le premier id exploitable de la réponse d'un POST (backend
 * B1 : `id_consultation` / `id_ordonnance` / `id_traitement` /
 * `id_patient` / `id_paiement` / `id_facture`). Null si absent (serveur
 * antérieur à B1) — la réconciliation de secours prend le relais.
 */
export function lireIdCree(reponse: unknown, cles: string[]): number | null {
  if (!estObjet(reponse)) return null;
  for (const cle of cles) {
    const n = lireNombre(reponse[cle]);
    if (n !== null && n > 0) return n;
  }
  return null;
}

// ------------------------------------------------------------
// Réconciliations de secours (serveur antérieur à B1 / ordre perdu)
// ------------------------------------------------------------

/** id_typeConsultation par nom normalisé (sans accents/casse). */
export async function reconcilierIdTypeConsultation(nomType: string): Promise<number | null> {
  const cible = normaliser(nomType);
  if (cible === '') return null;
  try {
    // Client axios GLOBAL (durci par installerResilienceGlobale) —
    // même convention que les réconciliations de facturationApi.
    const reponse = await axios.get(`${DOMAINE}/api/consult/consult_type`);
    const types = mapTypesConsultationApi(reponse.data);
    const trouve = types.find((t) => normaliser(t.nom) === cible);
    return trouve ? trouve.id : null;
  } catch {
    return null;
  }
}

/**
 * id_consultation par correspondance (patient + date + diagnostic) —
 * utilisé UNIQUEMENT si le POST a réussi sans renvoyer d'id : on ne
 * relance JAMAIS le POST (doublon de consultation) ; on interroge la
 * liste et on prend la consultation la plus récente correspondante.
 */
export async function reconcilierIdConsultation(entree: {
  patientIdServeur: number;
  date: string;
  diagnostic: string;
}): Promise<number | null> {
  try {
    const reponse = await axios.get(`${DOMAINE}/api/consult`);
    if (!estTableau(reponse.data)) return null;
    const dateCible = entree.date.slice(0, 10);
    const diagnosticCible = normaliser(entree.diagnostic);
    let meilleur: { id: number; date: string } | null = null;
    for (const brut of reponse.data) {
      if (!estObjet(brut)) continue;
      if (lireNombre(brut['patientId']) !== entree.patientIdServeur) continue;
      const dateLigne = lireChaine(brut['dateConsultation']).slice(0, 10);
      if (dateCible !== '' && dateLigne !== dateCible) continue;
      if (diagnosticCible !== '' && normaliser(lireChaine(brut['diagnostic'])) !== diagnosticCible) continue;
      const id = lireNombre(brut['id']);
      if (id === null) continue;
      if (meilleur === null || dateLigne >= meilleur.date) meilleur = { id, date: dateLigne };
    }
    return meilleur ? meilleur.id : null;
  } catch {
    return null;
  }
}

/**
 * id_medicament par nom normalisé (stock serveur) — pour une ligne
 * prescrite hors ligne quand l'id numérique n'était pas disponible.
 */
export async function reconcilierIdMedicamentParNom(nom: string): Promise<number | null> {
  const cible = normaliser(nom);
  if (cible === '') return null;
  try {
    const reponse = await axios.get(`${DOMAINE}/api/pharma`);
    if (!estTableau(reponse.data)) return null;
    for (const brut of reponse.data) {
      if (!estObjet(brut)) continue;
      if (normaliser(lireChaine(brut['nomMedicament'])) === cible) {
        const id = lireNombre(brut['id']);
        if (id !== null) return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
