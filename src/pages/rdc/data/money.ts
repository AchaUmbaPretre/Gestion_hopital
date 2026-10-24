/**
 * Taux de change FC/USD — paramétrable (brief RDC 1.3).
 * Les deux devises circulent : tout montant s'affiche en FC ET
 * en USD simultanément, avec un taux modifiable depuis l'écran
 * Caisse et persisté en localStorage (offline-first).
 *
 * Formatage : séparateur de milliers à la française (espace),
 * FC sans décimales (unité minimale = 1 FC), USD à 2 décimales.
 */

const TAUX_KEY = 'rdc.taux_fc_usd';

/** Taux indicatif par défaut (1 USD ≈ 2 850 FC). */
export const TAUX_DEFAUT = 2850;

export function getTaux(): number {
  try {
    const raw = localStorage.getItem(TAUX_KEY);
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) && v > 0 ? v : TAUX_DEFAUT;
  } catch {
    return TAUX_DEFAUT;
  }
}

export function setTaux(v: number): void {
  try {
    if (Number.isFinite(v) && v > 0) {
      localStorage.setItem(TAUX_KEY, String(v));
    }
  } catch {
    // stockage indisponible : le taux reste en mémoire pour la session
  }
}

/** USD -> FC (arrondi : les caisses manipulent des billets). */
export function usdToFc(usd: number, taux: number): number {
  return Math.round(usd * taux);
}

/** Format USD : "12,50 $" (virgule française). */
export function formatUsd(usd: number): string {
  return `${usd.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
}

/** Format FC : "35 625 FC" (pas de centimes en francs congolais). */
export function formatFc(fc: number): string {
  return `${Math.round(fc).toLocaleString('fr-FR')} FC`;
}

/** Ligne de total bicolonne : "12,50 $ · 35 625 FC". */
export function formatBidevise(usd: number, taux: number): string {
  return `${formatUsd(usd)} · ${formatFc(usdToFc(usd, taux))}`;
}
