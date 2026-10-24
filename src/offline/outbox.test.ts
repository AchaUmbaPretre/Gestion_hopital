/**
 * Tests de l'outbox offline (phase 1 RDC) — Dexie + fake-indexeddb :
 *  - mise en file + déduplication par clé d'idempotence ;
 *  - rejeu réussi → entrée supprimée, compteurs à zéro ;
 *  - 4xx permanent → statut « echec » (action manuelle, pas de boucle) ;
 *  - erreur réseau → retour « en_attente » (rejeu plus tard) ;
 *  - cible « local » (gap backend) → JAMAIS envoyée ;
 *  - LRU des patients récents plafonné à 200.
 */

import 'fake-indexeddb/auto';

import { db, noterPatientRecent, CAP_PATIENTS_RECENTS } from './db';
import {
  enregistrerMutation,
  synchroniser,
  reinitialiserOutbox,
  rafraichirCompteurs,
  getInstantaneSync,
  statutHttpErreur,
  ErreurAttente,
  type FonctionEnvoi,
} from './outbox';

const envoiOk: FonctionEnvoi = async () => undefined;

describe('outbox offline', () => {
  beforeEach(async () => {
    await reinitialiserOutbox();
  });

  test('met une mutation en file et expose les compteurs', async () => {
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom: 'KABONGO' },
      cleIdempotence: 'creer_patient:1',
    });
    await rafraichirCompteurs();
    expect(getInstantaneSync().enAttente).toBe(1);
    expect(getInstantaneSync().echecs).toBe(0);
  });

  test('déduplique par clé d idempotence (pas de doublon au re-rejeu)', async () => {
    const demande = {
      type: 'creer_patient',
      cible: 'api' as const,
      endpoint: '/api/patient',
      payload: { nom: 'KABONGO' },
      cleIdempotence: 'creer_patient:dedup',
    };
    await enregistrerMutation(demande);
    await enregistrerMutation(demande);
    await rafraichirCompteurs();
    expect(getInstantaneSync().enAttente).toBe(1);
    expect(await db!.outbox.count()).toBe(1);
  });

  test('synchronise : succès → entrée supprimée, horodatage posé', async () => {
    await enregistrerMutation({
      type: 'creer_ordonnance',
      cible: 'api',
      endpoint: '/api/ordonnance',
      payload: { patientId: 'KI-2026-0001' },
      cleIdempotence: 'creer_ordonnance:ORD-1',
    });
    const resultat = await synchroniser(envoiOk);
    expect(resultat).toEqual({ envoyes: 1, echecs: 0, attendus: 0 });
    expect(await db!.outbox.count()).toBe(0);
    expect(getInstantaneSync().enAttente).toBe(0);
    expect(getInstantaneSync().dernierSyncIso).not.toBeNull();
  });

  test('4xx permanent → statut « echec » (pas de boucle infinie)', async () => {
    const envoi404: FonctionEnvoi = async () => {
      throw { response: { status: 404 } };
    };
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom: 'INCONNU' },
      cleIdempotence: 'creer_patient:404',
    });
    const resultat = await synchroniser(envoi404);
    expect(resultat).toEqual({ envoyes: 0, echecs: 1, attendus: 0 });
    const entree = await db!.outbox.toArray();
    expect(entree).toHaveLength(1);
    expect(entree[0]?.statut).toBe('echec');
    expect(getInstantaneSync().echecs).toBe(1);
    // Une deuxième synchro ne retente PAS les échecs.
    const deuxieme = await synchroniser(envoiOk);
    expect(deuxieme).toEqual({ envoyes: 0, echecs: 0, attendus: 0 });
  });

  test('erreur réseau → retour « en_attente » avec essai comptabilisé', async () => {
    const envoiReseau: FonctionEnvoi = async () => {
      throw new Error('network down');
    };
    await enregistrerMutation({
      type: 'creer_patient',
      cible: 'api',
      endpoint: '/api/patient',
      payload: { nom: 'MBUYI' },
      cleIdempotence: 'creer_patient:reseau',
    });
    const resultat = await synchroniser(envoiReseau);
    expect(resultat).toEqual({ envoyes: 0, echecs: 1, attendus: 0 });
    const entree = await db!.outbox.toArray();
    expect(entree[0]?.statut).toBe('en_attente');
    expect(entree[0]?.essais).toBe(1);
  });

  test('cible « local » (gap backend) : trace conservée, JAMAIS envoyée', async () => {
    const espion = jest.fn<ReturnType<FonctionEnvoi>, Parameters<FonctionEnvoi>>();
    const envoiEspion: FonctionEnvoi = (...args) => espion(...args);
    await enregistrerMutation({
      type: 'creer_triage',
      cible: 'local',
      endpoint: null,
      payload: { niveau: 'rouge' },
      cleIdempotence: 'creer_triage:TRI-1',
    });
    const resultat = await synchroniser(envoiEspion);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 0 });
    expect(espion).not.toHaveBeenCalled();
    const entree = await db!.outbox.toArray();
    expect(entree).toHaveLength(1); // la trace reste en file
    expect(entree[0]?.statut).toBe('en_attente');
  });

  test('ErreurAttente → reste en_attente SANS consommer d\'essai (prérequis pas encore sync)', async () => {
    const envoiAttente: FonctionEnvoi = async () => {
      throw new ErreurAttente('patient local pas encore synchronisé');
    };
    await enregistrerMutation({
      type: 'creer_facture',
      cible: 'api',
      endpoint: '/api/factures',
      payload: { patient_id: null, montant_total: 5 },
      cleIdempotence: 'creer_facture:attente',
    });
    const resultat = await synchroniser(envoiAttente);
    expect(resultat).toEqual({ envoyes: 0, echecs: 0, attendus: 1 });
    const entree = await db!.outbox.toArray();
    expect(entree).toHaveLength(1);
    expect(entree[0]?.statut).toBe('en_attente');
    expect(entree[0]?.essais).toBe(0); // PAS d'essai consommé
    expect(entree[0]?.erreur).toContain('patient local');
    // Le badge ne compte PAS cela comme un échec.
    expect(getInstantaneSync().echecs).toBe(0);
  });

  test('statutHttpErreur : statut extrait, sinon null', () => {
    expect(statutHttpErreur({ response: { status: 422 } })).toBe(422);
    expect(statutHttpErreur(new Error('timeout'))).toBeNull();
    expect(statutHttpErreur(null)).toBeNull();
  });

  test('LRU patients récents : plafonné à 200', async () => {
    for (let i = 0; i < CAP_PATIENTS_RECENTS + 5; i += 1) {
      await noterPatientRecent({
        patientId: `P-${String(i).padStart(3, '0')}`,
        nom: `NOM${i}`,
        prenom: 'Test',
        consulteLe: new Date(2026, 0, 1, 0, 0, 0, i).toISOString(),
      });
    }
    expect(await db!.patientsRecent.count()).toBe(CAP_PATIENTS_RECENTS);
    // Les PLUS RÉCENTS survivent (les plus anciens sont évincés).
    expect(await db!.patientsRecent.get('P-204')).not.toBeUndefined();
    expect(await db!.patientsRecent.get('P-000')).toBeUndefined();
  });
});
