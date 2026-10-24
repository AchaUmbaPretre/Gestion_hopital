/**
 * Tests envoi métier (phase 3 RDC) — rejeu adapté par type :
 *  - `creer_facture` : résolution de l'id patient (numérique direct ou
 *    réconciliation identité), POST calibré, puis mise en cache de
 *    l'id facture résolu (meta `map_facture:<référence>`) ;
 *  - `creer_paiement` : id facture depuis le cache puis réconciliation
 *    live, POST avec l'id RÉSOLU — jamais de paiement orphelin ;
 *  - prérequis non résolus → ErreurAttente → l'entrée reste en file
 *    SANS consommer d'essai (via synchroniser).
 *
 * axios est mocké (pas de réseau) ; Dexie tourne sur fake-indexeddb.
 */

import 'fake-indexeddb/auto';
import axios from 'axios';

import { db } from './db';
import { enregistrerMutation, synchroniser, reinitialiserOutbox } from './outbox';
import { envoiMetier } from './envoiMetier';

/**
 * axios est mocké AVEC FACTORY : le simple auto-mock rendrait
 * `axios.create()` undefined et ferait planter src/config.js
 * (`userRequest.interceptors` au niveau module). La factory fournit
 * une instance factice dotée d'interceptors neutres.
 */
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
const axiosMock = axios as jest.Mocked<typeof axios>;

const PAYLOAD_FACTURE = {
  patient_id: null,
  date_emission: '2026-10-24',
  date_limite: '2026-11-08',
  montant_total: 9,
  status: 'Partielle',
  service_details: [{ service_type: 'Consultation', service_id: 0, montant: 9 }],
  facture_locale: 'REC-2026-0001',
  dossier_patient: 'KI-2026-0001',
  patient_identite: { nom: 'MBUYI', prenom: 'Grace', telephone: '0998887776' },
  part_mutuelle: 0,
  ticket_moderateur: 9,
  mode: 'acompte',
  motif_exoneration: null,
  autorise_par: null,
  taux_fc_usd: 2850,
};

const PAYLOAD_PAIEMENT = {
  id_facture: null,
  amount: 4.5,
  date_paiement: '2026-10-24T09:30:00.000Z',
  methode_paiement: 'especes_fc',
  transaction_id: 'REC-2026-0001',
  facture_locale: 'REC-2026-0001',
  patient_id: null,
  patient_identite: { nom: 'MBUYI', prenom: 'Grace', telephone: '0998887776' },
  montant_facture: 9,
  date_emission_facture: '2026-10-24',
  taux_fc_usd: 2850,
};

function mockPatientListe(idPatient: number): void {
  axiosMock.get.mockImplementation(async (url: string) => {
    if (String(url).endsWith('/api/patient')) {
      return {
        data: [
          { id_patient: idPatient, nom_patient: 'MBUYI', prenom: 'Grace', tel: '0998887776' },
        ],
      } as never;
    }
    throw new Error(`URL inattendue : ${String(url)}`);
  });
}

function mockFacturesServeur(factures: Array<Record<string, unknown>>): void {
  axiosMock.get.mockImplementation(async (url: string) => {
    if (String(url).endsWith('/api/factures')) {
      return { data: factures } as never;
    }
    if (String(url).endsWith('/api/patient')) {
      return { data: [{ id_patient: 77, nom_patient: 'MBUYI', prenom: 'Grace', tel: '0998887776' }] } as never;
    }
    throw new Error(`URL inattendue : ${String(url)}`);
  });
}

describe('envoiMetier — creer_facture', () => {
  beforeEach(async () => {
    axiosMock.request.mockReset();
    axiosMock.get.mockReset();
    await reinitialiserOutbox();
    await db?.meta.clear();
  });

  test('patient_id numérique → POST direct, puis id facture résolu et caché', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'Facture créée avec succès' } });
    mockFacturesServeur([
      { id_facture: 42, patient_id: 77, date_emission: '2026-10-24 09:00:00', montant_total: 9 },
    ]);

    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: { ...PAYLOAD_FACTURE, patient_id: 77, patient_identite: undefined },
      cleIdempotence: 'creer_facture:F1',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);

    expect(axiosMock.request).toHaveBeenCalledTimes(1);
    const appel = axiosMock.request.mock.calls[0]?.[0];
    expect(appel?.url).toContain('/api/factures');
    expect(appel?.method).toBe('POST');
    expect((appel?.data as Record<string, unknown>)['patient_id']).toBe(77);
    expect((appel?.data as Record<string, unknown>)['service_details']).toEqual([
      { service_type: 'Consultation', service_id: 0, montant: 9 },
    ]);
    // Réconciliation : l'id serveur est mis en cache pour les acomptes.
    const map = await db!.meta.get('map_facture:REC-2026-0001');
    expect(map?.valeur).toBe('42');
  });

  test('patient local → réconciliation identité (GET /api/patient) puis POST avec id résolu', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'ok' } });
    mockPatientListe(77);
    mockFacturesServeur([]); // pas de facture serveur : pas de cache (non bloquant)

    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: PAYLOAD_FACTURE,
      cleIdempotence: 'creer_facture:F2',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);

    const appel = axiosMock.request.mock.calls[0]?.[0];
    expect((appel?.data as Record<string, unknown>)['patient_id']).toBe(77);
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/patient'));
  });

  test('patient local introuvable côté serveur → ErreurAttente (essais non consommés)', async () => {
    axiosMock.get.mockResolvedValue({ data: [] }); // aucun patient serveur
    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: PAYLOAD_FACTURE,
      cleIdempotence: 'creer_facture:F3',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    expect(axiosMock.request).not.toHaveBeenCalled(); // rien n'a été POSTé
    const entrees = await db!.outbox.toArray();
    expect(entrees[0]?.statut).toBe('en_attente');
    expect(entrees[0]?.essais).toBe(0);
  });
});

