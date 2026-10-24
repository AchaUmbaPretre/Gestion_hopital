/**
 * BRANCHEMENT API TRIAGE (B2 — phase 4 backend, consommé phase 5).
 *
 * POST /api/triage → table `triage` de la migration 001_rdc_metier.sql
 * (4 niveaux rouge/orange/jaune/vert + urgence vitale arrêté
 * n°1250/2025 : autorise_par et motif_autorisation OBLIGATOIRES, le
 * contrôleur renvoie 400 sinon).
 *
 * L'ÉCRITURE n'emprunte PAS ce service : elle passe par l'outbox
 * (offline/envoiMetier.ts) — le payload snake_case construit ici est
 * envoyé au rejeu avec résolution préalable de l'id patient. 501 =
 * migration non appliquée côté serveur → l'entrée bascule en « echec »
 * avec un message explicite, la trace reste imprimée (zéro perte).
 *
 * TypeScript strict, zéro `any`.
 */

/** Payload Triage 4 niveaux — POST /api/triage (B2, snake_case). */
export function construirePayloadTriage(entree: {
  patientIdServeur: number;
  niveau: string;
  motif: string;
  orientation: string;
  urgenceVitale: boolean;
  autorisePar?: string;
  motifAutorisation?: string;
  montantDuUsd: number;
  dateTriage: string;
}): Record<string, unknown> {
  return {
    patient_id: entree.patientIdServeur,
    niveau: entree.niveau,
    motif: entree.motif,
    orientation: entree.orientation,
    urgence_vitale: entree.urgenceVitale,
    autorise_par: entree.urgenceVitale ? (entree.autorisePar ?? null) : undefined,
    motif_autorisation: entree.urgenceVitale ? (entree.motifAutorisation ?? null) : undefined,
    montant_du_usd: entree.montantDuUsd,
    cree_par: 'App RDC',
    date_triage: entree.dateTriage,
  };
}
