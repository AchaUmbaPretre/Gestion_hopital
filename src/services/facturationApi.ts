/**
 * BRANCHEMENT API FACTURATION RÉELLE (phase 3 — plan de migration RDC v2).
 *
 * api_hopital est GELÉ : ce service adapte les endpoints existants au
 * modèle RDC sans toucher au backend :
 *
 *   POST /api/factures   → facture + détails (le contrôleur destructurise
 *                          `patient_id, date_emission, date_limite,
 *                          montant_total, status` ; le MODÈLE lit
 *                          `req.body.service_details` — snake_case, piège
 *                          vérifié dans factures.model.js) ;
 *   POST /api/paiement   → encaissement (`id_facture, amount,
 *                          date_paiement, methode_paiement, transaction_id`) ;
 *   GET  /api/factures   → liste (JOIN patient.nom_patient) ;
 *   GET  /api/paiement   → liste des encaissements.
 *
 * ⚠️ POST /api/factures NE RENVOIE PAS l'id créé (seulement un message).
 * Les acomptes (plusieurs paiements sur une même facture) exigent pourtant
 * cet id : d'où la RÉCONCILIATION (voir reconcilierIdFacture) —
 * correspondance patient_id + montant_total + date d'émission, à deux
 * niveaux : cache local (IndexedDB meta) puis recherche live. La liste
 * étant petite à l'échelle d'un HGR, un GET /api/factures par cycle de
 * sync est négligeable.
 *
 * Les montants voyagent en USD (devise de référence des tarifs
 * hospitaliers) ; l'encaissement FC est converti au taux TRACÉ dans le
 * payload (audit bidevise, brief RDC 1.3).
 *
 * TypeScript strict, zéro `any` : helpers défensifs partagés
 * (services/apiHelpers.ts — un champ manquant devient '', 0 ou null,
 * jamais un crash).
 */

import axios from 'axios';
import config from '../config';
import type { ModePaiement, ModeRecouvrement, Patient } from '../pages/rdc/data/types';
import { estObjet, estTableau, lireChaine, lireNombre } from './apiHelpers';

const DOMAINE: string = config.REACT_APP_SERVER_DOMAIN ?? '';

// ------------------------------------------------------------
// Lecture défensive : factures
// ------------------------------------------------------------

/** Une facture telle que renvoyée par GET /api/factures. */
export interface FactureApi {
  idFacture: number;
  patientId: number | null;
  nomPatient: string;
  dateEmission: string; // YYYY-MM-DD (tronqué)
  dateLimite: string;
  montantTotal: number | null;
  status: string;
}

export function mapFactureApi(brut: Record<string, unknown>): FactureApi | null {
  const id = lireNombre(brut['id_facture']);
  if (id === null) return null; // ligne inutilisable sans identifiant
  return {
    idFacture: id,
    patientId: lireNombre(brut['patient_id']),
    nomPatient: lireChaine(brut['nom_patient']),
    dateEmission: lireChaine(brut['date_emission']).slice(0, 10),
    dateLimite: lireChaine(brut['date_limite']).slice(0, 10),
    montantTotal: lireNombre(brut['montant_total']),
    status: lireChaine(brut['status']),
  };
}

/** Liste brute MySQL -> FactureApi[] (lignes mal formées ignorées). */
export function mapFacturesApi(reponse: unknown): FactureApi[] {
  if (!estTableau(reponse)) return [];
  const factures: FactureApi[] = [];
  for (const brut of reponse) {
    if (!estObjet(brut)) continue;
    const f = mapFactureApi(brut);
    if (f !== null) factures.push(f);
  }
  return factures;
}

/** GET /api/factures — liste complète (filtrage par patient côté client). */
export async function getFacturesApi(): Promise<FactureApi[]> {
  const reponse = await axios.get(`${DOMAINE}/api/factures`);
  return mapFacturesApi(reponse.data);
}