describe('envoiMetier — creer_paiement', () => {
  beforeEach(async () => {
    axiosMock.request.mockReset();
    axiosMock.get.mockReset();
    await reinitialiserOutbox();
    await db?.meta.clear();
  });

  test('cache présent → POST /api/paiement avec id_facture résolu (aucun GET)', async () => {
    await db!.meta.put({ cle: 'map_facture:REC-2026-0001', valeur: '42' });
    axiosMock.request.mockResolvedValue({ data: { message: 'Paiement créé avec succès' } });

    await enregistrerMutation({
      type: 'creer_paiement',
      cible: 'api',
      endpoint: '/api/paiement',
      payload: PAYLOAD_PAIEMENT,
      cleIdempotence: 'creer_paiement:P1',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    expect(axiosMock.get).not.toHaveBeenCalled();

    const appel = axiosMock.request.mock.calls[0]?.[0];
    expect(appel?.url).toContain('/api/paiement');
    expect((appel?.data as Record<string, unknown>)['id_facture']).toBe(42);
    expect((appel?.data as Record<string, unknown>)['amount']).toBe(4.5);
  });

  test('sans cache → réconciliation live (patient puis factures) puis cache', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'ok' } });
    mockFacturesServeur([
      { id_facture: 41, patient_id: 77, date_emission: '2026-10-24 08:00:00', montant_total: 9 },
      { id_facture: 42, patient_id: 77, date_emission: '2026-10-24 09:00:00', montant_total: 9 },
    ]);

    await enregistrerMutation({
      type: 'creer_paiement',
      cible: 'api',
      endpoint: '/api/paiement',
      payload: PAYLOAD_PAIEMENT,
      cleIdempotence: 'creer_paiement:P2',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);

    const appel = axiosMock.request.mock.calls[0]?.[0];
    expect((appel?.data as Record<string, unknown>)['id_facture']).toBe(42); // plus récente
    const map = await db!.meta.get('map_facture:REC-2026-0001');
    expect(map?.valeur).toBe('42');
  });

  test('facture introuvable → ErreurAttente, JAMAIS de POST paiement orphelin', async () => {
    mockFacturesServeur([]); // facture pas encore sur le serveur
    await enregistrerMutation({
      type: 'creer_paiement',
      cible: 'api',
      endpoint: '/api/paiement',
      payload: PAYLOAD_PAIEMENT,
      cleIdempotence: 'creer_paiement:P3',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    expect(axiosMock.request).not.toHaveBeenCalled();
    const entrees = await db!.outbox.toArray();
    expect(entrees[0]?.statut).toBe('en_attente');
    expect(entrees[0]?.erreur).toContain('facture');
  });
});

describe('envoiMetier — cycle complet facture puis acompte', () => {
  beforeEach(async () => {
    axiosMock.request.mockReset();
    axiosMock.get.mockReset();
    await reinitialiserOutbox();
    await db?.meta.clear();
  });

  test('FIFO : la facture est créée, puis l\u2019acompte porte le MÊME id_facture', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'ok' } });
    mockFacturesServeur([
      { id_facture: 42, patient_id: 77, date_emission: '2026-10-24 09:00:00', montant_total: 9 },
    ]);

    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: { ...PAYLOAD_FACTURE, patient_id: 77, patient_identite: undefined },
      cleIdempotence: 'creer_facture:FC1',
    });
    await enregistrerMutation({
      type: 'creer_paiement',
      cible: 'api',
      endpoint: '/api/paiement',
      payload: { ...PAYLOAD_PAIEMENT, patient_id: 77, patient_identite: undefined },
      cleIdempotence: 'creer_paiement:PC1',
    });

    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 2, echecs: 0, attendus: 0 });
    expect(axiosMock.request).toHaveBeenCalledTimes(2);

    const [, appelPaiement] = axiosMock.request.mock.calls;
    expect((appelPaiement?.[0]?.data as Record<string, unknown>)['id_facture']).toBe(42);
  });

  test('mutation générique (creer_patient) : envoi tel quel, sans traitement spécial', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'Patient créé' } });
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom_patient: 'MBUYI' },
      cleIdempotence: 'creer_patient:PT1',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    const appel = axiosMock.request.mock.calls[0]?.[0];
    expect(appel?.url).toContain('/api/patient');
    expect(appel?.headers).toMatchObject({ 'X-Idempotence-Key': 'creer_patient:PT1' });
  });
});
