/**
 * Tests branchement consultation & ordonnances (phase 4 RDC) :
 *  - mapping défensif des référentiels (types, médecins enveloppés,
 *    médicaments) ;
 *  - payloads calibrés sur les colonnes MySQL réelles ;
 *  - lecture défensive des ids créés (backend B1).
 *
 * axios est mocké (pas de réseau) — pas de tests HTTP ici : la chaîne
 * complète est couverte par envoiMetier.test.ts.
 */

import {
  construirePayloadConsultation,
  construirePayloadLigneOrdonnance,
  construirePayloadTraitement,
  lireIdCree,
  mapDocteursApi,
  mapMedicamentsApi,
  mapTypesConsultationApi,
} from './consultationApi';

jest.mock('axios', () => {
  const instanceFactice = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {},
  };
  const axiosFactice = {
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => instanceFactice),
  };
  return { __esModule: true, default: axiosFactice, ...axiosFactice };
});

describe('mapTypesConsultationApi', () => {
  it('mappe id + nom + prix', () => {
    const types = mapTypesConsultationApi([
      { id_typeConsultation: 3, nomConsultation: 'Consultation générale', prixConsultation: 3 },
    ]);
    expect(types).toEqual([{ id: 3, nom: 'Consultation générale', prixUsd: 3 }]);
  });

  it('ignore les lignes sans id ou sans nom, prix manquant = 0', () => {
    const types = mapTypesConsultationApi([
      { id_typeConsultation: 1, nomConsultation: 'Urgence' },
      { nomConsultation: 'sans id' },
      { id_typeConsultation: 2 },
      'pas un objet',
    ]);
    expect(types).toEqual([{ id: 1, nom: 'Urgence', prixUsd: 0 }]);
  });

  it('réponse non tableau → []', () => {
    expect(mapTypesConsultationApi(null)).toEqual([]);
    expect(mapTypesConsultationApi({})).toEqual([]);
  });
});

describe('mapDocteursApi (enveloppe { success, data })', () => {
  it('lit la liste dans data et compose le nom prénom + postnom', () => {
    const docteurs = mapDocteursApi({
      success: true,
      data: [
        { id: 7, prenom: 'Jean', postnom: 'Kabasele', username: 'jk', nom_specialite: 'Chirurgie' },
      ],
    });
    expect(docteurs).toEqual([{ id: 7, nom: 'Jean Kabasele', specialite: 'Chirurgie' }]);
  });

  it("tombe sur username si prénom/postnom absents, et lit aussi une liste directe", () => {
    const enveloppe = mapDocteursApi({ data: [{ id: 2, username: 'mbuyi.g' }] });
    expect(enveloppe).toEqual([{ id: 2, nom: 'mbuyi.g', specialite: '' }]);
    const direct = mapDocteursApi([{ id: 4, prenom: 'Alice' }]);
    expect(direct).toEqual([{ id: 4, nom: 'Alice', specialite: '' }]);
  });

  it('ignore les lignes sans id', () => {
    expect(mapDocteursApi({ data: [{ prenom: 'sans id' }] })).toEqual([]);
  });
});

describe('mapMedicamentsApi (GET /api/pharma)', () => {
  it('mappe id numérique, nom, description→classe, montant→prix, stock', () => {
    const meds = mapMedicamentsApi([
      { id: 12, nomMedicament: 'Paracétamol 500 mg', description: 'Antalgique', montant: 0.1, stock: 3200 },
    ]);
    expect(meds).toEqual([
      {
        id: '12',
        nom: 'Paracétamol 500 mg',
        classe: 'Antalgique',
        forme: '—',
        prixUsd: 0.1,
        stock: 3200,
        seuil: 10,
        source: 'api',
      },
    ]);
  });

  it('valeurs par défaut défensives (description/manquants)', () => {
    const meds = mapMedicamentsApi([{ id: 5, nomMedicament: 'Inconnu' }]);
    expect(meds[0]?.classe).toBe('—');
    expect(meds[0]?.prixUsd).toBe(0);
    expect(meds[0]?.stock).toBe(0);
  });

  it('ignore les lignes sans id et les réponses invalides', () => {
    expect(mapMedicamentsApi([{ nomMedicament: 'sans id' }])).toEqual([]);
    expect(mapMedicamentsApi('non')).toEqual([]);
  });
});

describe('payloads backend', () => {
  it('construirePayloadConsultation : colonnes exactes du contrôleur', () => {
    const payload = construirePayloadConsultation({
      patientIdServeur: 42,
      personnelId: 7,
      idTypeConsultation: 3,
      dateConsultation: '2026-10-24 09:15:00',
      diagnostic: 'Paludisme simple',
      notes: 'Motif : fièvre | Constantes : T° 38.5°C',
    });
    expect(payload).toEqual({
      patientId: 42,
      personnelId: 7,
      id_typeConsultation: 3,
      dateConsultation: '2026-10-24 09:15:00',
      diagnostic: 'Paludisme simple',
      notes: 'Motif : fièvre | Constantes : T° 38.5°C',
    });
  });

  it('construirePayloadLigneOrdonnance : une ligne = un médicament', () => {
    expect(
      construirePayloadLigneOrdonnance({
        consultationId: 9,
        medicamentId: 12,
        quantite: 15,
        dateOrdre: '2026-10-24 09:15:00',
      }),
    ).toEqual({ consultationId: 9, medicamentId: 12, quantite: 15, dateOrdre: '2026-10-24 09:15:00' });
  });

  it('construirePayloadTraitement : posologie→dose, durée→duree (JOIN obligatoire)', () => {
    expect(
      construirePayloadTraitement({
        consultationId: 9,
        medicamentId: 12,
        posologie: '1 cp x 3/jour',
        dureeJours: 5,
      }),
    ).toEqual({
      consultationId: 9,
      medicament: 12,
      dose: '1 cp x 3/jour',
      frequence: '',
      duree: '5',
      instructions: '',
    });
  });
});

describe('lireIdCree (backend B1)', () => {
  it('extrait le premier id exploitable', () => {
    expect(lireIdCree({ message: 'ok', id_consultation: 31 }, ['id_consultation'])).toBe(31);
    expect(lireIdCree({ id_facture: 8 }, ['id_consultation', 'id_facture'])).toBe(8);
  });

  it('refuse 0, les négatifs et les réponses non objet', () => {
    expect(lireIdCree({ id_consultation: 0 }, ['id_consultation'])).toBeNull();
    expect(lireIdCree({ id_consultation: -3 }, ['id_consultation'])).toBeNull();
    expect(lireIdCree(null, ['id_consultation'])).toBeNull();
    expect(lireIdCree('ok', ['id_consultation'])).toBeNull();
  });
});