// ------------------------------------------------------------
// Lecture défensive : paiements
// ------------------------------------------------------------

/** Un encaissement tel que renvoyé par GET /api/paiement. */
export interface PaiementApi {
  idPaiement: number | null;
  idFacture: number | null;
  amount: number | null;
  datePaiement: string;
  methodePaiement: string;
  transactionId: string;
}

export function mapPaiementApi(brut: Record<string, unknown>): PaiementApi {
  return {
    idPaiement: lireNombre(brut['id_paiement']),
    idFacture: lireNombre(brut['id_facture']),
    amount: lireNombre(brut['amount']),
    datePaiement: lireChaine(brut['date_paiement']),
    methodePaiement: lireChaine(brut['methode_paiement']),
    transactionId: lireChaine(brut['transaction_id']),
  };
}

export function mapPaiementsApi(reponse: unknown): PaiementApi[] {
  if (!estTableau(reponse)) return [];
  const paiements: PaiementApi[] = [];
  for (const brut of reponse) {
    if (estObjet(brut)) paiements.push(mapPaiementApi(brut));
  }
  return paiements;
}

/** GET /api/paiement — tous les encaissements. */
export async function getPaiementsApi(): Promise<PaiementApi[]> {
  const reponse = await axios.get(`${DOMAINE}/api/paiement`);
  return mapPaiementsApi(reponse.data);
}

/** Somme encaissée par facture (fiche 360° : « Payé X sur Y »). */
export function sommePaiementsParFacture(
  paiements: PaiementApi[],
): Map<number, { somme: number; nombre: number }> {
  const totaux = new Map<number, { somme: number; nombre: number }>();
  for (const p of paiements) {
    if (p.idFacture === null || p.amount === null) continue;
    const actuel = totaux.get(p.idFacture) ?? { somme: 0, nombre: 0 };
    totaux.set(p.idFacture, { somme: actuel.somme + p.amount, nombre: actuel.nombre + 1 });
  }
  return totaux;
}

// ------------------------------------------------------------
// Construction des payloads (mise en file outbox, côté store)
// ------------------------------------------------------------

export interface LigneFacturable {
  acteId: string;
  libelle: string;
  montantUsd: number;
  /** Catégorie HGR -> service_type backend ('Consultation' reconnu, le reste tracé tel quel). */
  categorie: string;
}

export interface IdentitePatient {
  nom: string;
  prenom: string;
  telephone: string;
}

export interface EntreeFacture {
  mouvement: {
    reference: string;
    dateIso: string;
    totalUsd: number;
    partMutuelleUsd: number;
    ticketModerateurUsd: number;
    mode: ModeRecouvrement;
    soldeUsd: number;
    tauxFcUsd: number;
    mutuelle?: { organisme: string; couverturePct: number; numeroAdherent: string };
    motifExoneration?: string;
    autorisePar?: string;
  };
  patient?: Patient;
  /** Id numérique MySQL si le patient vient de l'API, sinon null (résolu à l'envoi). */
  patientIdServeur: number | null;
  lignes: LigneFacturable[];
}

/**
 * Statut facture selon le mode de recouvrement RDC (conventions de
 * l'écran hérité FactureDetail.jsx qui compare à 'En attente').
 */
export function statutFacture(mode: ModeRecouvrement, soldeUsd: number): string {
  if (mode === 'exonere') return 'Exonérée';
  if (mode === 'urgence_vitale') return 'En attente';
  return soldeUsd <= 0 ? 'Payée' : 'Partielle';
}

/**
 * Échéance : le jour même si rien n'est dû (payée / exonérée),
 * sinon +15 jours (acompte, urgence vitale à régulariser).
 */
