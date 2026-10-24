/**
 * Hooks de données CONSULTATION (phase 4 — branchement API réelle).
 *
 * Architecture offline-first inchangée (phases 1-2) :
 *  - le STORE LOCAL reste la source de vérité de la journée (les
 *    décréments de stock hors ligne sont conservés — le serveur ne
 *    les ÉCRASE pas : fusion « local d'abord, api en complément ») ;
 *  - les listes serveur (médicaments, types de consultation, médecins)
 *    arrivent via React Query (staleTime court, retry false — axios a
 *    déjà re-joué ×3) et HYDRATENT le store à l'arrivée ;
 *  - hors ligne, le dernier cache serveur (SW NetworkFirst) et le seed
 *    local gardent l'écran 100 % utilisable.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getDocteursApi,
  getMedicamentsApi,
  getTypesConsultationApi,
  type DocteurApi,
  type TypeConsultationApi,
} from '../../../services/consultationApi';
import { normaliser, hydraterMedicamentsServeur, useRdcState } from './rdcStore';
import type { Medicament } from './types';

/**
 * Hooks
 * (la fusion locaux ∪ serveur vit dans rdcStore.hydraterMedicamentsServeur :
 *  source unique — « local gagne » pour les décréments du jour.)
 */

/** Nom normalisé → id numérique serveur (résolution au moment de la saisie). */
export function idMedicamentServeur(medicaments: Medicament[], medicamentId: string): number | null {
  const med = medicaments.find((m) => m.id === medicamentId);
  if (!med) return null;
  if (/^\d+$/.test(med.id)) {
    const n = Number(med.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Type de consultation par nom normalisé (réconciliation à la saisie). */
export function trouverTypeConsultation(
  types: TypeConsultationApi[],
  nom: string,
): TypeConsultationApi | null {
  const cible = normaliser(nom);
  if (cible === '') return null;
  return types.find((t) => normaliser(t.nom) === cible) ?? null;
}

// ------------------------------------------------------------
// Hooks
// ------------------------------------------------------------

/**
 * Stock médicaments : le serveur HYDRATE le store (fusionnerMedicaments
 * appliqué dans le store — « local gagne »), l'écran lit le store.
 * staleTime 30 s : le stock doit rester crédible sans marteler l'API ;
 * le cache SW (NetworkFirst 8 s) couvre l'indisponibilité réseau.
 */
export function useMedicamentsRdc(): { medicaments: Medicament[]; serveurDispo: boolean } {
  const state = useRdcState();
  const { data, isSuccess } = useQuery<Medicament[]>({
    queryKey: ['rdc', 'medicaments'],
    queryFn: getMedicamentsApi,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isSuccess && data.length > 0) hydraterMedicamentsServeur(data);
  }, [isSuccess, data]);

  return { medicaments: state.medicaments, serveurDispo: isSuccess && data.length > 0 };
}

/** Types de consultation (GET /api/consult/consult_type). */
export function useTypesConsultationRdc(): {
  types: TypeConsultationApi[];
  disponible: boolean;
} {
  const { data = [], isSuccess } = useQuery<TypeConsultationApi[]>({
    queryKey: ['rdc', 'types_consultation'],
    queryFn: getTypesConsultationApi,
    staleTime: 10 * 60_000, // les tarifs changent rarement dans la journée
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { types: data, disponible: isSuccess && data.length > 0 };
}

/** Médecins (GET /api/docteur) — id MySQL requis par POST /api/consult. */
export function useDocteursRdc(): { docteurs: DocteurApi[]; disponible: boolean } {
  const { data = [], isSuccess } = useQuery<DocteurApi[]>({
    queryKey: ['rdc', 'docteurs'],
    queryFn: getDocteursApi,
    staleTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { docteurs: data, disponible: isSuccess && data.length > 0 };
}
