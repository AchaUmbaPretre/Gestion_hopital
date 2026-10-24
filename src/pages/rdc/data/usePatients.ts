/**
 * Hooks de données PATIENTS (phase 2 — branchement API réelle).
 *
 * Architecture offline-first inchangée (phase 1) :
 *  - le STORE LOCAL reste la source de vérité de la journée :
 *    instantané, fonctionne 100 % hors ligne, alimente l'outbox ;
 *  - la LISTE SERVEUR (GET /api/patient) arrive via React Query et
 *    est FUSIONNÉE avec le store — dédup par identité (nom + prénom
 *    normalisés sans accents + téléphone), le patient LOCAL gagne
 *    (il porte l'historique de la journée et le dossier imprimable) ;
 *  - l'indicateur serveur reste visible : le personnel sait toujours
 *    si la liste est complète (serveur) ou partielle (local seul).
 *
 * L'historique des passages (fiche 360°) fusionne lui aussi les
 * actes locaux du jour (caisse, ordonnances, triages — disponibles
 * même hors ligne) et l'historique serveur (consultations + factures).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getHistoriqueApi,
  getPatientsApi,
  getTypesPatientApi,
  trierPassages,
  type Passage,
  type TypePatientApi,
} from '../../../services/patientsApi';
import { normaliser, useRdcState } from './rdcStore';
import { libelleTriage, type Patient, type RdcState } from './types';

// ------------------------------------------------------------
// Fusion store local ∪ serveur (dédup par identité)
// ------------------------------------------------------------

/**
 * Clé d'identité d'un patient : nom + prénom normalisés (casse et
 * accents ignorés — Kabila / KABILA / Kabïla sont la même personne)
 * + derniers 9 chiffres du téléphone quand il est exploitable
 * (numérotation mobile RDC : 9 chiffres après l'indicatif 243).
 */
export function cleIdentite(p: Patient): string {
  const chiffres = normaliser(p.telephone).replace(/[^0-9]/g, '');
  const tel = chiffres.length >= 6 ? chiffres.slice(-9) : '';
  return `${normaliser(p.nom)}|${normaliser(p.prenom)}|${tel}`;
}

/**
 * Fusionne les patients du store local (source de la journée) et la
 * liste serveur. Le patient LOCAL gagne en cas de doublon : il porte
 * l'ID dossier imprimable, les ordonnances/caisses du jour, et ses
 * statuts mutuelle/exonération saisis localement.
 */
export function fusionnerPatients(locaux: Patient[], api: Patient[]): Patient[] {
  const vues = new Map<string, Patient>();
  for (const p of locaux) vues.set(cleIdentite(p), p);
  for (const p of api) {
    const cle = cleIdentite(p);
    if (!vues.has(cle)) vues.set(cle, p);
  }
  return Array.from(vues.values());
}

// ------------------------------------------------------------
// Passages LOCAUX (store de la journée — disponibles hors ligne)
// ------------------------------------------------------------

/** Actes du jour enregistrés localement pour ce patient. */
export function passagesDuStore(state: RdcState, patientId: string | null): Passage[] {
  if (!patientId) return [];
  const passages: Passage[] = [];
  for (const m of state.mouvements) {
    if (m.patientId !== patientId) continue;
    passages.push({
      dateIso: m.dateIso,
      type: 'caisse_locale',
      libelle: `Paiement caisse ${m.reference}`,
      detail: m.mode === 'urgence_vitale' ? 'Urgence vitale — paiement différé' : undefined,
      montantUsd: m.montantPayeUsd,
      statut:
        m.soldeUsd > 0
          ? `Solde dû : ${m.soldeUsd.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`
          : undefined,
    });
  }
  for (const o of state.ordonnances) {
    if (o.patientId !== patientId) continue;
    passages.push({
      dateIso: o.dateIso,
      type: 'ordonnance_locale',
      libelle: `Ordonnance ${o.id}`,
      statut: o.statut === 'delivree' ? 'Délivrée' : 'En attente pharmacie',
    });
  }
  for (const t of state.triages) {
    if (t.patientId !== patientId) continue;
    passages.push({
      dateIso: t.dateIso,
      type: 'triage_locale',
      libelle: `Triage ${libelleTriage(t.niveau)}`,
      detail: t.motif !== '' ? t.motif : undefined,
      statut: t.urgenceVitale ? 'Urgence vitale (paiement différé)' : undefined,
    });
  }
  return passages;
}

