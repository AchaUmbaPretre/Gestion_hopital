/**
 * BRANCHEMENT API PATIENTS RÉEL (phase 2 — plan de migration RDC v2).
 *
 * api_hopital est GELÉ : ce service adapte les endpoints existants au
 * modèle RDC sans toucher au backend :
 *
 *   GET  /api/patient         → liste complète (pas de param de recherche
 *                               serveur : le filtrage reste local, sans
 *                               accents — gap « param q » documenté) ;
 *   GET  /api/patient/type    → types de patient (FK typePatient) ;
 *   GET  /api/factures        → historique factures (patient_id) ;
 *   GET  /api/consult         → historique consultations (patientId) ;
 *   POST /api/patient         → création (payload mappé sur les colonnes
 *                               MySQL réelles, extras RDC pour l'audit).
 *
 * Toutes les lectures passent par une instance axios DURCIE (timeout
 * 8 s, retry ×3 backoff — services/resilience.ts) ; les mutations
 * n'empruntent PAS ce service : elles passent par l'outbox offline
 * (offline/outbox.ts) pour un rejeu sûr avec clé d'idempotence.
 *
 * TypeScript strict, zéro `any` : les réponses MySQL sont lues par des
 * helpers défensifs (un champ manquant devient '', 0 ou undefined —
 * jamais un crash dans un écran de soin).
 */

import axios from 'axios';
import config from '../config';
import { attachResilience } from './resilience';
import type { Patient, Sexe } from '../pages/rdc/data/types';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

/** Instance privée durcie : mêmes règles que le client global. */
const clientApi = attachResilience(axios.create(), { timeoutMs: 8_000, retries: 3 });

// ------------------------------------------------------------
// Lecture défensive des réponses MySQL (zéro `any`)
// ------------------------------------------------------------

