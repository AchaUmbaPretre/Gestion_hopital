/**
 * Store RDC — état applicatif du prototype, PERSISTÉ en
 * localStorage (résilience : coupures d'électricité et réseau
 * instable — brief RDC 4.1). Pub/sub minimal + useSyncExternalStore.
 *
 * ⚠️ PROTOTYPE : remplace (temporairement) les appels api_hopital.
 * Les actions ci-dessous reflètent 1:1 les futures mutations API
 * (voir docs/RDC_BUSINESS_LOGIC.md §12) pour un branchement
 * React Query sans réécriture des écrans.
 */

import { useSyncExternalStore } from 'react';
import type {
  Medicament, ModePaiement, MouvementCaisse, Ordonnance, Patient, RdcState, Triage, LigneOrdonnance,
} from './types';
import { seedRdcState } from './seed';
import { enregistrerMutation } from '../../../offline/outbox';
import { noterPatientRecent } from '../../../offline/db';
import { normaliser } from '../../../services/apiHelpers';
import { construirePayloadCreationPatient } from '../../../services/patientsApi';
import {
  construirePayloadFacture,
  construirePayloadPaiement,
  type LigneFacturable,
} from '../../../services/facturationApi';

const STORAGE_KEY = 'rdc.store.v1';
const SCHEMA_VERSION = '1';

let state: RdcState = load() ?? seedRdcState();
const listeners = new Set<() => void>();

function load(): RdcState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version: string; state: RdcState };
    return parsed.version === SCHEMA_VERSION ? parsed.state : null;
  } catch {
    return null;
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, state }));
  } catch {
    // Quota / mode privé : l'état reste vivant en mémoire pour la session.
  }
}

function setState(patch: Partial<RdcState>): void {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): RdcState {
  return state;
}

/** Hook principal — re-rendu sur chaque mutation du store. */
export function useRdcState(): RdcState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Lecture directe de l'état (hors React — tests, envoi métier). */
export function lireEtatRdc(): RdcState {
  return getState();
}

// ------------------------------------------------------------
// Normalisation recherche : insensible à la casse ET aux accents
// (Kabila/KABILA/Kabïla) — source unique : services/apiHelpers.ts
// (partagée avec les réconciliations serveur, phase 4).
// ------------------------------------------------------------
export { normaliser };

/** Recherche patient : nom, prénom, téléphone, n° dossier (brief 3.2). */
export function searchPatients(patients: Patient[], query: string): Patient[] {
  const q = normaliser(query);
  if (q.length < 2) return [];
  const digits = q.replace(/[^0-9+]/g, '');
  return patients.filter((p) => {
    const texte = normaliser(`${p.nom} ${p.prenom} ${p.id}`);
    if (texte.includes(q)) return true;
    return digits.length >= 4 && normaliser(p.telephone).includes(digits);
  });
}

/** Initiales pour l'ID carnet : "Kabongo Ilunga" -> "KI". */
function initiales(nom: string, prenom: string): string {
  const a = (nom.trim()[0] ?? 'X').toUpperCase();
  const b = (prenom.trim()[0] ?? 'X').toUpperCase();
  return `${a}${b}`;
}

/** ID carnet lisible + imprimable : "KI-2026-0007". */
function genererDossier(nom: string, prenom: string, compteur: number): { id: string; compteur: number } {
  const annee = new Date().getFullYear();
  const numero = String(compteur + 1).padStart(4, '0');
  return { id: `${initiales(nom, prenom)}-${annee}-${numero}`, compteur: compteur + 1 };
}

// ------------------------------------------------------------
// ACTIONS
// ------------------------------------------------------------

export interface NouveauPatient {
  nom: string;
  prenom: string;
  sexe: Patient['sexe'];
  ageEstime: number;
  telephone?: string;
  refere?: boolean;
}

/**
 * Trace une mutation dans l'outbox offline (phase 1).
 *  - cible 'api'   : endpoint existant dans api_hopital → rejeu auto.
 *  - cible 'local' : gap backend documenté (doc RDC §12) → trace
 *    conservée en file + imprimée, jamais envoyée tant que le gap
 *    n'est pas comblé — zéro perte d'information.
 * Fire-and-forget : JAMAIS bloquant pour l'action métier (un triage
 * rouge s'enregistre même si IndexedDB est indisponible).
 */
function tracer(
  type: string,
  cible: 'api' | 'local',
  endpoint: string | null,
  payload: unknown,
  cleIdempotence?: string,
): void {
  void enregistrerMutation({ type, cible, endpoint, payload, cleIdempotence }).catch(() => undefined);
}

