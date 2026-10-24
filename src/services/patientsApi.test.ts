/**
 * Tests branchement API patients (phase 2 RDC) — fonctions pures :
 *  - lecture défensive des réponses MySQL (zéro crash sur champ manquant) ;
 *  - mapping patient API -> modèle RDC (âge, sexe, identifiants) ;
 *  - payload de création mappé sur les 15 colonnes réelles du POST ;
 *  - historique : filtrage par patient + tri chronologique.
 */

import {
  ageDepuisDateNaissance,
  construirePayloadCreationPatient,
  dateNaissanceApprochee,
  lireChaine,
  lireDateIso,
  lireNombre,
  mapPassagesConsultationsApi,
  mapPassagesFacturesApi,
  mapPatientApi,
  mapPatientsApi,
  mapTypesPatientApi,
  trierPassages,
} from './patientsApi';

describe('lecture défensive (zéro any)', () => {
  it('lireChaine : string trimmée, nombre -> string, autre -> ""', () => {
    expect(lireChaine('  Kabila ')).toBe('Kabila');
    expect(lireChaine(42)).toBe('42');
    expect(lireChaine(null)).toBe('');
    expect(lireChaine(undefined)).toBe('');
    expect(lireChaine({})).toBe('');
  });

  it('lireNombre : number fini, string numérique, sinon null', () => {
    expect(lireNombre(12.5)).toBe(12.5);
    expect(lireNombre('12.5')).toBe(12.5);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
    expect(lireNombre(NaN)).toBeNull();
  });

  it('lireDateIso : essaie les colonnes de date habituelles', () => {
    expect(lireDateIso({ date_emission: '2026-02-20 10:00:00' })).toContain('2026-02-20');
    expect(lireDateIso({ date: '2026-02-21' })).toContain('2026-02-21');
    expect(lireDateIso({ autre: 'x' })).toBe('');
    expect(lireDateIso({ date_emission: 'pas une date' })).toBe('');
  });
});

describe('ageDepuisDateNaissance', () => {
  const aujourdhui = new Date(2026, 1, 24); // 24 fév. 2026

  it('calcule l\'âge (anniversaire déjà passé)', () => {
    expect(ageDepuisDateNaissance('1986-02-20', aujourdhui)).toBe(40);
  });

  it('n\'incrémente pas avant l\'anniversaire', () => {
    expect(ageDepuisDateNaissance('1986-03-15', aujourdhui)).toBe(39);
  });

  it('rejette les dates invalides ou futures', () => {
    expect(ageDepuisDateNaissance('', aujourdhui)).toBeNull();
    expect(ageDepuisDateNaissance('1986', aujourdhui)).toBeNull();
    expect(ageDepuisDateNaissance('2030-01-01', aujourdhui)).toBeNull();
  });
});

describe('dateNaissanceApprochee', () => {
  it('dérive le 1er janvier de l\'année de naissance', () => {
    expect(dateNaissanceApprochee(34, new Date(2026, 1, 24))).toBe('1992-01-01');
  });

  it('plafonne l\'âge à 130 ans', () => {
    expect(dateNaissanceApprochee(300, new Date(2026, 1, 24))).toBe(
      `${new Date(2026, 1, 24).getFullYear() - 130}-01-01`,
    );
  });
});

describe('mapPatientApi / mapPatientsApi', () => {
  it('mappe les champs MySQL vers le modèle RDC', () => {
    const p = mapPatientApi(
      {
        id_patient: 42,
        nom_patient: ' KABILA ',
        prenom: 'Ilunga',
        dateNaissance: '1986-02-20',
        sexe: 'F',
        tel: '0970000000',
        adresse: 'Q. Katuba',
      },
      0,
    );
    expect(p.id).toBe('42');
    expect(p.nom).toBe('KABILA');
    expect(p.prenom).toBe('Ilunga');
    expect(p.sexe).toBe('F');
    expect(p.telephone).toBe('0970000000');
    expect(p.adresse).toBe('Q. Katuba');
    expect(p.source).toBe('api');
  });

  it('sexe « Autres » -> M, âge dérivé de la DDN, gaps backend neutres', () => {
    const p = mapPatientApi(
      { id_patient: 7, nom_patient: 'Mbuyi', prenom: 'Jean', sexe: 'Autres', dateNaissance: '2000-01-15' },
      0,
    );
    expect(p.sexe).toBe('M');
    expect(p.ageEstime).toBeGreaterThan(20);
    expect(p.exonere).toBe(false);
    expect(p.refere).toBe(false);
    expect(p.mutuelle).toBeUndefined();
  });

  it('id manquant -> clé défensive indexée (jamais de doublon de clé React)', () => {
    const p = mapPatientApi({ nom_patient: 'Test' }, 3);
    expect(p.id).toBe('API-4');
  });

  it('ignore les lignes non-objet et les réponses non-tableau', () => {
    expect(mapPatientsApi(null)).toEqual([]);
    expect(mapPatientsApi({ foo: 1 })).toEqual([]);
    expect(mapPatientsApi([null, 42, { id_patient: 1, nom_patient: 'A', prenom: 'B' }])).toHaveLength(1);
  });
});