export function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function estTableau(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Chaîne trimmed ; nombres et dates acceptés ; sinon ''. */
export function lireChaine(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** Nombre fini (string numérique acceptée) ; sinon null. */
export function lireNombre(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * Première date valide parmi les noms de colonnes habituels de
 * api_hopital (les tables n'ont pas de convention homogène).
 */
const CHAMPS_DATE_CANDIDATS = [
  'date',
  'dateConsultation',
  'date_emission',
  'dateCreation',
  'createdAt',
  'created_at',
] as const;

export function lireDateIso(brut: Record<string, unknown>): string {
  for (const cle of CHAMPS_DATE_CANDIDATS) {
    const v = brut[cle];
    if (typeof v === 'string' && v.trim() !== '') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return '';
}

// ------------------------------------------------------------
// Mapping patient API -> modèle RDC (types.ts)
// ------------------------------------------------------------

/**
 * Âge en années depuis une date de naissance « YYYY-MM-DD ».
 * Null si la date est absente, future ou absurde (> 130 ans) —
 * l'UI retombe alors sur l'âge estimé saisi à l'accueil.
 */
export function ageDepuisDateNaissance(
  dateNaissance: string,
  aujourdhui: Date = new Date(),
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) return null;
  const morceaux = dateNaissance.split('-');
  const annee = Number(morceaux[0]);
  const mois = Number(morceaux[1]);
  const jour = Number(morceaux[2]);
  if (!Number.isFinite(annee) || !Number.isFinite(mois) || !Number.isFinite(jour)) return null;
  const ddn = new Date(annee, mois - 1, jour);
  if (ddn.getTime() > aujourdhui.getTime()) return null;
  let age = aujourdhui.getFullYear() - annee;
  const anniversairePasse =
    aujourdhui.getMonth() > ddn.getMonth() ||
    (aujourdhui.getMonth() === ddn.getMonth() && aujourdhui.getDate() >= ddn.getDate());
  if (!anniversairePasse) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/**
 * Patient API -> Patient RDC.
 *  - id : l'id numérique MySQL (string) — le dossier « INIT-ANNÉE-N° »
 *    n'existe pas côté backend (gap documenté) ;
 *  - sexe : le backend accepte 'M'/'F'/'Autres' → normalisé M/F (défaut M) ;
 *  - mutuelle / exonéré / référé : pas de slot backend (gaps §12) →
 *    valeurs neutres, saisies localement dans l'écran Patients.
 */
export function mapPatientApi(brut: Record<string, unknown>, index: number): Patient {
  const dob = lireChaine(brut['dateNaissance']).slice(0, 10);
  const age = ageDepuisDateNaissance(dob) ?? 0;
  const sexeBrut = lireChaine(brut['sexe']);
  const sexe: Sexe = sexeBrut === 'F' ? 'F' : 'M';
  const id = lireChaine(brut['id_patient']);
  return {
    id: id !== '' ? id : `API-${index + 1}`,
    nom: lireChaine(brut['nom_patient']),
    prenom: lireChaine(brut['prenom']),
    sexe,
    ageEstime: age,
    telephone: lireChaine(brut['tel']),
    adresse: lireChaine(brut['adresse']) || undefined,
    exonere: false,
    refere: false,
    source: 'api',
    creeLe: '', // l'API n'expose pas de date de création
  };
}

/** Liste brute MySQL -> Patient[] (lignes mal formées ignorées). */
export function mapPatientsApi(reponse: unknown): Patient[] {
  if (!estTableau(reponse)) return [];
  const patients: Patient[] = [];
  reponse.forEach((brut, index) => {
    if (estObjet(brut)) patients.push(mapPatientApi(brut, index));
  });
  return patients;
}

/** GET /api/patient — liste complète (filtrage local côté écran). */
export async function getPatientsApi(): Promise<Patient[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/patient`);
  return mapPatientsApi(reponse.data);
}

// ------------------------------------------------------------
// Types de patient (GET /api/patient/type) — FK du POST
// ------------------------------------------------------------

export interface TypePatientApi {
  id: number;
  nom: string;
}

export function mapTypesPatientApi(reponse: unknown): TypePatientApi[] {
  if (!estTableau(reponse)) return [];
  const types: TypePatientApi[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const id = lireNombre(brut['id_typePatient']);
    const nom = lireChaine(brut['nom_typePatient']);
    if (id !== null && nom !== '') types.push({ id, nom });
  }
  return types;
}

export async function getTypesPatientApi(): Promise<TypePatientApi[]> {
  const reponse = await clientApi.get(`${DOMAINE}/api/patient/type`);
  return mapTypesPatientApi(reponse.data);
}

// ------------------------------------------------------------
// Historique des passages (fiche 360° — phase 2, item 3)
// ------------------------------------------------------------

export type TypePassage =
  | 'consultation'
  | 'facture'
  | 'caisse_locale'
  | 'ordonnance_locale'
  | 'triage_locale';

/** Un passage du patient : consultation, facture (API) ou acte local du jour. */
export interface Passage {
  dateIso: string;
  type: TypePassage;
  libelle: string;
  detail?: string;
  montantUsd?: number;
  statut?: string;
}

/** Factures du patient (GET /api/factures — champ patient_id). */
export function mapPassagesFacturesApi(reponse: unknown, patientId: string): Passage[] {
  if (!estTableau(reponse)) return [];
  const passages: Passage[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    if (lireChaine(brut['patient_id']) !== patientId) continue;
    const montant = lireNombre(brut['montant_total']);
    passages.push({
      dateIso: lireDateIso(brut),
      type: 'facture',
      libelle: `Facture n° ${lireChaine(brut['id_facture']) || '—'}`,
      montantUsd: montant ?? undefined,
      statut: lireChaine(brut['status']) || undefined,
    });
  }
  return passages;
}

/** Consultations du patient (GET /api/consult — champ patientId). */
export function mapPassagesConsultationsApi(reponse: unknown, patientId: string): Passage[] {
  if (!estTableau(reponse)) return [];
  const passages: Passage[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    if (lireChaine(brut['patientId']) !== patientId) continue;
    const montant = lireNombre(brut['prixConsultation']);
    const docteur = lireChaine(brut['docteur']);
    const diagnostic = lireChaine(brut['diagnostic']);
    passages.push({
      dateIso: lireDateIso(brut),
      type: 'consultation',
      libelle: `Consultation ${lireChaine(brut['nomConsultation']) || '—'}`,
      detail: docteur !== '' ? `Dr ${docteur}` : diagnostic !== '' ? diagnostic : undefined,
      montantUsd: montant ?? undefined,
    });
  }
  return passages;
}

/**
 * Historique serveur du patient. `Promise.allSettled` : si les factures
 * échouent, les consultations restent affichées (et vice versa) — un
 * endpoint en panne ne prive pas le soignant de tout l'historique.
 */
export async function getHistoriqueApi(patientId: string): Promise<Passage[]> {
  const [factures, consultations] = await Promise.allSettled([
    clientApi.get(`${DOMAINE}/api/factures`),
    clientApi.get(`${DOMAINE}/api/consult`),
  ]);
  const passages: Passage[] = [];
  if (factures.status === 'fulfilled') {
    passages.push(...mapPassagesFacturesApi(factures.value.data, patientId));
  }
  if (consultations.status === 'fulfilled') {
    passages.push(...mapPassagesConsultationsApi(consultations.value.data, patientId));
  }
  return trierPassages(passages);
}

/** Tri chronologique décroissant (les passages vides de date à la fin). */
export function trierPassages(passages: Passage[]): Passage[] {
  return [...passages].sort((a, b) => (b.dateIso || '').localeCompare(a.dateIso || ''));
}

// ------------------------------------------------------------
// Création patient — payload mappé sur les colonnes MySQL réelles
// ------------------------------------------------------------

/** Entrée de création rapide (compatible NouveauPatient du store). */
export interface EntreeCreationPatient {
  nom: string;
  prenom: string;
  sexe: Sexe;
  ageEstime: number;
  telephone?: string;
  refere?: boolean;
}

/**
 * L'âge estimé est la seule donnée fiable en RDC (pas de DDN
 * documentée) : la colonne NOT NULL `dateNaissance` reçoit une date
 * APPROCHÉE (1er janvier de l'année de naissance déduite). L'âge
 * estimé reste la référence affichée — et voyagera dans les extras
 * d'audit (`age_estime`).
 */
export function dateNaissanceApprochee(ageEstime: number, aujourdhui: Date = new Date()): string {
  const age = Math.max(0, Math.min(130, Math.floor(ageEstime)));
  return `${aujourdhui.getFullYear() - age}-01-01`;
}

/**
 * POST /api/patient — le contrôleur destructurise 15 champs exacts.
 * Colonnes textuelles facultatives -> '' (satisfait les NOT NULL sans
 * inventer de donnée) ; `typePatient` (FK, requis par le formulaire
 * hérité) -> id du premier type exposé par l'API, sinon null.
 * Les extras RDC (dossier, âge estimé, statut référé) voyagent dans
 * le payload : ignorés par le backend actuel, ils constituent la
 * trace d'audit prête pour le jour où les colonnes existeront.
 */
export function construirePayloadCreationPatient(
  input: EntreeCreationPatient,
  dossier: string,
  idTypePatient: number | null,
): Record<string, unknown> {
  return {
    // --- colonnes destructurées par postControllerPatient ---
    nom_patient: input.nom.trim(),
    prenom: input.prenom.trim(),
    dateNaissance: dateNaissanceApprochee(input.ageEstime),
    lieuNaissance: '',
    sexe: input.sexe,
    province: '',
    adresse: '',
    tel: (input.telephone ?? '').trim(),
    email: '',
    societePatient: '',
    assurance: '',
    profession: '',
    typePatient: idTypePatient,
    groupeSanguin: '',
    img: null,
    // --- extras RDC (audit / gaps backend documentés) ---
    dossier,
    age_estime: input.ageEstime,
    refere: input.refere ?? false,
    source: 'rdc_front_v2',
  };
}