function noterRecent(patient: Patient): void {
  void noterPatientRecent({
    patientId: patient.id,
    nom: patient.nom,
    prenom: patient.prenom,
    consulteLe: new Date().toISOString(),
  }).catch(() => undefined);
}

/**
 * Création rapide : Nom + Prénom + Sexe + Âge estimé suffisent.
 * @param idTypePatientDefaut FK `typePatient` attendue par le POST
 *        /api/patient (requis par le schéma MySQL) — fournie par
 *        useTypesPatient (premier type exposé par l'API), null si
 *        l'API n'en expose pas (le rejeu échouera alors visiblement :
 *        statut « echec » du badge, trace conservée — zéro perte).
 */
export function addPatient(
  input: NouveauPatient,
  opts?: { idTypePatientDefaut?: number | null },
): Patient {
  const { id, compteur } = genererDossier(input.nom, input.prenom, state.compteurDossier);
  const patient: Patient = {
    id,
    nom: input.nom.trim(),
    prenom: input.prenom.trim(),
    sexe: input.sexe,
    ageEstime: input.ageEstime,
    telephone: (input.telephone ?? '').trim(),
    exonere: false,
    refere: input.refere ?? false,
    source: 'local',
    creeLe: new Date().toISOString(),
  };
  setState({ patients: [patient, ...state.patients], compteurDossier: compteur });
  // Outbox : POST /patients existe (createPatient) — rejeu auto au
  // retour réseau. Payload mappé sur les 15 colonnes MySQL réelles
  // (+ extras RDC d'audit : dossier, âge estimé, statut référé).
  tracer(
    'creer_patient',
    'api',
    '/api/patient',
    construirePayloadCreationPatient(input, id, opts?.idTypePatientDefaut ?? null),
    `creer_patient:${patient.creeLe}:${id}`,
  );
  noterRecent(patient);
  return patient;
}

