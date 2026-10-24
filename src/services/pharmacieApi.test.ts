/**
 * Tests service pharmacie API (phase 5 RDC) :
 *  - mapping défensif de la file d'ordonnances serveur (B3 : une ligne
 *    par médicament, ids exploitables, lignes mal formées ignorées) ;
 *  - mapping des mutuelles actives ;
 *  - payloads calibrés : sortie de stock NÉGATIVE (ajustement atomique
 *    GREATEST(0,…)), carnet de ventes directes, affectation mutuelle.
 */

import {
  mapOrdonnancesServeurApi,
  mapMutuellesApi,
  construirePayloadSortieStock,
  construirePayloadVenteDirecte,
  construirePayloadAffectationMutuelle,
} from './pharmacieApi';

describe('pharmacieApi — file d\u2019ordonnances serveur (B3)', () => {
  test('une ligne par médicament : ids exploitables, champs hérités mappés', () => {
    const lignes = mapOrdonnancesServeurApi([
      {
        id_ordonnance: 101,
        quantite: 6,
        dateOrdre: '2026-10-24 08:30:00',
        medicament_id: 5,
        nomMedicament: 'Paracetamol 500mg',
        prix: 0.5,
        id: 55,
        nomConsultation: 'Consultation générale',
        id_patient: 9,
        nom_patient: 'KABILA',
        prenom: 'Joseph',
        telephone: '0998887776',
      },
      {
        id_ordonnance: 102,
        quantite: 2,
        dateOrdre: '2026-10-24 08:30:00',
        medicament_id: null,
        nomMedicament: 'Autre',
        prix: 1,
        id: 55,
        nomConsultation: 'Consultation générale',
        id_patient: 9,
        nom_patient: 'KABILA',
        prenom: 'Joseph',
        telephone: '0998887776',
      },
    ]);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({
      idOrdonnance: 101,
      idConsultation: 55,
      idPatient: 9,
      idMedicament: 5,
      nomMedicament: 'Paracetamol 500mg',
      quantite: 6,
      nomPatient: 'KABILA',
      prenomPatient: 'Joseph',
    });
    expect(lignes[1]?.idMedicament).toBeNull();
  });

  test('lignes mal formées ignorées, réponse non tableau → []', () => {
    expect(mapOrdonnancesServeurApi(null)).toEqual([]);
    expect(mapOrdonnancesServeurApi([{ pas_did: true }, 'texte', null])).toEqual([]);
  });
});

describe('pharmacieApi — mutuelles (B3)', () => {
  test('mapping défensif : id + nom requis, taux par défaut 0', () => {
    const mutuelles = mapMutuellesApi([
      { id_mutuelle: 3, nom_organisme: 'Mutuelle Santé Lubumbashi', taux_couverture: 70 },
      { id_mutuelle: 4, nom_organisme: 'Sans taux' },
      { nom_organisme: 'Sans id' },
    ]);
    expect(mutuelles).toHaveLength(2);
    expect(mutuelles[0]).toEqual({ id: 3, nomOrganisme: 'Mutuelle Santé Lubumbashi', tauxCouverture: 70 });
    expect(mutuelles[1]?.tauxCouverture).toBe(0);
    expect(mapMutuellesApi('non tableau')).toEqual([]);
  });
});

describe('pharmacieApi — payloads calibrés backend', () => {
  test('sortie de stock : quantité toujours NÉGATIVE et arrondie', () => {
    expect(construirePayloadSortieStock({ idMedicament: 5, quantite: 9 })).toEqual({ id: 5, quantite: -9 });
    // Défense : une quantité positive passée par erreur reste une sortie.
    expect(construirePayloadSortieStock({ idMedicament: 5, quantite: -3 })).toEqual({ id: 5, quantite: -3 });
    expect(construirePayloadSortieStock({ idMedicament: 5, quantite: 2.7 })).toEqual({ id: 5, quantite: -3 });
  });

  test('carnet de ventes : client anonyme → null, références et total conservés', () => {
    const payload = construirePayloadVenteDirecte({
      referenceLocale: 'VTE-2026-101500',
      clientNom: '',
      lignes: [{ medicament_id: 5, nom: 'Paracetamol', quantite: 2, prix_usd: 0.5 }],
      montantTotalUsd: 1,
      tauxFcUsd: 2850,
      dateVente: '2026-10-24 10:15:00',
    });
    expect(payload).toMatchObject({
      facture_locale: 'VTE-2026-101500',
      client_nom: null,
      montant_total_usd: 1,
      taux_fc_usd: 2850,
      date_vente: '2026-10-24 10:15:00',
    });
  });

  test('affectation mutuelle : patient + mutuelle résolus, date du jour, n° adhérent', () => {
    const payload = construirePayloadAffectationMutuelle({
      patientIdServeur: 77,
      idMutuelle: 3,
      numeroAdherent: 'MSL-4432',
    });
    expect(payload['patient_id']).toBe(77);
    expect(payload['mutuelle_id']).toBe(3);
    expect(payload['numero_adherent']).toBe('MSL-4432');
    expect(payload['date_affiliation']).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const sansNumero = construirePayloadAffectationMutuelle({ patientIdServeur: 77, idMutuelle: 3, numeroAdherent: '' });
    expect(sansNumero['numero_adherent']).toBeNull();
  });
});
