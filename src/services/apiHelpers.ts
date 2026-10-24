/**
 * HELPERS DE LECTURE DÉFENSIVE des réponses MySQL (zéro `any`).
 *
 * Module partagé par tous les services d'adaptation à api_hopital
 * (patientsApi, facturationApi, offline/envoiMetier) — extrait de
 * patientsApi en phase 3 pour ÉVITER UN CYCLE d'imports : la
 * facturation et les patients s'entre-réconcilient, leurs services
 * ne doivent pas s'importer mutuellement leurs helpers.
 *
 * Convention : un champ manquant devient '', 0 ou null — jamais un
 * crash dans un écran de soin.
 */

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