// ------------------------------------------------------------
// Hooks React Query
// ------------------------------------------------------------

export interface ListePatientsResultat {
  /** Fusion : patients locaux (journée) + serveur, dédupliqués. */
  patients: Patient[];
  /** Chargement initial (aucune donnée serveur encore disponible). */
  enChargement: boolean;
  /** Dernier fetch serveur réussi (la liste est potentiellement complète). */
  serveurDisponible: boolean;
  /** Fetch serveur en échec (réseau / API) — liste partielle locale. */
  erreurServeur: boolean;
  recharger: () => void;
}

/**
 * Liste de travail de l'écran Patients (et de la recherche) :
 *  - rendu instantané avec les patients locaux ;
 *  - la liste serveur fusionne dès qu'elle arrive (cache React Query
 *    staleTime 5 min + cache HTTP NetworkFirst du Service Worker) ;
 *  - retry false : axios a déjà re-joué ×3 en backoff (résilience) —
 *    doubler l'attente n'aiderait pas un poste hors réseau.
 */
export function useListePatients(): ListePatientsResultat {
  const state = useRdcState();
  const query = useQuery({
    queryKey: ['rdc', 'patients'],
    queryFn: getPatientsApi,
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });

  const apiPatients = useMemo(() => query.data ?? [], [query.data]);
  const patients = useMemo(
    () => fusionnerPatients(state.patients, apiPatients),
    [state.patients, apiPatients],
  );

  return {
    patients,
    enChargement: query.isPending && apiPatients.length === 0,
    serveurDisponible: query.isSuccess,
    erreurServeur: query.isError,
    recharger: () => {
      void query.refetch();
    },
  };
}

/**
 * Types de patient (FK du POST /api/patient). Le formulaire rapide
 * RDC n'en demande pas au personnel : le premier type exposé par
 * l'API sert de valeur par défaut (voir FormulaireCreationRapide).
 */
export function useTypesPatient(): TypePatientApi[] {
  const query = useQuery({
    queryKey: ['rdc', 'types-patient'],
    queryFn: getTypesPatientApi,
    staleTime: 60 * 60_000,
    retry: false,
  });
  return query.data ?? [];
}

export interface HistoriqueResultat {
  passages: Passage[];
  enChargement: boolean;
  /** Serveur injoignable : seuls les passages locaux sont affichés. */
  erreurServeur: boolean;
}

/**
 * Historique 360° d'un patient :
 *  - passages LOCAUX (caisse / ordonnances / triages du jour) : toujours ;
 *  - historique SERVEUR (consultations + factures) : uniquement si
 *    l'ID est un id numérique MySQL — les patients créés hors ligne
 *    (dossier INIT-ANNÉE-N°) n'existent côté serveur qu'après sync ;
 *    leur historique jour est déjà couvert par le store.
 */
export function useHistoriquePatient(patientId: string | null): HistoriqueResultat {
  const state = useRdcState();
  const idServeur = patientId !== null && /^\d+$/.test(patientId) ? patientId : null;

  const query = useQuery({
    queryKey: ['rdc', 'historique', idServeur],
    queryFn: () => (idServeur ? getHistoriqueApi(idServeur) : Promise.resolve([] as Passage[])),
    enabled: idServeur !== null,
    staleTime: 60_000,
    retry: false,
  });

  const passages = useMemo(
    () => trierPassages([...(query.data ?? []), ...passagesDuStore(state, patientId)]),
    [query.data, state, patientId],
  );

  return {
    passages,
    enChargement: idServeur !== null && query.isPending,
    erreurServeur: idServeur !== null && query.isError,
  };
}
