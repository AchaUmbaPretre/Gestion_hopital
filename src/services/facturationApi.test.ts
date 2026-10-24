/**
 * Tests facturation API (phase 3 RDC) — fonctions pures :
 *  - payload facture calibré sur le contrôleur + modèle réels
 *    (service_details SNAKE_CASE, statuts RDC, extras d'audit) ;
 *  - payload paiement (id_facture null — résolu au rejeu) ;
 *  - lecture défensive des listes MySQL (lignes mal formées ignorées) ;
 *  - réconciliation : choix de la facture correspondante (patient +
 *    montant + date, exclusion des ids déjà appariés, plus récente gagne).
 */

import {
  construirePayloadFacture,
  construirePayloadPaiement,
  choisirFactureCorrespondante,
  dateLimiteFacture,
  mapFacturesApi,
  mapPaiementsApi,
  sommePaiementsParFacture,
  statutFacture,
  type FactureApi,
} from './facturationApi';
import type { Patient } from '../pages/rdc/data/types';

const patientApi: Patient = {
  id: '12',
  nom: 'KABONGO',
  prenom: 'Ilunga',
  sexe: 'M',
  ageEstime: 40,
  telephone: '0812345678',
  exonere: false,
  refere: false,
  source: 'api',
  creeLe: '',
};

const patientLocal: Patient = {
  id: 'KI-2026-0007',
  nom: 'MBUYI',
  prenom: 'Grace',
  sexe: 'F',
  ageEstime: 28,
  telephone: '0998887776',
  exonere: false,
  refere: false,
  source: 'local',
  creeLe: new Date().toISOString(),
};

const baseMouvement = {
  reference: 'REC-2026-0012',
  dateIso: '2026-10-24T09:30:00.000Z',
  totalUsd: 9,
  partMutuelleUsd: 0,
  ticketModerateurUsd: 9,
  mode: 'totalite' as const,
  soldeUsd: 0,
  tauxFcUsd: 2850,
};

describe('statutFacture + dateLimiteFacture', () => {
  it('statut selon le mode de recouvrement RDC', () => {
    expect(statutFacture('totalite', 0)).toBe('Payée');
    expect(statutFacture('acompte', 5)).toBe('Partielle');
    expect(statutFacture('acompte', 0)).toBe('Payée');
    expect(statutFacture('exonere', 9)).toBe('Exonérée');
    expect(statutFacture('urgence_vitale', 9)).toBe('En attente');
  });

  it('dateLimite : jour même si soldé, +15 jours sinon', () => {
    expect(dateLimiteFacture('2026-10-24', 0)).toBe('2026-10-24');
    expect(dateLimiteFacture('2026-10-24', 5)).toBe('2026-11-08');
  });
});

