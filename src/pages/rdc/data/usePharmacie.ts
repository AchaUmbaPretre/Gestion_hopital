/**
 * Hooks de données PHARMACIE (phase 5 — branchement API réelle).
 *
 * Architecture offline-first inchangée (phases 1-4) :
 *  - le STOCK local du store reste la source de vérité du jour (les
 *    décréments hors ligne ne sont jamais écrasés — hydratation
 *    « local gagne » déjà en place via useMedicamentsRdc) ;
 *  - la FILE D'ATTENTE SERVEUR (GET /api/ordonnance, corrigée B3 :
 *    une ligne par médicament) arrive via React Query et alimente la
 *    section « Ordonnances d'autres postes » de l'écran — une
 *    ordonnance créée au service B est délivrable au comptoir A ;
 *  - hors ligne, le dernier cache SW (NetworkFirst 8 s) garde la file
 *    visible avec un badge explicite.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getMutuellesApi,
  getOrdonnancesServeurApi,
  type LigneOrdonnanceServeur,
  type MutuelleApi,
} from '../../../services/pharmacieApi';

/**
 * File d'attente SERVEUR (ordonnances créées depuis n'importe quel
 * poste). staleTime 30 s — la file évolue dans la journée ; retry
 * false : axios a déjà re-joué ×3, un poste hors réseau n'attend pas.
 */
export function useOrdonnancesServeur(): {
  lignes: LigneOrdonnanceServeur[];
  serveurDisponible: boolean;
} {
  const { data = [], isSuccess } = useQuery<LigneOrdonnanceServeur[]>({
    queryKey: ['rdc', 'ordonnances_serveur'],
    queryFn: getOrdonnancesServeurApi,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { lignes: data, serveurDisponible: isSuccess };
}

/**
 * Mutuelles actives (datalist de l'écran Patients + réconciliation
 * d'affectation). staleTime 10 min : la liste des organismes change
 * rarement dans la journée.
 */
export function useMutuellesRdc(): {
  mutuelles: MutuelleApi[];
  disponible: boolean;
} {
  const { data = [], isSuccess } = useQuery<MutuelleApi[]>({
    queryKey: ['rdc', 'mutuelles'],
    queryFn: getMutuellesApi,
    staleTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { mutuelles: data, disponible: isSuccess && data.length > 0 };
}
