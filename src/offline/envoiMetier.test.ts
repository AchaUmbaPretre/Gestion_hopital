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

  test('mutation générique (maj_triage local…) : envoi tel quel, sans traitement spécial', async () => {
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

// ============================================================
// PHASE 4 — consultation & ordonnances branchées
// ============================================================

const PAYLOAD_ORDO = {
  ordonnance_locale: 'ORD-2026-0001',
  date_ordre: '2026-10-24 09:15:00',
  patient_ref: '77',
  patient_identite: { nom: 'MBUYI', prenom: 'Grace', telephone: '0998887776' },
  consultation: {
    patient_id: 77,
    personnel_id: 7,
    id_type_consultation: 3,
    nom_type_consultation: 'Consultation générale',
    date_consultation: '2026-10-24 09:15:00',
    diagnostic: 'Paludisme simple',
    notes: 'Motif : fièvre | Constantes : T° 38.5°C',
  },
  lignes: [
    {
      medicament_id: 12,
      nom_medicament: 'Paracétamol 500 mg',
      quantite: 15,
      posologie: '1 cp x 3/jour',
      duree_jours: 5,
    },
    {
      medicament_id: null,
      nom_medicament: 'Artésunate injectable 60 mg',
      quantite: 2,
      posologie: '1 fl/jour IV',
      duree_jours: 2,
    },
  ],
};

/** URL de l'appel axios.request (sans le domaine). */
function urlAppel(i: number): string {
  return String(axiosMock.request.mock.calls[i]?.[0]?.url ?? '');
}

describe('envoiMetier — creer_ordonnance (phase 4 : chaîne consultation → lignes)', () => {
  beforeEach(async () => {
    axiosMock.request.mockReset();
    axiosMock.get.mockReset();
    await reinitialiserOutbox();
    await db?.meta.clear();
  });

  test('flux complet B1 : POST consult → id, par ligne POST ordonnance + traitement', async () => {
    axiosMock.request.mockImplementation(async (cfg: { url?: string }) => {
      const url = String(cfg.url ?? '');
      if (url.endsWith('/api/consult')) {
        return { data: { message: 'consultation créée avec succès', id_consultation: 31 } };
      }
      if (url.endsWith('/api/ordonnance') || url.endsWith('/api/traitement')) {
        return { data: { message: 'ok', id_ordonnance: 1, id_traitement: 1 } };
      }
      throw new Error(`URL inattendue : ${url}`);
    });
    axiosMock.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/pharma')) {
        return {
          data: [{ id: 8, nomMedicament: 'Artésunate injectable 60 mg', stock: 25, montant: 6 }],
        } as never;
      }
      throw new Error(`GET inattendu : ${String(url)}`);
    });

    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/consult',
      payload: PAYLOAD_ORDO,
      cleIdempotence: 'creer_ordonnance:O1',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 1, echecs: 0, attendus: 0 });

    // 1 consultation + 2 lignes × (ordonnance + traitement) = 5 POST.
    expect(axiosMock.request).toHaveBeenCalledTimes(5);
    expect(urlAppel(0)).toContain('/api/consult');
    expect((axiosMock.request.mock.calls[0]?.[0]?.data as Record<string, unknown>)['patientId']).toBe(77);
    expect(
      (axiosMock.request.mock.calls[0]?.[0]?.data as Record<string, unknown>)['id_typeConsultation'],
    ).toBe(3);

    // Ligne 1 : médicament numérique direct (12).
    expect(urlAppel(1)).toContain('/api/ordonnance');
    const ligne1 = axiosMock.request.mock.calls[1]?.[0]?.data as Record<string, unknown>;
    expect(ligne1).toEqual({
      consultationId: 31,
      medicamentId: 12,
      quantite: 15,
      dateOrdre: '2026-10-24 09:15:00',
    });
    expect(urlAppel(2)).toContain('/api/traitement');
    const trait1 = axiosMock.request.mock.calls[2]?.[0]?.data as Record<string, unknown>;
    expect(trait1).toEqual({
      consultationId: 31,
      medicament: 12,
      dose: '1 cp x 3/jour',
      frequence: '',
      duree: '5',
      instructions: '',
    });

    // Ligne 2 : médicament résolu PAR NOM (8) via GET /api/pharma.
    const ligne2 = axiosMock.request.mock.calls[3]?.[0]?.data as Record<string, unknown>;
    expect(ligne2).toMatchObject({ consultationId: 31, medicamentId: 8, quantite: 2 });

    // Le médicament résolu est mis en cache (ré-utilisation sans GET).
    const map = await db!.meta.get('map_medic:artesunate injectable 60 mg');
    expect(map?.valeur).toBe('8');
    const mapConsult = await db!.meta.get('map_consult:ORD-2026-0001');
    expect(mapConsult?.valeur).toBe('31');
  });

  test('personnel_id absent → ErreurAttente, JAMAIS de médecin deviné', async () => {
    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/consult',
      payload: {
        ...PAYLOAD_ORDO,
        consultation: { ...PAYLOAD_ORDO.consultation, personnel_id: null },
      },
      cleIdempotence: 'creer_ordonnance:O2',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    expect(axiosMock.request).not.toHaveBeenCalled();
  });

  test('type inconnu → réconciliation par nom (GET consult_type)', async () => {
    axiosMock.request.mockImplementation(async (cfg: { url?: string }) => {
      const url = String(cfg.url ?? '');
      if (url.endsWith('/api/consult')) {
        return { data: { message: 'ok', id_consultation: 33 } };
      }
      return { data: { message: 'ok' } };
    });
    axiosMock.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/consult/consult_type')) {
        return {
          data: [{ id_typeConsultation: 5, nomConsultation: 'Urgence', prixConsultation: 5 }],
        } as never;
      }
      if (String(url).endsWith('/api/pharma')) {
        return { data: [{ id: 12, nomMedicament: 'Paracétamol 500 mg', stock: 10 }] } as never;
      }
      throw new Error(`GET inattendu : ${String(url)}`);
    });

    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/consult',
      payload: {
        ...PAYLOAD_ORDO,
        lignes: [PAYLOAD_ORDO.lignes[0] as Record<string, unknown>],
        consultation: { ...PAYLOAD_ORDO.consultation, id_type_consultation: null, nom_type_consultation: 'Urgence' },
      },
      cleIdempotence: 'creer_ordonnance:O3',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    const data = axiosMock.request.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data['id_typeConsultation']).toBe(5);
  });

  test('serveur antérieur à B1 (pas d id renvoyé) → réconciliation patient+date+diagnostic', async () => {
    axiosMock.request.mockImplementation(async (cfg: { url?: string }) => {
      const url = String(cfg.url ?? '');
      if (url.endsWith('/api/consult')) {
        return { data: { message: 'consultation créée avec succès' } }; // PAS d'id
      }
      return { data: { message: 'ok' } };
    });
    axiosMock.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/consult')) {
        return {
          data: [
            {
              id: 34,
              patientId: 77,
              dateConsultation: '2026-10-24 09:15:00',
              diagnostic: 'Paludisme simple',
            },
          ],
        } as never;
      }
      if (String(url).endsWith('/api/pharma')) {
        return { data: [{ id: 12, nomMedicament: 'Paracétamol 500 mg', stock: 10 }] } as never;
      }
      throw new Error(`GET inattendu : ${String(url)}`);
    });

    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/consult',
      payload: {
        ...PAYLOAD_ORDO,
        lignes: [PAYLOAD_ORDO.lignes[0] as Record<string, unknown>],
      },
      cleIdempotence: 'creer_ordonnance:O4',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    const ligne = axiosMock.request.mock.calls[1]?.[0]?.data as Record<string, unknown>;
    expect(ligne['consultationId']).toBe(34);
  });

  test('médicament introuvable → ErreurAttente PUIS rejeu SANS doublon de consultation', async () => {
    let pharmaVide = true;
    axiosMock.request.mockImplementation(async (cfg: { url?: string }) => {
      const url = String(cfg.url ?? '');
      if (url.endsWith('/api/consult')) {
        return { data: { message: 'ok', id_consultation: 31 } };
      }
      return { data: { message: 'ok' } };
    });
    axiosMock.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/pharma')) {
        return pharmaVide
          ? ({ data: [] } as never)
          : ({ data: [{ id: 8, nomMedicament: 'Artésunate injectable 60 mg', stock: 25 }] } as never);
      }
      throw new Error(`GET inattendu : ${String(url)}`);
    });

    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/consult',
      payload: PAYLOAD_ORDO,
      cleIdempotence: 'creer_ordonnance:O5',
    });

    // Cycle 1 : la consultation est créée, la ligne 2 attend le stock.
    const cycle1 = await synchroniser(envoiMetier);
    expect(cycle1).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    expect(urlAppel(0)).toContain('/api/consult');

    // Cycle 2 : le médicament est maintenant connu — la consultation
    // n'est PAS re-postée (cache map_consult), les lignes partent.
    pharmaVide = false;
    axiosMock.request.mockClear();
    const cycle2 = await synchroniser(envoiMetier);
    expect(cycle2).toEqual({ envoyes: 1, echecs: 0, attendus: 0 });
    expect(axiosMock.request.mock.calls.every((c) => !String(c[0]?.url).endsWith('/api/consult'))).toBe(
      true,
    );
  });
});