describe('construirePayloadFacture', () => {
  it('payload calibré sur le backend : service_details snake_case + statut', () => {
    const payload = construirePayloadFacture({
      mouvement: baseMouvement,
      patient: patientApi,
      patientIdServeur: 12,
      lignes: [
        { acteId: 'act-cons-gen', libelle: 'Consultation générale', montantUsd: 5, categorie: 'Consultation' },
        { acteId: 'act-labo-palu', libelle: 'TDR paludisme', montantUsd: 4, categorie: 'Laboratoire' },
      ],
    });

    expect(payload['patient_id']).toBe(12);
    expect(payload['date_emission']).toBe('2026-10-24');
    expect(payload['date_limite']).toBe('2026-10-24'); // soldée → jour même
    expect(payload['montant_total']).toBe(9);
    expect(payload['status']).toBe('Payée');

    // Piège du contrôleur : le MODÈLE lit `service_details` (snake_case),
    // PAS `serviceDetails` (destructuré mais jamais utilisé côté modèle).
    const details = payload['service_details'];
    expect(Array.isArray(details)).toBe(true);
    expect(details).toEqual([
      { service_type: 'Consultation', service_id: 0, montant: 5 },
      { service_type: 'Laboratoire', service_id: 0, montant: 4 },
    ]);
    expect(payload['serviceDetails']).toBeUndefined();
  });

  it('patient LOCAL : patient_id null (réconciliation au rejeu) + identité embarquée', () => {
    const payload = construirePayloadFacture({
      mouvement: { ...baseMouvement, mode: 'acompte', soldeUsd: 4, ticketModerateurUsd: 9 },
      patient: patientLocal,
      patientIdServeur: null,
      lignes: [{ acteId: 'act-cons-gen', libelle: 'Consultation générale', montantUsd: 9, categorie: 'Consultation' }],
    });
    expect(payload['patient_id']).toBeNull();
    expect(payload['dossier_patient']).toBe('KI-2026-0007');
    expect(payload['patient_identite']).toEqual({
      nom: 'MBUYI',
      prenom: 'Grace',
      telephone: '0998887776',
    });
    expect(payload['status']).toBe('Partielle');
    expect(payload['date_limite']).toBe('2026-11-08');
  });

  it('extras RDC tracés dans le payload (audit, gaps backend)', () => {
    const payload = construirePayloadFacture({
      mouvement: {
        ...baseMouvement,
        mode: 'urgence_vitale',
        motifExoneration: 'Polytraumatisé — régularisation par la famille',
        autorisePar: 'Médecin chef',
        mutuelle: { organisme: 'MUSABU', couverturePct: 70, numeroAdherent: 'M-4455' },
        partMutuelleUsd: 6.3,
        ticketModerateurUsd: 2.7,
      },
      patient: patientLocal,
      patientIdServeur: null,
      lignes: [{ acteId: 'act-soins-acc', libelle: 'Accouchement simple', montantUsd: 9, categorie: 'Soins' }],
    });
    expect(payload['status']).toBe('En attente');
    expect(payload['facture_locale']).toBe('REC-2026-0012');
    expect(payload['motif_exoneration']).toContain('Polytraumatisé');
    expect(payload['autorise_par']).toBe('Médecin chef');
    expect(payload['mutuelle']).toEqual({ organisme: 'MUSABU', couverturePct: 70, numeroAdherent: 'M-4455' });
    expect(payload['part_mutuelle']).toBe(6.3);
    expect(payload['ticket_moderateur']).toBe(2.7);
    expect(payload['taux_fc_usd']).toBe(2850);
  });
});

describe('construirePayloadPaiement', () => {
  it('payload calibré : id_facture null, transaction_id = référence du reçu', () => {
    const payload = construirePayloadPaiement({
      montantPayeUsd: 4.5,
      datePaiementIso: '2026-10-24T10:00:00.000Z',
      modePaiement: 'especes_fc',
      factureLocale: 'REC-2026-0012',
      patient: patientApi,
      patientIdServeur: 12,
      montantFactureUsd: 9,
      dateEmissionFacture: '2026-10-24',
      tauxFcUsd: 2850,
    });
    expect(payload['id_facture']).toBeNull(); // résolu au rejeu (réconciliation)
    expect(payload['amount']).toBe(4.5);
    expect(payload['date_paiement']).toBe('2026-10-24T10:00:00.000Z');
    expect(payload['methode_paiement']).toBe('especes_fc');
    expect(payload['transaction_id']).toBe('REC-2026-0012'); // trace croisée reçu ↔ serveur
    // Critères de réconciliation embarqués :
    expect(payload['facture_locale']).toBe('REC-2026-0012');
    expect(payload['patient_id']).toBe(12);
    expect(payload['montant_facture']).toBe(9);
    expect(payload['date_emission_facture']).toBe('2026-10-24');
  });
});