export function updatePatient(id: string, patch: Partial<Omit<Patient, 'id'>>): void {
  setState({
    patients: state.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
  // Gap backend : pas d'endpoint de mise à jour patient → trace locale.
  tracer('maj_patient', 'local', null, { id, patch });
}

/**
 * Hydratation du stock depuis GET /api/pharma (phase 4) :
 *  - les médicaments serveur inconnus localement sont AJOUTÉS (leur id
 *    numérique est directement réutilisable pour POST /api/ordonnance) ;
 *  - un médicament DÉJÀ connu localement n'est PAS écrasé : le stock
 *    local porte les décréments de délivrance de la journée (hors
 *    ligne) — « local gagne », la divergence se corrige à la session
 *    suivante (voir fusionnerMedicaments, useConsultation.ts).
 * Fire-and-forget amical : l'action est appelée après une requête
 * réussie, les décréments locaux restent la source de vérité du jour.
 */
export function hydraterMedicamentsServeur(api: Medicament[]): void {
  const connus = new Set(state.medicaments.map((m) => m.id));
  const ajouts = api.filter((m) => !connus.has(m.id) && /^\d+$/.test(m.id));
  if (ajouts.length === 0) return;
  setState({ medicaments: [...state.medicaments, ...ajouts] });
}

export function addOrdonnance(o: Omit<Ordonnance, 'id'>): Ordonnance {
  const ordonnance: Ordonnance = {
    ...o,
    id: `ORD-${new Date().getFullYear()}-${String(state.ordonnances.length + 1).padStart(4, '0')}`,
  };
  setState({ ordonnances: [ordonnance, ...state.ordonnances] });
  // Outbox — phase 4 : payload STRUCTURÉ pour l'envoi métier. Un seul
  // type métier `creer_ordonnance` couvre la chaîne réelle :
  //   POST /api/consult → id_consultation
  //   puis PAR ligne : POST /api/ordonnance + POST /api/traitement
  // (l'INNER JOIN traitement de GET /api/ordonnance/one impose la
  // ligne de traitement ; sans elle, la pharmacie voit une ordonnance
  // vide). Le patient et l'id numérique du médicament sont résolus
  // ICI quand ils sont connus, au rejeu sinon (réconciliation par nom).
  const patientOrdo = state.patients.find((p) => p.id === ordonnance.patientId);
  const payload = {
    ordonnance_locale: ordonnance.id,
    date_ordre: ordonnance.dateIso.slice(0, 19).replace('T', ' '),
    patient_ref: ordonnance.patientId,
    patient_identite: patientOrdo
      ? { nom: patientOrdo.nom, prenom: patientOrdo.prenom, telephone: patientOrdo.telephone }
      : null,
    consultation: {
      patient_id: idPatientServeur(patientOrdo),
      personnel_id: ordonnance.personnelId ?? null,
      id_type_consultation: ordonnance.typeConsultationId ?? null,
      nom_type_consultation: ordonnance.typeConsultationNom ?? '',
      date_consultation: ordonnance.dateIso.slice(0, 19).replace('T', ' '),
      diagnostic: ordonnance.diagnostic ?? '',
      notes: ordonnance.notes ?? '',
    },
    lignes: ordonnance.lignes.map((l) => {
      const med = state.medicaments.find((m) => m.id === l.medicamentId);
      const idNum = med && /^\d+$/.test(med.id) ? Number(med.id) : null;
      return {
        medicament_id: idNum,
        nom_medicament: med?.nom ?? '',
        quantite: l.quantite,
        posologie: l.posologie,
        duree_jours: l.dureeJours,
      };
    }),
  };
  tracer('creer_ordonnance', 'api', '/api/consult', payload, `creer_ordonnance:${ordonnance.id}`);
  if (patientOrdo) noterRecent(patientOrdo);
  return ordonnance;
}

export function addTriage(t: Omit<Triage, 'id'>): Triage {
  const triage: Triage = {
    ...t,
    id: `TRI-${new Date().getFullYear()}-${String(state.triages.length + 1).padStart(4, '0')}`,
  };
  setState({ triages: [triage, ...state.triages] });
  // Gap backend (table triage) : trace locale — imprimée sur la fiche
  // urgence, jamais perdue. Rejeu dès que le backend expose l'endpoint.
  tracer('creer_triage', 'local', null, triage, `creer_triage:${triage.id}`);
  return triage;
}

export function registerMouvement(m: Omit<MouvementCaisse, 'id' | 'reference'>): MouvementCaisse {
  const reference = `REC-${new Date().getFullYear()}-${String(state.compteurRecu + 1).padStart(4, '0')}`;
  const mouvement: MouvementCaisse = { ...m, id: `MVT-${reference}`, reference };
  setState({
    mouvements: [mouvement, ...state.mouvements],
    compteurRecu: state.compteurRecu + 1,
  });
  // Outbox — phase 3 : payloads calibrés sur api_hopital RÉEL.
  //  - POST /api/factures : service_details (snake_case) + extras RDC
  //    (mutuelle, exonération, urgence vitale, taux) pour l'audit ;
  //    patient_id résolu au rejeu si le patient est local (réconciliation).
  //  - POST /api/paiement : SEULEMENT s'il y a eu un encaissement —
  //    exonération / urgence vitale ne créent pas de ligne de paiement
  //    (montant 0 = bruit), la facture porte le statut et le solde.
  const patientMvt = state.patients.find((p) => p.id === mouvement.patientId);
  const lignesFacturables: LigneFacturable[] = mouvement.lignes.map((l) => {
    const acte = state.actes.find((a) => a.id === l.acteId);
    return { acteId: l.acteId, libelle: l.libelle, montantUsd: l.montantUsd, categorie: acte?.categorie ?? 'Soins' };
  });
  tracer('creer_facture', 'api', '/api/factures', construirePayloadFacture({
    mouvement,
    patient: patientMvt,
    patientIdServeur: idPatientServeur(patientMvt),
    lignes: lignesFacturables,
  }), `creer_facture:${mouvement.id}`);
  if (mouvement.montantPayeUsd > 0) {
    tracer('creer_paiement', 'api', '/api/paiement', construirePayloadPaiement({
      montantPayeUsd: mouvement.montantPayeUsd,
      datePaiementIso: mouvement.dateIso,
      modePaiement: mouvement.modePaiement ?? 'especes_usd',
      factureLocale: mouvement.reference,
      patient: patientMvt,
      patientIdServeur: idPatientServeur(patientMvt),
      montantFactureUsd: mouvement.totalUsd,
      dateEmissionFacture: mouvement.dateIso.slice(0, 10),
      tauxFcUsd: mouvement.tauxFcUsd,
    }), `creer_paiement:${mouvement.id}`);
  }
  if (patientMvt) noterRecent(patientMvt);
  return mouvement;
}

/**
 * ACOMpte complémentaire sur une facture EXISTANTE (paiements multiples
 * — brief RDC 1.3 : « déposer un acompte, régler le solde à la sortie »).
 *
 *  - le solde de la facture d'origine diminue (trace mise à jour) ;
 *  - un NOUVEAU reçu d'acompte est émis (traçabilité caisse : un
 *    encaissement = un reçu imprimable) portant `factureRefOrigine` ;
 *  - l'outbox ne trace QUE le paiement (pas de seconde facture) avec
 *    `facture_locale` = référence de la facture d'origine → l'envoi
 *    résoudra le MÊME id serveur (cache de réconciliation).
 *
 * @returns le reçu d'acompte créé, null si la facture est inconnue ou
 *          le montant invalide / déjà soldé.
 */
export function ajouterAcompte(
  referenceFacture: string,
  montantUsd: number,
  modePaiement: ModePaiement,
): MouvementCaisse | null {
  const origine = state.mouvements.find((m) => m.reference === referenceFacture);
  if (!origine || origine.soldeUsd <= 0 || !(montantUsd > 0)) return null;
  const montant = Math.min(montantUsd, origine.soldeUsd);
  const arrondi = (v: number) => Math.round(v * 100) / 100;
  const soldeApres = Math.max(0, arrondi(origine.soldeUsd - montant));

  const reference = `REC-${new Date().getFullYear()}-${String(state.compteurRecu + 1).padStart(4, '0')}`;
  const recu: MouvementCaisse = {
    id: `MVT-${reference}`,
    patientId: origine.patientId,
    dateIso: new Date().toISOString(),
    lignes: [],
    totalUsd: 0,
    partMutuelleUsd: 0,
    ticketModerateurUsd: montant,
    mode: 'acompte',
    montantPayeUsd: arrondi(montant),
    soldeUsd: soldeApres,
    tauxFcUsd: origine.tauxFcUsd,
    mutuelle: origine.mutuelle,
    modePaiement,
    reference,
    factureRefOrigine: referenceFacture,
  };
  setState({
    mouvements: [
      recu,
      ...state.mouvements.map((m) =>
        m.reference === referenceFacture
          ? { ...m, montantPayeUsd: arrondi(m.montantPayeUsd + montant), soldeUsd: soldeApres }
          : m,
      ),
    ],
    compteurRecu: state.compteurRecu + 1,
  });

  const patientAcompte = state.patients.find((p) => p.id === recu.patientId);
  tracer('creer_paiement', 'api', '/api/paiement', construirePayloadPaiement({
    montantPayeUsd: recu.montantPayeUsd,
    datePaiementIso: recu.dateIso,
    modePaiement,
    factureLocale: referenceFacture,
    patient: patientAcompte,
    patientIdServeur: idPatientServeur(patientAcompte),
    montantFactureUsd: origine.totalUsd,
    dateEmissionFacture: origine.dateIso.slice(0, 10),
    tauxFcUsd: origine.tauxFcUsd,
  }), `creer_paiement:${recu.id}`);
  if (patientAcompte) noterRecent(patientAcompte);
  return recu;
}

/**
 * Id MySQL du patient s'il vient de l'API (id numérique), sinon null :
 * l'id serveur sera RÉSOLU au moment du rejeu par réconciliation
 * (offline/envoiMetier) — jamais un dossier local "KI-2026-0007" n'est
 * envoyé tel quel à une colonne MySQL INT.
 */
function idPatientServeur(patient: Patient | undefined): number | null {
  if (!patient || !/^\d+$/.test(patient.id)) return null;
  const n = Number(patient.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Statut de stock d'un médicament :
 *  - 'rupture'  : stock 0 (rouge)
 *  - 'bas'      : stock <= seuil (orange)
 *  - 'ok'       : au-dessus du seuil (vert)
 */
export type StatutStock = 'rupture' | 'bas' | 'ok';

export function statutStock(m: Medicament): StatutStock {
  if (m.stock <= 0) return 'rupture';
  if (m.stock <= m.seuil) return 'bas';
  return 'ok';
}

/**
 * Alternative thérapeutique en cas de rupture : même classe
 * thérapeutique, disponible, prix le plus proche (brief RDC 1.5).
 */
export function trouverAlternative(medicamentId: string): Medicament | null {
  const cible = state.medicaments.find((m) => m.id === medicamentId);
  if (!cible) return null;
  const candidats = state.medicaments.filter(
    (m) => m.id !== cible.id && m.classe === cible.classe && m.stock > 0,
  );
  let best = candidats[0];
  if (!best) return null;
  for (const m of candidats) {
    if (Math.abs(m.prixUsd - cible.prixUsd) < Math.abs(best.prixUsd - cible.prixUsd)) best = m;
  }
  return best;
}

export interface ResultatDelivrance {
  ok: boolean;
  /** Lignes bloquantes : médicament en rupture. */
  ruptures: Array<{ medicamentId: string; nom: string; alternative: Medicament | null }>;
}

/**
 * Délivrance d'une ordonnance : décrémente le stock et passe le
 * statut à "délivrée". Si une ligne est en rupture, NE RIEN
 * décrémenter et renvoyer les alternatives (brief RDC 3.5).
 */
export function delivrerOrdonnance(
  ordonnanceId: string,
  substitutions: Record<string, string> = {},
): ResultatDelivrance {
  const ordonnance = state.ordonnances.find((o) => o.id === ordonnanceId);
  if (!ordonnance) return { ok: false, ruptures: [] };

  const ruptures: ResultatDelivrance['ruptures'] = [];
  for (const ligne of ordonnance.lignes) {
    const medId = substitutions[ligne.medicamentId] ?? ligne.medicamentId;
    const med = state.medicaments.find((m) => m.id === medId);
    if (!med) {
      ruptures.push({ medicamentId: ligne.medicamentId, nom: 'introuvable', alternative: null });
      continue;
    }
    if (med.stock < ligne.quantite) {
      ruptures.push({ medicamentId: medId, nom: med.nom, alternative: trouverAlternative(medId) });
    }
  }
  if (ruptures.length > 0) return { ok: false, ruptures };

  const stocks = new Map(state.medicaments.map((m) => [m.id, m]));
  for (const ligne of ordonnance.lignes) {
    const medId = substitutions[ligne.medicamentId] ?? ligne.medicamentId;
    const med = stocks.get(medId);
    if (med) stocks.set(medId, { ...med, stock: med.stock - ligne.quantite });
  }

  setState({
    medicaments: state.medicaments.map((m) => stocks.get(m.id) ?? m),
    ordonnances: state.ordonnances.map((o) =>
      o.id === ordonnanceId
        ? {
            ...o,
            statut: 'delivree' as const,
            lignes: o.lignes.map((l) => ({ ...l, medicamentId: substitutions[l.medicamentId] ?? l.medicamentId })),
          }
        : o,
    ),
  });
  // Gap backend (décrément de stock) : trace locale + substitutions
  // appliquées (audit pharmacie).
  tracer('delivrer_ordonnance', 'local', null, { ordonnanceId, substitutions }, `delivrer_ordonnance:${ordonnanceId}`);
  return { ok: true, ruptures: [] };
}

/** Substitution d'une ligne d'ordonnance (alternative thérapeutique). */
export function substituerLigne(ordonnanceId: string, medicamentId: string, nouveauMedicamentId: string): void {
  const ordonnance = state.ordonnances.find((o) => o.id === ordonnanceId);
  if (!ordonnance) return;
  const lignes = ordonnance.lignes.map((l: LigneOrdonnance) =>
    l.medicamentId === medicamentId ? { ...l, medicamentId: nouveauMedicamentId } : l,
  );
  setState({
    ordonnances: state.ordonnances.map((o) => (o.id === ordonnanceId ? { ...o, lignes } : o)),
  });
}

/** Vente directe pharmacie (patient externe sans consultation). */
export function vendreDirecte(lignes: Array<{ medicamentId: string; quantite: number }>): ResultatDelivrance {
  const ruptures: ResultatDelivrance['ruptures'] = [];
  for (const l of lignes) {
    const med = state.medicaments.find((m) => m.id === l.medicamentId);
    if (!med || med.stock < l.quantite) {
      ruptures.push({ medicamentId: l.medicamentId, nom: med?.nom ?? '?', alternative: med ? trouverAlternative(med.id) : null });
    }
  }
  if (ruptures.length > 0) return { ok: false, ruptures };

  const stocks = new Map(state.medicaments.map((m) => [m.id, m]));
  for (const l of lignes) {
    const med = stocks.get(l.medicamentId);
    if (med) stocks.set(l.medicamentId, { ...med, stock: med.stock - l.quantite });
  }
  setState({ medicaments: state.medicaments.map((m) => stocks.get(m.id) ?? m) });
  // Gap backend (vente directe sans facture) : trace locale.
  tracer('vente_directe', 'local', null, lignes);
  return { ok: true, ruptures: [] };
}

/** Réinitialisation (démo / formation). */
export function resetRdcState(): void {
  state = seedRdcState();
  persist();
  listeners.forEach((l) => l());
}
