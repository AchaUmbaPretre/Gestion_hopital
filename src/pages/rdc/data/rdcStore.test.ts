/**
 * Tests du store RDC — phase 3 (facturation réelle) :
 *  - registerMouvement trace une facture calibrée backend (service_details,
 *    statut, extras RDC) + un paiement SEULEMENT s'il y a eu encaissement ;
 *  - ajouterAcompte : solde de la facture d'origine diminué, reçu
 *    d'acompte avec factureRefOrigine, trace creer_paiement SEULE
 *    (pas de seconde facture), facture_locale = facture d'origine.
 *
 * Dexie (outbox) tourne sur fake-indexeddb pour inspecter les traces.
 */

import 'fake-indexeddb/auto';

import { db } from '../../../offline/db';
import { reinitialiserOutbox } from '../../../offline/outbox';
import {
  ajouterAcompte,
  lireEtatRdc,
  registerMouvement,
  resetRdcState,
} from './rdcStore';

describe('rdcStore — facturation (phase 3)', () => {
  beforeEach(async () => {
    await reinitialiserOutbox();
    resetRdcState();
    localStorage.clear();
    resetRdcState(); // re-seed propre après purge localStorage
  });

  /**
   * Les traces store → outbox sont fire-and-forget (jamais bloquantes
   * pour l'action métier — un triage rouge s'enregistre même si
   * IndexedDB est indisponible). En test, on laisse la file vider ses
   * micro-tâches avant d'inspecter IndexedDB.
   */
  async function viderFile(): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resoudre) => setTimeout(resoudre, 10));
    }
  }

  function encaissementTotalite() {
    return registerMouvement({
      patientId: 'pat-1',
      dateIso: '2026-10-24T09:30:00.000Z',
      lignes: [{ acteId: 'act-cons-gen', libelle: 'Consultation générale', montantUsd: 5 }],
      totalUsd: 5,
      partMutuelleUsd: 0,
      ticketModerateurUsd: 5,
      mode: 'totalite',
      montantPayeUsd: 5,
      soldeUsd: 0,
      tauxFcUsd: 2850,
      modePaiement: 'especes_fc',
    });
  }

  test('registerMouvement totalité : facture + paiement tracés, statut Payée', async () => {
    const mvt = encaissementTotalite();
    expect(mvt.reference).toMatch(/^REC-\d{4}-\d{4}$/); // suite du compteur du seed

    await viderFile();
    const entrees = await db!.outbox.toArray();
    const types = entrees.map((e) => e.type).sort();
    expect(types).toEqual(['creer_facture', 'creer_paiement']);

    const facture = entrees.find((e) => e.type === 'creer_facture');
    const payload = facture?.payload as Record<string, unknown>;
    expect(facture?.endpoint).toBe('/api/factures');
    expect(payload['service_details']).toEqual([
      { service_type: 'Consultation', service_id: 0, montant: 5 },
    ]);
    expect(payload['status']).toBe('Payée');
    expect(payload['patient_id']).toBeNull(); // patient local → réconciliation au rejeu
    expect(payload['facture_locale']).toBe(mvt.reference);

    const paiement = entrees.find((e) => e.type === 'creer_paiement');
    expect(paiement?.endpoint).toBe('/api/paiement');
    expect((paiement?.payload as Record<string, unknown>)['amount']).toBe(5);
    expect((paiement?.payload as Record<string, unknown>)['transaction_id']).toBe(mvt.reference);
  });

  test('exonération (montant payé 0) : facture tracée, AUCUNE ligne de paiement', async () => {
    registerMouvement({
      patientId: 'pat-1',
      dateIso: '2026-10-24T09:30:00.000Z',
      lignes: [{ acteId: 'act-soins-acc', libelle: 'Accouchement simple', montantUsd: 30 }],
      totalUsd: 30,
      partMutuelleUsd: 0,
      ticketModerateurUsd: 30,
      mode: 'exonere',
      montantPayeUsd: 0,
      soldeUsd: 30,
      tauxFcUsd: 2850,
      motifExoneration: 'Patient indigent — FSS',
      autorisePar: 'Médecin chef',
    });
    await viderFile();
    const entrees = await db!.outbox.toArray();
    expect(entrees.map((e) => e.type)).toEqual(['creer_facture']);
    const payload = entrees[0]?.payload as Record<string, unknown>;
    expect(payload['status']).toBe('Exonérée');
    expect(payload['autorise_par']).toBe('Médecin chef');
  });

  test('ajouterAcompte : solde d\u2019origine diminué + reçu factureRefOrigine + paiement seul', async () => {
    const origine = registerMouvement({
      patientId: 'pat-1',
      dateIso: '2026-10-24T09:30:00.000Z',
      lignes: [{ acteId: 'act-sej-jour', libelle: 'Hospitalisation — journée', montantUsd: 12 }],
      totalUsd: 12,
      partMutuelleUsd: 0,
      ticketModerateurUsd: 12,
      mode: 'acompte',
      montantPayeUsd: 5,
      soldeUsd: 7,
      tauxFcUsd: 2850,
      modePaiement: 'especes_usd',
    });

    const recu = ajouterAcompte(origine.reference, 7, 'especes_fc');
    expect(recu).not.toBeNull();
    expect(recu?.factureRefOrigine).toBe(origine.reference);
    expect(recu?.montantPayeUsd).toBe(7);
    expect(recu?.soldeUsd).toBe(0);
    expect(recu?.lignes).toEqual([]); // aucun acte re-facturé
    expect(recu?.reference).not.toBe(origine.reference); // nouveau numéro de reçu

    // La facture d'origine est mise à jour (solde soldé).
    const origineApres = lireEtatRdc().mouvements.find((m) => m.reference === origine.reference);
    expect(origineApres?.soldeUsd).toBe(0);
    expect(origineApres?.montantPayeUsd).toBe(12);

    // Outbox du complément : UN SEUL paiement de 7 $, rattaché à la
    // facture d'origine (pas de creer_facture). Le paiement INITIAL
    // de 5 $ (posé par registerMouvement) porte la même facture_locale.
    await viderFile();
    const entrees = await db!.outbox.toArray();
    const paiementsSurOrigine = entrees.filter(
      (e) => e.type === 'creer_paiement' && (e.payload as Record<string, unknown>)['facture_locale'] === origine.reference,
    );
    expect(paiementsSurOrigine).toHaveLength(2); // 5 $ initial + 7 $ complément
    const complement = paiementsSurOrigine.find(
      (e) => (e.payload as Record<string, unknown>)['amount'] === 7,
    );
    expect(complement).toBeDefined();
    const paiement = complement?.payload as Record<string, unknown>;
    expect(paiement['montant_facture']).toBe(12); // critère de réconciliation de l'ORIGINE
    expect(paiement['transaction_id']).toBe(origine.reference); // trace croisée
    expect(entrees.filter((e) => e.type === 'creer_facture')).toHaveLength(1);
  });

  test('ajouterAcompte : refuse facture inconnue, soldée ou montant invalide', () => {
    const origine = registerMouvement({
      patientId: 'pat-1',
      dateIso: '2026-10-24T09:30:00.000Z',
      lignes: [],
      totalUsd: 0,
      partMutuelleUsd: 0,
      ticketModerateurUsd: 0,
      mode: 'totalite',
      montantPayeUsd: 0,
      soldeUsd: 0,
      tauxFcUsd: 2850,
    });
    expect(ajouterAcompte('REC-INEXISTANTE', 5, 'especes_fc')).toBeNull();
    expect(ajouterAcompte(origine.reference, 5, 'especes_fc')).toBeNull(); // déjà soldée
    expect(ajouterAcompte(origine.reference, 0, 'especes_fc')).toBeNull(); // montant nul
  });
});