describe('mapTypesPatientApi', () => {
  it('mappe id_typePatient / nom_typePatient, ignore les lignes incomplètes', () => {
    const types = mapTypesPatientApi([
      { id_typePatient: 1, nom_typePatient: 'Externe' },
      { id_typePatient: 2 },
      { nom_typePatient: 'Sans id' },
    ]);
    expect(types).toEqual([{ id: 1, nom: 'Externe' }]);
  });
});

describe('historique : filtrage par patient', () => {
  const facturesBrutes = [
    { id_facture: 'FAC-1', patient_id: 42, montant_total: '12.5', status: 'payée', date_emission: '2026-02-20 10:00:00' },
    { id_facture: 'FAC-2', patient_id: 43, montant_total: 30, status: 'impayée', date_emission: '2026-02-21 09:00:00' },
    { id_facture: 'FAC-3', patient_id: '42', montant_total: 5, date: '2026-02-22' },
  ];

  it('factures : ne garde que celles du patient (id numérique ou string)', () => {
    const passages = mapPassagesFacturesApi(facturesBrutes, '42');
    expect(passages).toHaveLength(2);
    expect(passages[0]?.libelle).toBe('Facture n° FAC-1');
    expect(passages[0]?.montantUsd).toBe(12.5);
    expect(passages[1]?.dateIso).toContain('2026-02-22');
  });

  it('consultations : champ patientId + docteur/prix', () => {
    const passages = mapPassagesConsultationsApi(
      [
        { id: 1, patientId: 42, nomConsultation: 'Générale', prixConsultation: 5, docteur: 'Mbuyi', diagnostic: 'Paludisme', date: '2026-02-21' },
        { id: 2, patientId: 99, nomConsultation: 'Spécialisée', date: '2026-02-21' },
      ],
      '42',
    );
    expect(passages).toHaveLength(1);
    expect(passages[0]?.libelle).toBe('Consultation Générale');
    expect(passages[0]?.detail).toBe('Dr Mbuyi');
    expect(passages[0]?.montantUsd).toBe(5);
  });

  it('trierPassages : chronologique décroissant, sans date en dernier', () => {
    const tries = trierPassages([
      { dateIso: '2026-02-20T10:00:00.000Z', type: 'facture', libelle: 'A' },
      { dateIso: '2026-02-22T10:00:00.000Z', type: 'consultation', libelle: 'B' },
      { dateIso: '', type: 'caisse_locale', libelle: 'C' },
    ]);
    expect(tries.map((p) => p.libelle)).toEqual(['B', 'A', 'C']);
  });
});

describe('construirePayloadCreationPatient', () => {
  it('couvre les 15 colonnes destructurées par postControllerPatient', () => {
    const payload = construirePayloadCreationPatient(
      { nom: ' Kabila ', prenom: 'Ilunga', sexe: 'M', ageEstime: 34, telephone: '+243 970 112 233', refere: true },
      'KI-2026-0007',
      3,
    );
    // Colonnes backend exactes (contrôleur gelé).
    expect(payload['nom_patient']).toBe('Kabila');
    expect(payload['prenom']).toBe('Ilunga');
    expect(payload['dateNaissance']).toBe('1992-01-01');
    expect(payload['lieuNaissance']).toBe('');
    expect(payload['sexe']).toBe('M');
    expect(payload['province']).toBe('');
    expect(payload['adresse']).toBe('');
    expect(payload['tel']).toBe('+243 970 112 233');
    expect(payload['email']).toBe('');
    expect(payload['societePatient']).toBe('');
    expect(payload['assurance']).toBe('');
    expect(payload['profession']).toBe('');
    expect(payload['typePatient']).toBe(3);
    expect(payload['groupeSanguin']).toBe('');
    expect(payload['img']).toBeNull();
    // Extras RDC d'audit (gaps backend documentés).
    expect(payload['dossier']).toBe('KI-2026-0007');
    expect(payload['age_estime']).toBe(34);
    expect(payload['refere']).toBe(true);
    expect(payload['source']).toBe('rdc_front_v2');
  });

  it('typePatient null si l\'API n\'expose aucun type', () => {
    const payload = construirePayloadCreationPatient(
      { nom: 'Test', prenom: 'Patient', sexe: 'F', ageEstime: 20 },
      'TP-2026-0001',
      null,
    );
    expect(payload['typePatient']).toBeNull();
    expect(payload['tel']).toBe('');
  });
});
