/**
 * Données initiales du prototype — réalistes pour un HGR en RDC.
 *
 * ⚠️ PROTOTYPE : ces données sont mockées côté client et persistées
 * en localStorage pour démontrer les flux offline-first. Le mapping
 * vers l'API réelle (api_hopital) est documenté dans
 * docs/RDC_BUSINESS_LOGIC.md §12 et exécuté au plan de migration
 * (phase 2+).
 */

import type { Acte, Medicament, Ordonnance, Patient, RdcState, Triage, MouvementCaisse } from './types';

const AUJOURD_HUI = new Date().toISOString();

/** Tarifs HGR indicatifs (USD — devise des tarifs hospitaliers). */
const ACTES: Acte[] = [
  { id: 'act-cons-gen', libelle: 'Consultation générale', categorie: 'Consultation', prixUsd: 5 },
  { id: 'act-cons-urg', libelle: 'Consultation urgence', categorie: 'Consultation', prixUsd: 7 },
  { id: 'act-cons-spe', libelle: 'Consultation spécialiste', categorie: 'Consultation', prixUsd: 10 },
  { id: 'act-labo-nfs', libelle: 'NFS (numération formule sanguine)', categorie: 'Laboratoire', prixUsd: 4 },
  { id: 'act-labo-palu', libelle: 'TDR / goutte épaisse (paludisme)', categorie: 'Laboratoire', prixUsd: 3 },
  { id: 'act-labo-gly', libelle: 'Glycémie', categorie: 'Laboratoire', prixUsd: 2 },
  { id: 'act-img-echo', libelle: 'Échographie', categorie: 'Imagerie', prixUsd: 10 },
  { id: 'act-img-radio', libelle: 'Radiographie thorax', categorie: 'Imagerie', prixUsd: 8 },
  { id: 'act-sej-jour', libelle: 'Hospitalisation — journée (salle commune)', categorie: 'Séjour', prixUsd: 12 },
  { id: 'act-soins-pansement', libelle: 'Pansement', categorie: 'Soins', prixUsd: 3 },
  { id: 'act-soins-acc', libelle: 'Accouchement simple', categorie: 'Soins', prixUsd: 30 },
];

/**
 * Médicaments essentiels (liste nationale RDC) — 2 ruptures
 * documentées avec alternatives de même classe (brief RDC 1.5).
 */
const MEDICAMENTS: Medicament[] = [
  { id: 'med-act-al', nom: 'Artéméther-Luméfantrine 20/120 mg', classe: 'Antipaludique (ACT)', forme: 'cp', prixUsd: 1.5, stock: 0, seuil: 30 },
  { id: 'med-act-aa', nom: 'Artésunate-Amodiaquine', classe: 'Antipaludique (ACT)', forme: 'cp', prixUsd: 1.4, stock: 220, seuil: 40 },
  { id: 'med-act-inj', nom: 'Artésunate injectable 60 mg', classe: 'Antipaludique (injectable)', forme: 'fl', prixUsd: 6, stock: 25, seuil: 15 },
  { id: 'med-par', nom: 'Paracétamol 500 mg', classe: 'Antalgique', forme: 'cp', prixUsd: 0.1, stock: 3200, seuil: 500 },
  { id: 'med-ibu', nom: 'Ibuprofène 400 mg', classe: 'Anti-inflammatoire (AINS)', forme: 'cp', prixUsd: 0.15, stock: 640, seuil: 100 },
  { id: 'med-amox', nom: 'Amoxicilline 500 mg', classe: 'Antibiotique (bêta-lactamine)', forme: 'cp', prixUsd: 0.2, stock: 0, seuil: 200 },
  { id: 'med-ampi', nom: 'Ampicilline 500 mg', classe: 'Antibiotique (bêta-lactamine)', forme: 'cp', prixUsd: 0.25, stock: 480, seuil: 100 },
  { id: 'med-ceft', nom: 'Ceftriaxone 1 g', classe: 'Antibiotique (céphalosporine)', forme: 'fl', prixUsd: 2.5, stock: 18, seuil: 30 },
  { id: 'med-metro', nom: 'Métronidazole 250 mg', classe: 'Antibiotique (imidazolé)', forme: 'cp', prixUsd: 0.12, stock: 900, seuil: 150 },
  { id: 'med-sro', nom: 'SRO (sels de réhydratation orale)', classe: 'Réhydratation', forme: 'sachet', prixUsd: 0.3, stock: 350, seuil: 80 },
  { id: 'med-cotri', nom: 'Cotrimoxazole 480 mg', classe: 'Antibiotique (sulfamide)', forme: 'cp', prixUsd: 0.1, stock: 1100, seuil: 200 },
  { id: 'med-quin', nom: 'Quinine sulfate 300 mg', classe: 'Antipaludique (quinine)', forme: 'cp', prixUsd: 0.4, stock: 260, seuil: 50 },
];

