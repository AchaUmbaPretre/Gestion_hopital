/**
 * Types métier RDC — prototype des 5 écrans cœur.
 * TypeScript strict, zéro `any` (brief RDC, règles IA).
 *
 * Modélisation = réalité d'un HGR en RDC :
 *  - identité patient simplifiée (pas d'email, pas de NSS) ;
 *  - bidevise FC/USD (les prix de référence sont stockés en USD,
 *    devise des tarifs hospitaliers, et convertis en FC) ;
 *  - traçabilité des exceptions financières (urgence vitale,
 *    exonération) conformément à l'arrêté ministériel n°1250/2025.
 */

export type Sexe = 'M' | 'F';

/** Triage des urgences — 4 niveaux (brief RDC Partie 5). */
export type NiveauTriage = 'rouge' | 'orange' | 'jaune' | 'vert';

export const NIVEAUX_TRIAGE: ReadonlyArray<{
  niveau: NiveauTriage;
  libelle: string;
  delai: string;
}> = [
  { niveau: 'rouge', libelle: 'Rouge', delai: 'immédiat' },
  { niveau: 'orange', libelle: 'Orange', delai: '≤ 30 min' },
  { niveau: 'jaune', libelle: 'Jaune', delai: '≤ 2 h' },
  { niveau: 'vert', libelle: 'Vert', delai: 'différable' },
];

/** Mutuelle de santé (200+ mutuelles volontaires en RDC). */
export interface Mutuelle {
  organisme: string;
  /** % de couverture prise en charge par la mutuelle (0–100). */
  couverturePct: number;
  numeroAdherent: string;
}

/**
 * Patient — modèle volontairement minimal (création rapide :
 * Nom + Prénom + Sexe + Âge estimé suffisent, le reste est
 * optionnel et modifiable plus tard — brief RDC 3.2).
 * Le "dossier" remplace le numéro de sécurité sociale inexistant.
 */
export interface Patient {
  /** Identifiant simple imprimable sur le carnet : INIT-ANNÉE-N° */
  id: string;
  nom: string;
  prenom: string;
  sexe: Sexe;
  /** Âge estimé en années (0 = moins d'un an) — pas de DDN fiable. */
  ageEstime: number;
  /** Souvent le SEUL identifiant fiable (brief RDC Partie 5). */
  telephone: string;
  adresse?: string;
  mutuelle?: Mutuelle;
  /** Exonéré / indigent / FSS — statut obligatoire sur la facture. */
  exonere: boolean;
  /** Patient référé par un centre de santé ? */
  refere: boolean;
  /**
   * Origine de la fiche :
   *  - 'api'   : venu de api_hopital (id numérique MySQL) ;
   *  - 'local' : créé sur ce poste (dossier INIT-ANNÉE-N°), sera
   *              poussé par l'outbox — absent = prototype antérieur.
   */
  source?: 'api' | 'local';
  creeLe: string; // ISO
}

/** Médicament de la pharmacie (stock temps réel). */
export interface Medicament {
  id: string;
  nom: string;
  /** Classe thérapeutique — base de l'alternative en cas de rupture. */
  classe: string;
  forme: string;
  prixUsd: number;
  stock: number;
  /** En dessous de ce seuil = alerte "stock bas" (orange). */
  seuil: number;
  /**
   * Origine (phase 4) : 'api' = stock réel GET /api/pharma (id
   * numérique réutilisable pour POST /api/ordonnance) ; 'local' = seed
   * de démonstration hors ligne. Absent = prototype antérieur.
   */
  source?: 'api' | 'local';
}

export type CategorieActe =
  | 'Consultation'
  | 'Laboratoire'
  | 'Imagerie'
  | 'Séjour'
  | 'Soins';

/** Acte tarifé de l'HGR (tarif de référence en USD). */
export interface Acte {
  id: string;
  libelle: string;
  categorie: CategorieActe;
  prixUsd: number;
}

export interface LigneOrdonnance {
  medicamentId: string;
  /** Posologie : "1 cp x 3/jour" — jamais en italique (print). */
  posologie: string;
  dureeJours: number;
  quantite: number;
}