export function dateLimiteFacture(dateEmission: string, soldeUsd: number): string {
  const d = new Date(dateEmission);
  if (Number.isNaN(d.getTime())) return dateEmission;
  if (soldeUsd <= 0) return dateEmission.slice(0, 10);
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/factures — payload exact attendu par le contrôleur + MODÈLE
 * (`service_details` en snake_case, tableau de {service_type, service_id,
 * montant}).
 *
 * service_id = 0 : la caisse facture des ACTES tarifés, pas des
 * enregistrements de services (il n'existe ni consultation ni médicament
 * correspondant côté serveur à ce stade). Le formulaire hérité
 * FormFactures.jsx soumet lui aussi des service_id vides → la colonne
 * accepte ce cas ; GET /api/factures/one affichera « Unknown Service »
 * pour ces lignes, le montant reste intact. Gap documenté (§16.5).
 *
 * Les extras RDC (facture_locale, mutuelle, exonération, urgence vitale,
 * taux) voyagent dans le payload : ignorés par le backend actuel, ils
 * constituent la trace d'audit prête pour le jour où les colonnes
 * existeront (zéro perte d'information).
 */
export function construirePayloadFacture(entree: EntreeFacture): Record<string, unknown> {
  const m = entree.mouvement;
  const dateEmission = m.dateIso.slice(0, 10);
  return {
    // --- colonnes destructurées par postControllerFactures ---
    patient_id: entree.patientIdServeur,
    date_emission: dateEmission,
    date_limite: dateLimiteFacture(dateEmission, m.soldeUsd),
    montant_total: m.totalUsd,
    status: statutFacture(m.mode, m.soldeUsd),
    // --- lu par insertFactureDetails (factures.model.js) ---
    service_details: entree.lignes.map((l) => ({
      service_type: l.categorie,
      service_id: 0,
      montant: l.montantUsd,
    })),
    // --- extras RDC (audit / gaps backend documentés) ---
    facture_locale: m.reference,
    dossier_patient: entree.patient?.id ?? '',
    patient_identite: {
      nom: entree.patient?.nom ?? '',
      prenom: entree.patient?.prenom ?? '',
      telephone: entree.patient?.telephone ?? '',
    },
    part_mutuelle: m.partMutuelleUsd,
    ticket_moderateur: m.ticketModerateurUsd,
    mode: m.mode,
    motif_exoneration: m.motifExoneration ?? null,
    autorise_par: m.autorisePar ?? null,
    mutuelle: m.mutuelle ?? null,
    taux_fc_usd: m.tauxFcUsd,
    source: 'rdc_front_v2',
  };
}

export interface EntreePaiement {
  /** Montant encaissé maintenant (USD). */
  montantPayeUsd: number;
  datePaiementIso: string;
  modePaiement: ModePaiement;
  /** Référence locale de la facture CONCERNÉE (REC-…, pas le reçu d'acompte). */
  factureLocale: string;
  patient?: Patient;
  patientIdServeur: number | null;
  /** Critères de réconciliation de la facture (si le cache ne la connaît pas). */
  montantFactureUsd: number;
  dateEmissionFacture: string;
  tauxFcUsd: number;
}

/**
 * POST /api/paiement — payload exact attendu par le contrôleur.
 * id_facture = null à la mise en file : il est RÉSOLU au moment du rejeu
 * (cache de réconciliation ou correspondance live) — voir envoiMetier.
 * transaction_id porte la référence du reçu local : trace croisée
 * reçu imprimé ↔ ligne serveur, en attendant une colonne dédiée.
 */
export function construirePayloadPaiement(entree: EntreePaiement): Record<string, unknown> {
  return {
    // --- colonnes destructurées par postControllerPaiement ---
    id_facture: null,
    amount: entree.montantPayeUsd,
    date_paiement: entree.datePaiementIso,
    methode_paiement: entree.modePaiement,
    transaction_id: entree.factureLocale,
    // --- extras RDC (réconciliation + audit) ---
    facture_locale: entree.factureLocale,
    patient_id: entree.patientIdServeur,
    patient_identite: {
      nom: entree.patient?.nom ?? '',
      prenom: entree.patient?.prenom ?? '',
      telephone: entree.patient?.telephone ?? '',
    },
    montant_facture: entree.montantFactureUsd,
    date_emission_facture: entree.dateEmissionFacture,
    taux_fc_usd: entree.tauxFcUsd,
    source: 'rdc_front_v2',
  };
}

// ------------------------------------------------------------
// Réconciliation (POST /factures ne renvoie pas d'id)
// ------------------------------------------------------------

export interface CriteresReconciliation {
  patientIdServeur: number;
  montantTotal: number;
  /** YYYY-MM-DD — la date serveur peut porter l'heure : comparaison par préfixe. */
  dateEmission: string;
  /** Ids déjà attribués à des factures locales (évite le double appariement). */
  idsDejaMappees: ReadonlySet<number>;
}

/**
 * Choisit la facture serveur correspondant à une création locale :
 * même patient, même montant (±0,01 USD), même date d'émission, et pas
 * déjà appariée. En cas de doute (deux factures identiques le même
 * jour), la PLUS RÉCENTE non appariée gagne — la création vient
 * d'avoir eu lieu. Ambiguïté résiduelle documentée (§16.5).
 */
export function choisirFactureCorrespondante(
  factures: FactureApi[],
  criteres: CriteresReconciliation,
): number | null {
  let candidates: FactureApi[] = factures.filter(
    (f) =>
      f.patientId === criteres.patientIdServeur &&
      f.montantTotal !== null &&
      Math.abs(f.montantTotal - criteres.montantTotal) < 0.01 &&
      (criteres.dateEmission === '' || f.dateEmission === criteres.dateEmission) &&
      !criteres.idsDejaMappees.has(f.idFacture),
  );
  if (candidates.length === 0) return null;
  candidates = candidates.sort((a, b) => b.idFacture - a.idFacture);
  return candidates[0]?.idFacture ?? null;
}

/** Réconciliation live : GET /api/factures puis correspondance. */
export async function reconcilierIdFacture(
  criteres: CriteresReconciliation,
): Promise<number | null> {
  try {
    const factures = await getFacturesApi();
    return choisirFactureCorrespondante(factures, criteres);
  } catch {
    return null; // réseau indisponible : les paiements attendront le prochain cycle
  }
}

// Normalisation identité — copie locale de `normaliser` (rdcStore) pour
// ÉVITER UN CYCLE d'imports store ↔ service (le store importe les
// builders de ce module). Comportement identique : casse + accents ignorés.
function sansAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleIdentiteApi(identite: IdentitePatient): string {
  const chiffres = identite.telephone.replace(/[^0-9]/g, '');
  const tel = chiffres.length >= 6 ? chiffres.slice(-9) : '';
  return `${sansAccents(identite.nom)}|${sansAccents(identite.prenom)}|${tel}`;
}

/**
 * Résout l'id MySQL d'un patient créé LOCALEMENT (dossier
 * INIT-ANNÉE-N°) : la création patient est passée par l'outbox avant la
 * facture (ordre FIFO) → le patient existe côté serveur au moment où la
 * facture est rejouée. Correspondance par identité (nom + prénom
 * normalisés + téléphone), même clé que la fusion d'écran Patients.
 */
export async function reconcilierIdPatientServeur(
  identite: IdentitePatient,
): Promise<number | null> {
  const cible = cleIdentiteApi(identite);
  if (cible === '||') return null;
  try {
    const reponse = await axios.get(`${DOMAINE}/api/patient`);
    if (!estTableau(reponse.data)) return null;
    for (const brut of reponse.data) {
      if (!estObjet(brut)) continue;
      const candidat: IdentitePatient = {
        nom: lireChaine(brut['nom_patient']),
        prenom: lireChaine(brut['prenom']),
        telephone: lireChaine(brut['tel']),
      };
      if (cleIdentiteApi(candidat) === cible) {
        const id = lireNombre(brut['id_patient']);
        if (id !== null) return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
