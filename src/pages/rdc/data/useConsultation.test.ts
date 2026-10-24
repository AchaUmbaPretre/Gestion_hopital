/**
 * Tests résolutions de saisie (phase 4 RDC — fonctions pures de
 * useConsultation.ts). La fusion locaux ∪ serveur vit dans le store
 * (rdcStore.hydraterMedicamentsServeur) et est couverte par
 * rdcStore.test.ts.
 */

import { idMedicamentServeur, trouverTypeConsultation } from './useConsultation';
import type { Medicament } from './types';

function medLocal(surcharge: Partial<Medicament> = {}): Medicament {
  return {
    id: 'med-par',
    nom: 'Paracétamol 500 mg',
    classe: 'Antalgique',
    forme: 'cp',
    prixUsd: 0.1,
    stock: 3200,
    seuil: 500,
    source: 'local',
    ...surcharge,
  };
}

function medServeur(surcharge: Partial<Medicament> = {}): Medicament {
  return medLocal({
    id: '12',
    nom: 'Paracétamol 500 mg (serveur)',
    stock: 3100,
    seuil: 10,
    source: 'api',
    ...surcharge,
  });
}

describe('idMedicamentServeur', () => {
  it('id numérique → Number (directement réutilisable pour le POST)', () => {
    expect(idMedicamentServeur([medServeur()], '12')).toBe(12);
  });

  it('id local non numérique → null (réconciliation par nom au rejeu)', () => {
    expect(idMedicamentServeur([medLocal()], 'med-par')).toBeNull();
  });

  it('id inconnu → null', () => {
    expect(idMedicamentServeur([medLocal()], 'autre')).toBeNull();
  });
});

describe('trouverTypeConsultation', () => {
  const types = [
    { id: 3, nom: 'Consultation Générale', prixUsd: 3 },
    { id: 5, nom: 'Urgence', prixUsd: 5 },
  ];

  it('trouve par nom insensible casse/accents', () => {
    expect(trouverTypeConsultation(types, 'consultation generale')?.id).toBe(3);
    expect(trouverTypeConsultation(types, 'URGENCE')?.id).toBe(5);
  });

  it('nom vide ou inconnu → null', () => {
    expect(trouverTypeConsultation(types, '')).toBeNull();
    expect(trouverTypeConsultation(types, 'radiologie')).toBeNull();
  });
});