export interface Ordonnance {
  id: string;
  patientId: string;
  medecin: string;
  service: string;
  dateIso: string;
  lignes: LigneOrdonnance[];
  statut: 'en_attente' | 'delivree';
  // ---- Phase 4 (branchement POST /api/consult + /api/ordonnance) ----
  /**
   * Id MySQL du type de consultation (FK `typeconsultation`) —
   * obligatoire pour POST /api/consult ; null si l'API n'a jamais
   * été joignable (le rejeu résoudra par nom, sinon ErreurAttente).
   */
  typeConsultationId?: number | null;
  /** Libellé du type (réconciliation par nom au rejeu si id null). */
  typeConsultationNom?: string;
  /** Id MySQL du médecin (users.id) — JAMAIS deviné au rejeu. */
  personnelId?: number | null;
  /** Diagnostic structuré (colonne `diagnostic` de `consultation`). */
  diagnostic?: string;
  /** Notes cliniques (motif, antécédents, examen) — colonne `notes`. */
  notes?: string;
}

/** Trace de triage (qui, quoi, niveau, orientation). */
export interface Triage {
  id: string;
  patientId: string;
  niveau: NiveauTriage;
  motif: string;
  orientation: string;
  /**
   * Urgence vitale : prise en charge SANS paiement préalable
   * (arrêté n°1250/2025) — régularisation a posteriori tracée.
   */
  urgenceVitale: boolean;
  /** Qui a autorisé la prise en charge sans paiement. */
  autorisePar?: string;
  /** Motif de l'exception (obligatoire si urgenceVitale). */
  motifAutorisation?: string;
  /** Montant dû à régulariser (USD) — initialisé à 0. */
  montantDuUsd: number;
  dateIso: string;
}

export type ModePaiement = 'especes_fc' | 'especes_usd' | 'mobile_money';

export type ModeRecouvrement =
  | 'totalite'
  | 'acompte'
  | 'exonere'
  | 'urgence_vitale';

/**
 * Mouvement de caisse = un "écran unique" validé (brief RDC 3.3).
 * Trace obligatoire pour exonération / urgence vitale :
 * qui a autorisé, motif, montant dû.
 */
export interface MouvementCaisse {
  id: string;
  patientId: string;
  dateIso: string;
  lignes: Array<{ acteId: string; libelle: string; montantUsd: number }>;
  totalUsd: number;
  /** Part prise en charge par la mutuelle (USD). */
  partMutuelleUsd: number;
  /** Reste à charge du patient = ticket modérateur (USD). */
  ticketModerateurUsd: number;
  mode: ModeRecouvrement;
  /** Montant effectivement encaissé maintenant (USD). */
  montantPayeUsd: number;
  /** Solde restant dû (USD) — acompte ou régularisation. */
  soldeUsd: number;
  /** Taux FC/USD au moment du paiement (audit bidevise). */
  tauxFcUsd: number;
  mutuelle?: Mutuelle;
  motifExoneration?: string;
  autorisePar?: string;
  modePaiement?: ModePaiement;
  reference: string; // ex: REC-2026-0001
  /**
   * Reçu d'ACOMPTE : référence de la facture d'origine (REC-…) sur
   * laquelle cet encaissement vient se déduire (paiements multiples
   * sur une même facture — brief RDC 1.3). Absent = ce mouvement EST
   * la facture (avec son premier paiement éventuel).
   */
  factureRefOrigine?: string;
}

/** État global du prototype (persisté en localStorage = offline). */
export interface RdcState {
  patients: Patient[];
  medicaments: Medicament[];
  actes: Acte[];
  ordonnances: Ordonnance[];
  triages: Triage[];
  mouvements: MouvementCaisse[];
  compteurDossier: number;
  compteurRecu: number;
}

/** Services d'un HGR (brief RDC 1.1). */
export const SERVICES_HGR: ReadonlyArray<string> = [
  'Urgences / Déchocage',
  'Médecine interne',
  'Chirurgie',
  'Pédiatrie',
  'Gynéco-obstétrique',
  'Laboratoire',
  'Pharmacie',
];

/** Libellés lisibles des niveaux de triage (badge + délai cible). */
export function libelleTriage(n: NiveauTriage): string {
  const found = NIVEAUX_TRIAGE.find((t) => t.niveau === n);
  return found ? `${found.libelle} (${found.delai})` : n;
}