describe('lecture défensive des listes', () => {
  it('mapFacturesApi : ignore les lignes sans id, coerce les nombres', () => {
    const factures = mapFacturesApi([
      { id_facture: 3, patient_id: 12, nom_patient: 'KABONGO Ilunga', date_emission: '2026-10-24 09:00:00', date_limite: '2026-10-24', montant_total: '9.00', status: 'Payée' },
      { patient_id: 13 }, // sans id → ignorée
      'n\'importe quoi', // non objet → ignoré
    ]);
    expect(factures).toHaveLength(1);
    const f: FactureApi = factures[0] as FactureApi;
    expect(f.idFacture).toBe(3);
    expect(f.montantTotal).toBe(9);
    expect(f.dateEmission).toBe('2026-10-24');
  });

  it('mapFacturesApi : non-tableau → []', () => {
    expect(mapFacturesApi(null)).toEqual([]);
    expect(mapFacturesApi({})).toEqual([]);
  });

  it('mapPaiementsApi + sommePaiementsParFacture (acomptes groupés)', () => {
    const paiements = mapPaiementsApi([
      { id_paiement: 1, id_facture: 3, amount: 4.5, date_paiement: '2026-10-24 10:00', methode_paiement: 'especes_fc', transaction_id: 'REC-2026-0012' },
      { id_paiement: 2, id_facture: 3, amount: 4.5, date_paiement: '2026-10-24 16:00', methode_paiement: 'especes_usd', transaction_id: 'REC-2026-0020' },
      { id_paiement: 3, id_facture: null, amount: 2 }, // orphelin → ignoré dans la somme
    ]);
    expect(paiements).toHaveLength(3);
    const totaux = sommePaiementsParFacture(paiements);
    expect(totaux.get(3)).toEqual({ somme: 9, nombre: 2 });
    expect(totaux.size).toBe(1);
  });
});

describe('réconciliation (POST /factures ne renvoie pas d\u2019id)', () => {
  const serveur: FactureApi[] = [
    { idFacture: 41, patientId: 12, nomPatient: 'KABONGO', dateEmission: '2026-10-24', dateLimite: '2026-10-24', montantTotal: 9, status: 'Payée' },
    { idFacture: 42, patientId: 12, nomPatient: 'KABONGO', dateEmission: '2026-10-24', dateLimite: '2026-11-08', montantTotal: 9, status: 'Partielle' },
    { idFacture: 43, patientId: 15, nomPatient: 'AUTRE', dateEmission: '2026-10-24', dateLimite: '2026-10-24', montantTotal: 9, status: 'Payée' },
  ];

  it('apparie patient + montant + date, plus récente non appariée', () => {
    expect(choisirFactureCorrespondante(serveur, {
      patientIdServeur: 12,
      montantTotal: 9,
      dateEmission: '2026-10-24',
      idsDejaMappees: new Set(),
    })).toBe(42);
  });

  it('exclut les ids déjà appariés (deux factures identiques le même jour)', () => {
    expect(choisirFactureCorrespondante(serveur, {
      patientIdServeur: 12,
      montantTotal: 9,
      dateEmission: '2026-10-24',
      idsDejaMappees: new Set([42]),
    })).toBe(41);
  });

  it('aucune correspondance (montant ou patient différent) → null', () => {
    expect(choisirFactureCorrespondante(serveur, {
      patientIdServeur: 12,
      montantTotal: 100,
      dateEmission: '2026-10-24',
      idsDejaMappees: new Set(),
    })).toBeNull();
    expect(choisirFactureCorrespondante(serveur, {
      patientIdServeur: 99,
      montantTotal: 9,
      dateEmission: '2026-10-24',
      idsDejaMappees: new Set(),
    })).toBeNull();
  });

  it('tolérance d\u2019arrondi ±0,01 USD (montants MySQL en string)', () => {
    const factures: FactureApi[] = [
      { idFacture: 7, patientId: 12, nomPatient: '', dateEmission: '2026-10-24', dateLimite: '', montantTotal: 8.999, status: '' },
    ];
    expect(choisirFactureCorrespondante(factures, {
      patientIdServeur: 12,
      montantTotal: 9,
      dateEmission: '2026-10-24',
      idsDejaMappees: new Set(),
    })).toBe(7);
  });
});
