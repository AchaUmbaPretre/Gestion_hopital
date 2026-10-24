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
  Medicament, MouvementCaisse, Ordonnance, Patient, RdcState, Triage, LigneOrdonnance,
} from './types';
import { seedRdcState } from './seed';

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

// ------------------------------------------------------------
// Normalisation recherche : insensible à la casse ET aux accents
// (Kabila/KABILA/Kabïla) — crucial pour la recherche "instantanée"
// par un personnel qui tape sans accents.
// ------------------------------------------------------------
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

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

/** Création rapide : Nom + Prénom + Sexe + Âge estimé suffisent. */
export function addPatient(input: NouveauPatient): Patient {
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
    creeLe: new Date().toISOString(),
  };
  setState({ patients: [patient, ...state.patients], compteurDossier: compteur });
  return patient;
}

export function updatePatient(id: string, patch: Partial<Omit<Patient, 'id'>>): void {
  setState({
    patients: state.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function addOrdonnance(o: Omit<Ordonnance, 'id'>): Ordonnance {
  const ordonnance: Ordonnance = {
    ...o,
    id: `ORD-${new Date().getFullYear()}-${String(state.ordonnances.length + 1).padStart(4, '0')}`,
  };
  setState({ ordonnances: [ordonnance, ...state.ordonnances] });
  return ordonnance;
}

export function addTriage(t: Omit<Triage, 'id'>): Triage {
  const triage: Triage = {
    ...t,
    id: `TRI-${new Date().getFullYear()}-${String(state.triages.length + 1).padStart(4, '0')}`,
  };
  setState({ triages: [triage, ...state.triages] });
  return triage;
}

export function registerMouvement(m: Omit<MouvementCaisse, 'id' | 'reference'>): MouvementCaisse {
  const reference = `REC-${new Date().getFullYear()}-${String(state.compteurRecu + 1).padStart(4, '0')}`;
  const mouvement: MouvementCaisse = { ...m, id: `MVT-${reference}`, reference };
  setState({
    mouvements: [mouvement, ...state.mouvements],
    compteurRecu: state.compteurRecu + 1,
  });
  return mouvement;
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
  return { ok: true, ruptures: [] };
}

/** Réinitialisation (démo / formation). */
export function resetRdcState(): void {
  state = seedRdcState();
  persist();
  listeners.forEach((l) => l());
}
