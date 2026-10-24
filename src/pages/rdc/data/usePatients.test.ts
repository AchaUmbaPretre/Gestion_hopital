/**
 * Tests fusion patients locaux ∪ serveur + passages locaux
 * (phase 2 RDC — fonctions pures de usePatients.ts).
 */

import {
  cleIdentite,
  fusionnerPatients,
  passagesDuStore,
} from './usePatients';
import type { Patient, RdcState } from './types';

function patientLocal(surcharge: Partial<Patient> = {}): Patient {
  return {
    id: 'KI-2026-0007',
    nom: 'Kabila',
    prenom: 'Ilunga',
    sexe: 'M',
    ageEstime: 34,
    telephone: '+243 970 112 233',
    exonere: false,
    refere: false,
    source: 'local',
    creeLe: '2026-02-24T08:00:00.000Z',
    ...surcharge,
  };
}

describe('cleIdentite (insensible casse/accents, téléphone robuste)', () => {
  it('normalise casse et accents', () => {
    expect(cleIdentite(patientLocal({ nom: 'KABÏLA', prenom: 'ilunga' }))).toBe(
      cleIdentite(patientLocal()),
    );
  });

  it('détecte le même numéro saisi avec ou sans indicatif/espace', () => {
    const a = patientLocal({ telephone: '+243 970 112 233' });
    const b = patientLocal({ telephone: '0970112233' });
    expect(cleIdentite(a)).toBe(cleIdentite(b));
  });

  it('distingue deux numéros différents', () => {
    const a = patientLocal();
    const b = patientLocal({ telephone: '0999000111' });
    expect(cleIdentite(a)).not.toBe(cleIdentite(b));
  });
});

describe('fusionnerPatients', () => {
  it('le patient LOCAL gagne le doublon (dossier imprimable + journée)', () => {
    const local = patientLocal();
    const serveur = {
      ...patientLocal(),
      id: '42',
      source: 'api' as const,
      exonere: false,
    };
    const fusion = fusionnerPatients([local], [serveur]);
    expect(fusion).toHaveLength(1);
    expect(fusion[0]?.id).toBe('KI-2026-0007');
    expect(fusion[0]?.source).toBe('local');
  });

  it('conserve les patients serveur sans doublon local', () => {
    const fusion = fusionnerPatients(
      [patientLocal()],
      [patientLocal({ id: '42', nom: 'Mbuyi', prenom: 'Jean', telephone: '0812345678', source: 'api' })],
    );
    expect(fusion).toHaveLength(2);
    expect(fusion[0]?.source).toBe('local');
    expect(fusion[1]?.source).toBe('api');
  });

  it('deux patients différents restent deux patients', () => {
    const fusion = fusionnerPatients(
      [
        patientLocal(),
        patientLocal({ id: 'MB-2026-0002', nom: 'Mbuyi', prenom: 'Jean', telephone: '0812345678' }),
      ],
      [],
    );
    expect(fusion).toHaveLength(2);
  });

  it('liste vide + vide = vide (jamais de crash)', () => {
    expect(fusionnerPatients([], [])).toEqual([]);
  });
});

describe('passagesDuStore (actes du jour, disponibles hors ligne)', () => {
  const state: RdcState = {
    patients: [patientLocal()],
    medicaments: [],
    actes: [],
    ordonnances: [
      {
        id: 'ORD-2026-0001',
        patientId: 'KI-2026-0007',
        medecin: 'Dr Mbuyi',
        service: 'Médecine interne',
        dateIso: '2026-02-24T09:30:00.000Z',
        lignes: [],
        statut: 'delivree',
      },
    ],
    triages: [
      {
        id: 'TRI-2026-0001',
        patientId: 'KI-2026-0007',
        niveau: 'rouge',
        motif: 'Polytraumatisme AVP',
        orientation: 'Salle de déchocage',
        urgenceVitale: true,
        autorisePar: 'Chef de service',
        motifAutorisation: 'Arrêté 1250/2025',
        montantDuUsd: 0,
        dateIso: '2026-02-24T08:10:00.000Z',
      },
    ],
    mouvements: [
      {
        id: 'MVT-REC-2026-0001',
        patientId: 'KI-2026-0007',
        dateIso: '2026-02-24T10:00:00.000Z',
        lignes: [],
        totalUsd: 20,
        partMutuelleUsd: 0,
        ticketModerateurUsd: 20,
        mode: 'urgence_vitale',
        montantPayeUsd: 0,
        soldeUsd: 20,
        tauxFcUsd: 2850,
        reference: 'REC-2026-0001',
      },
    ],
    compteurDossier: 7,
    compteurRecu: 1,
  };

  it('expose caisse + ordonnance + triage du patient, triés du plus récent', () => {
    const passages = passagesDuStore(state, 'KI-2026-0007');
    expect(passages).toHaveLength(3);
    expect(passages[0]?.type).toBe('caisse_locale');
    expect(passages[1]?.type).toBe('ordonnance_locale');
    expect(passages[2]?.type).toBe('triage_locale');
  });

  it('trace l\'urgence vitale et le solde dû (audit 1250/2025)', () => {
    const passages = passagesDuStore(state, 'KI-2026-0007');
    const caisse = passages.find((p) => p.type === 'caisse_locale');
    expect(caisse?.detail).toBe('Urgence vitale — paiement différé');
    expect(caisse?.statut).toContain('Solde dû');
    const triage = passages.find((p) => p.type === 'triage_locale');
    expect(triage?.statut).toBe('Urgence vitale (paiement différé)');
  });

  it('ignore les actes des autres patients et les listes nulles', () => {
    expect(passagesDuStore(state, 'AUTRE-ID')).toEqual([]);
    expect(passagesDuStore(state, null)).toEqual([]);
  });
});