const PATIENTS: Patient[] = [
  {
    id: 'IL-2026-0001', nom: 'Ilunga', prenom: 'Kabongo', sexe: 'M', ageEstime: 42,
    telephone: '+243 970 112 233', adresse: 'Q. Katuba, Av. Kasaï 12', exonere: false, refere: false, creeLe: AUJOURD_HUI,
    mutuelle: { organisme: 'Mutuelle Santé Lubumbashi', couverturePct: 70, numeroAdherent: 'MSL-04412' },
  },
  {
    id: 'MB-2026-0002', nom: 'Mbuyi', prenom: 'Tshala', sexe: 'F', ageEstime: 27,
    telephone: '+243 815 447 890', adresse: 'Q. Kenya, Av. Lubumbashi 4', exonere: false, refere: false, creeLe: AUJOURD_HUI,
  },
  {
    id: 'KA-2026-0003', nom: 'Kasongo', prenom: 'Mwewa', sexe: 'M', ageEstime: 8,
    telephone: '+243 992 003 771', adresse: 'Q. Golf, Av. des Aviateurs 30', exonere: false, refere: true, creeLe: AUJOURD_HUI,
    mutuelle: { organisme: 'RMN Santé', couverturePct: 50, numeroAdherent: 'RMN-90344' },
  },
  {
    id: 'TS-2026-0004', nom: 'Tshimanga', prenom: 'Ngalula', sexe: 'F', ageEstime: 64,
    telephone: '+243 826 551 019', adresse: 'Q. Bel-Air, Av. Kilela 7', exonere: true, refere: false, creeLe: AUJOURD_HUI,
  },
  {
    id: 'NG-2026-0005', nom: 'Ngoy', prenom: 'Baudouin', sexe: 'M', ageEstime: 35,
    telephone: '+243 978 664 002', adresse: 'Q. Ruashi, Av. Kilimandjaro 22', exonere: false, refere: false, creeLe: AUJOURD_HUI,
  },
  {
    id: 'MU-2026-0006', nom: 'Mukendi', prenom: 'Bibiche', sexe: 'F', ageEstime: 19,
    telephone: '+243 899 230 448', adresse: 'Q. Kamalondo, Av. Kigoma 9', exonere: false, refere: false, creeLe: AUJOURD_HUI,
  },
];

const ORDONNANCES: Ordonnance[] = [
  {
    id: 'ORD-2026-0001', patientId: 'IL-2026-0001', medecin: 'Dr. Kabongo', service: 'Médecine interne',
    dateIso: AUJOURD_HUI, statut: 'en_attente',
    lignes: [
      { medicamentId: 'med-par', posologie: '1 cp x 3/jour', dureeJours: 5, quantite: 15 },
      { medicamentId: 'med-amox', posologie: '1 cp x 3/jour', dureeJours: 7, quantite: 21 },
    ],
  },
  {
    id: 'ORD-2026-0002', patientId: 'KA-2026-0003', medecin: 'Dr. Ilunga', service: 'Pédiatrie',
    dateIso: AUJOURD_HUI, statut: 'en_attente',
    lignes: [
      { medicamentId: 'med-act-al', posologie: '1 cp matin et soir', dureeJours: 3, quantite: 6 },
      { medicamentId: 'med-sro', posologie: '1 sachet après chaque selles liquides', dureeJours: 3, quantite: 5 },
    ],
  },
];

const TRIAGES: Triage[] = [
  {
    id: 'TRI-2026-0001', patientId: 'NG-2026-0005', niveau: 'orange', motif: 'Paludisme grave — cédille 3, VCT 24%',
    orientation: 'Urgences / Déchocage', urgenceVitale: false, montantDuUsd: 0, dateIso: AUJOURD_HUI,
  },
  {
    id: 'TRI-2026-0002', patientId: 'TS-2026-0004', niveau: 'rouge', motif: 'AVC en cours, PAS 60',
    orientation: 'Urgences / Déchocage', urgenceVitale: true, autorisePar: 'Dr. Kabongo (chef de garde)',
    motifAutorisation: 'Urgence vitale — régularisation a posteriori (arrêté n°1250/2025)',
    montantDuUsd: 0, dateIso: AUJOURD_HUI,
  },
];

const MOUVEMENTS: MouvementCaisse[] = [
  {
    id: 'MVT-2026-0001', patientId: 'MB-2026-0002', dateIso: AUJOURD_HUI,
    lignes: [{ acteId: 'act-cons-gen', libelle: 'Consultation générale', montantUsd: 5 }],
    totalUsd: 5, partMutuelleUsd: 0, ticketModerateurUsd: 5, mode: 'totalite',
    montantPayeUsd: 5, soldeUsd: 0, tauxFcUsd: 2850, modePaiement: 'especes_fc', reference: 'REC-2026-0001',
  },
];

export function seedRdcState(): RdcState {
  return {
    patients: PATIENTS,
    medicaments: MEDICAMENTS,
    actes: ACTES,
    ordonnances: ORDONNANCES,
    triages: TRIAGES,
    mouvements: MOUVEMENTS,
    compteurDossier: 6,
    compteurRecu: 1,
  };
}
