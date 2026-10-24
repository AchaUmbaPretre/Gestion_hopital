/**
 * Tests du store RDC — phases 3-4 :
 *  - phase 3 : registerMouvement trace une facture calibrée backend
 *    (service_details, statut, extras RDC) + un paiement SEULEMENT
 *    s'il y a eu encaissement ; ajouterAcompte : solde de la facture
 *    d'origine diminué, reçu d'acompte avec factureRefOrigine, trace
 *    creer_paiement SEULE (pas de seconde facture) ;
 *  - phase 4 : hydraterMedicamentsServeur (« local gagne ») ;
 *    addOrdonnance trace le payload STRUCTURÉ de la chaîne réelle
 *    (consultation → lignes ordonnance + traitement).
 *
 * Dexie (outbox) tourne sur fake-indexeddb pour inspecter les traces.
 */

import 'fake-indexeddb/auto';

import { db } from '../../../offline/db';
import { reinitialiserOutbox } from '../../../offline/outbox';
import type { Patient } from './types';
import {
  ajouterAcompte,
  hydraterMedicamentsServeur,
  lireEtatRdc,
  registerMouvement,
  resetRdcState,
  addOrdonnance,
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

describe('rdcStore — consultation & ordonnances (phase 4)', () => {
  beforeEach(async () => {
    await reinitialiserOutbox();
    resetRdcState();
    localStorage.clear();
    resetRdcState(); // re-seed propre après purge localStorage
  });

  async function viderFile(): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resoudre) => setTimeout(resoudre, 10));
    }
  }

  test('hydraterMedicamentsServeur : ajoute les ids numériques, NE détruit PAS le stock local', () => {
    const avant = lireEtatRdc().medicaments;
    const stockLocalPar = avant.find((m) => m.id === 'med-par');
    hydraterMedicamentsServeur([
      { id: '12', nom: 'Paracétamol 500 mg (serveur)', classe: '—', forme: '—', prixUsd: 0.1, stock: 9999, seuil: 10, source: 'api' },
      { id: '55', nom: 'Vitamine BComplexe', classe: '—', forme: '—', prixUsd: 0.5, stock: 300, seuil: 10, source: 'api' },
    ]);

    const apres = lireEtatRdc().medicaments;
    expect(apres.find((m) => m.id === '55')).toBeDefined(); // ajouté
    expect(apres.find((m) => m.id === '12')).toBeDefined(); // ajouté (id numérique inconnu)
    expect(apres.find((m) => m.id === 'med-par')?.stock).toBe(stockLocalPar?.stock); // seed intact

    // Hydratation idempotente : pas de doublon au second appel.
    hydraterMedicamentsServeur([
      { id: '55', nom: 'Vitamine BComplexe', classe: '—', forme: '—', prixUsd: 0.5, stock: 300, seuil: 10, source: 'api' },
    ]);
    expect(lireEtatRdc().medicaments.filter((m) => m.id === '55')).toHaveLength(1);
  });

  test('addOrdonnance : payload structuré pour la chaîne consultation → lignes', async () => {
    // Patient du seed = LOCAL (dossier INIT-ANNÉE-N°) → patient_id null
    // dans le payload de consultation : le rejeu réconciliera par
    // identité (nom + prénom + téléphone) — jamais de dossier imprimable
    // envoyé à la colonne INT MySQL.
    const patientLocal = lireEtatRdc().patients[0] as Patient;

    const ordo = addOrdonnance({
      patientId: patientLocal.id,
      medecin: 'Dr Jean Kabasele',
      service: 'Chirurgie',
      dateIso: '2026-10-24T09:15:00.000Z',
      lignes: [{ medicamentId: 'med-par', posologie: '1 cp x 3/jour', dureeJours: 5, quantite: 15 }],
      statut: 'en_attente',
      typeConsultationId: 3,
      typeConsultationNom: 'Consultation générale',
      personnelId: 7,
      diagnostic: 'Paludisme simple',
      notes: 'Motif : fièvre',
    });
    expect(ordo.id).toMatch(/^ORD-\d{4}-\d{4}$/);

    await viderFile();
    const entree = (await db!.outbox.toArray()).find((e) => e.type === 'creer_ordonnance');
    expect(entree?.endpoint).toBe('/api/consult'); // le POST INITIAL est la consultation
    const payload = entree?.payload as Record<string, unknown>;
    expect(payload['ordonnance_locale']).toBe(ordo.id);
    expect(payload['date_ordre']).toBe('2026-10-24 09:15:00');
    const consultation = payload['consultation'] as Record<string, unknown>;
    expect(consultation['patient_id']).toBeNull(); // patient local → réconciliation au rejeu
    // L'identité de réconciliation voyage TOUJOURS (nom + prénom + tel).
    const identite = payload['patient_identite'] as Record<string, unknown>;
    expect(identite['nom']).toBe(patientLocal.nom);
    expect(identite['prenom']).toBe(patientLocal.prenom);
    expect(consultation['personnel_id']).toBe(7); // JAMAIS deviné au rejeu
    expect(consultation['id_type_consultation']).toBe(3);
    expect(consultation['diagnostic']).toBe('Paludisme simple');

    // Ligne : l'id numérique du médicament est résolu ici quand connu ;
    // le seed 'med-par' est LOCAL → null + nom pour réconciliation par nom.
    const ligne = (payload['lignes'] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    expect(ligne['medicament_id']).toBeNull();
    expect(ligne['nom_medicament']).toBe('Paracétamol 500 mg');
    expect(ligne['quantite']).toBe(15);
    expect(ligne['posologie']).toBe('1 cp x 3/jour');
    expect(ligne['duree_jours']).toBe(5);
  });

  test('addOrdonnance : médicament serveur hydraté → medicament_id numérique direct', async () => {
    hydraterMedicamentsServeur([
      { id: '12', nom: 'Paracétamol 500 mg (serveur)', classe: '—', forme: '—', prixUsd: 0.1, stock: 100, seuil: 10, source: 'api' },
    ]);
    addOrdonnance({
      patientId: '77',
      medecin: 'Dr Kabongo',
      service: 'Médecine interne',
      dateIso: '2026-10-24T10:00:00.000Z',
      lignes: [{ medicamentId: '12', posologie: '1 cp x 2/jour', dureeJours: 3, quantite: 6 }],
      statut: 'en_attente',
      typeConsultationId: null,
      typeConsultationNom: 'Consultation générale',
      personnelId: 7,
      diagnostic: '',
      notes: '',
    });
    await viderFile();
    const payload = ((await db!.outbox.toArray()).find((e) => e.type === 'creer_ordonnance')?.payload ??
      {}) as Record<string, unknown>;
    const ligne = (payload['lignes'] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    expect(ligne['medicament_id']).toBe(12); // directement réutilisable par le rejeu
  });
});