describe('envoiMetier — ids B1 (raccourcis sans réconciliation)', () => {
  beforeEach(async () => {
    axiosMock.request.mockReset();
    axiosMock.get.mockReset();
    await reinitialiserOutbox();
    await db?.meta.clear();
  });

  test('creer_patient : id_patient renvoyé → cache map_patient:<dossier>', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'Patient créé avec succès', id_patient: 55 } });
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom_patient: 'MBUYI', dossier: 'KI-2026-0001' },
      cleIdempotence: 'creer_patient:PT2',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    const map = await db!.meta.get('map_patient:KI-2026-0001');
    expect(map?.valeur).toBe('55');
  });

  test('creer_patient : id absent (serveur antérieur à B1) → pas de cache, pas d échec', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'Patient créé avec succès' } });
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom_patient: 'MBUYI', dossier: 'KI-2026-0002' },
      cleIdempotence: 'creer_patient:PT3',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    expect(await db!.meta.get('map_patient:KI-2026-0002')).toBeUndefined();
  });

  test('creer_facture : id_facture renvoyé → cache DIRECT, zéro GET de réconciliation', async () => {
    axiosMock.request.mockResolvedValue({ data: { message: 'Facture créée avec succès', id_facture: 99 } });
    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: { ...PAYLOAD_FACTURE, patient_id: 77, patient_identite: undefined },
      cleIdempotence: 'creer_facture:F4',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat.envoyes).toBe(1);
    expect(axiosMock.get).not.toHaveBeenCalled();
    const map = await db!.meta.get('map_facture:REC-2026-0001');
    expect(map?.valeur).toBe('99');
  });

  test('creer_paiement : cache patient B1 évite le GET patient (dossier disponible)', async () => {
    await db!.meta.put({ cle: 'map_patient:KI-2026-0001', valeur: '55' });
    // Aucune facture côté serveur : la réconciliation live doit échouer
    // en ErreurAttente SANS interroger /api/patient (cache utilisé).
    axiosMock.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/factures')) {
        return { data: [] } as never;
      }
      throw new Error(`GET inattendu : ${String(url)}`);
    });
    await enregistrerMutation({
      type: 'creer_paiement',
      cible: 'api',
      endpoint: '/api/paiement',
      payload: { ...PAYLOAD_PAIEMENT, dossier_patient: 'KI-2026-0001' },
      cleIdempotence: 'creer_paiement:P4',
    });
    const resultat = await synchroniser(envoiMetier);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    expect(axiosMock.get).toHaveBeenCalledTimes(1); // /api/factures SEULEMENT
    expect(String(axiosMock.get.mock.calls[0]?.[0])).toContain('/api/factures');
  });
});
