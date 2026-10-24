# Logique métier RDC — Guide d'implémentation

> **Projet** : Gestion_hopital (React CRA + AntD + Sass) · backend `api_hopital` (Express + MySQL, **non modifié**)
> **Cadrage** : réalité métier des Hôpitaux Généraux de Référence (HGR) en République Démocratique du Congo
> **Périmètre de ce document** : chaque règle métier implémentée dans le prototype des 5 écrans cœur (`/rdc/*`), sa justification, son écran et son point de branchement backend.
> **Références du brief** : connectivité ~32 %, réseau électrique défaillant, 200+ mutuelles volontaires, arrêté ministériel n°1250/2025.

---

## 1. Les trois piliers

| Pilier | Traduction concrète dans le produit |
|---|---|
| **Réalisme métier** | Le flux applicatif suit le parcours réel d'un patient à l'HGR (§2), la bidevise FC/USD (§5), les mutuelles et exonérations (§5.3–5.4), le triage 4 niveaux (§3). |
| **Résilience** | Offline-first : auto-save 30 s en localStorage (§8.1), indicateur de connexion permanent (§8.2), store client persisté, polices auto-hébergées, impression Arial sans dépendance réseau (§9). |
| **Simplicité radicale** | Chaque action critique ≤ 3 clics / ≤ 30 s (§11), corps de texte ≥ 16 px (§10), boutons d'action critiques ≥ 64 px, feedback < 100 ms, KPI fixes (pas de widgets drag & drop), pas de command palette, pas de progressive disclosure caché. |

---

## 2. Parcours patient modélisé (brief RDC 1.2)

Flux de référence et où il vit dans l'application :

```
Arrivée
  └─> TRIAGE (urgences) ou ACCUEIL consultation      [AccueilRDC /rdc]
        └─> Recherche / création patient             [PatientsRDC /rdc/patients]
              └─> PAIEMENT / PRÉ-PAIEMENT à la caisse [CaisseRDC /rdc/caisse]
                    └─> CONSULTATION                  [ConsultationRDC /rdc/consultation]
                          └─> PRESCRIPTIONS (médicaments, examens)
                                └─> PAIEMENT pharmacie/labo  [CaisseRDC]
                                      └─> RÉALISATION       [PharmacieRDC /rdc/pharmacie · Labo]
                                            └─> RÉSULTATS / DÉCISION
                                                  (retour domicile, hospitalisation, référence)
                                                        └─> PAIEMENT FINAL / SORTIE  [CaisseRDC]
```

**Trois statuts d'entrée patient** : nouveau, référé (d'un centre de santé — champ `refere`), suivi (dossier existant — la recherche retroue le dossier).

**Règle d'or appliquée** : le flux d'urgence n'est **jamais** bloqué par un motif financier (§4).

---

## 3. Triage des urgences — 4 niveaux (brief RDC Partie 5)

Implémenté dans `AccueilRDC.tsx` (`NIVEAUX_TRIAGE` dans `data/types.ts`) :

| Niveau | Délai cible | Couleur UI | Contraste texte (WCAG) |
|---|---|---|---|
| 🔴 Rouge | immédiat | fond `#FEF2F2` / plein `#DC2626` | blanc sur rouge 4.5:1 ✓ |
| 🟠 Orange | ≤ 30 min | fond `#FFF7ED` / plein `#EA580C` | blanc sur orange ✓ |
| 🟡 Jaune | ≤ 2 h | fond `#FEFCE8` / plein `#EAB308` | texte sombre `#422006` sur jaune ✓ |
| 🟢 Vert | différa ble | fond `#F0FDF4` / plein `#16A34A` | blanc sur vert ✓ |

Chaque triage est tracé : `patientId`, `niveau`, `motif`, `orientation` (services HGR : Urgences/Déchocage, Médecine interne, Chirurgie, Pédiatrie, Gynéco-obstétrique, Laboratoire, Pharmacie), horodatage.

---

## 4. Urgence vitale & paiement différé (arrêté ministériel n°1250/2025)

**Règle critique (brief RDC 1.2)** : *aucun patient en urgence vitale ne peut se voir refuser les soins pour motif financier*.

Implémentation :

1. Dans le triage, la case **« Urgence vitale — démarrer la prise en charge SANS paiement préalable »** démarre le flux sans passer par la caisse.
2. L'exception est **obligatoirement tracée** (validation bloquante si les champs sont vides) :
   - `autorisePar` : qui a autorisé (ex. chef de garde) ;
   - `motifAutorisation` : motif de l'exception ;
   - `montantDuUsd` : montant dû, régularisé a posteriori.
3. Le bouton de validation s'intitule « 🚨 Démarrer la prise en charge (sans paiement) » — le message de confirmation rappelle la trace.
4. À la caisse, le bouton **« 🚨 Urgence vitale… »** produit le même mécanisme sur un panier d'actes : montant encaissé = 0, `soldeUsd` = total dû, mention légale imprimée sur le reçu.

**Trace type** (objet `Triage` / `MouvementCaisse`, `data/types.ts`) :

```json
{
  "mode": "urgence_vitale",
  "autorisePar": "Dr. Kabongo (chef de garde)",
  "motifExoneration": "Polytraumatisé — régularisation par la famille dès son arrivée",
  "totalUsd": 12,
  "montantPayeUsd": 0,
  "soldeUsd": 12,
  "tauxFcUsd": 2850
}
```

---

## 5. Modèle financier spécifique RDC (brief RDC 1.3)

### 5.1 Bidevise FC / USD

- Les tarifs de référence sont stockés en **USD** (`Acte.prixUsd`, `Medicament.prixUsd`) et **tout montant s'affiche en FC ET USD simultanément** (composant `MoneyDual` + `formatBidevise`).
- Taux **paramétrable** depuis l'écran Caisse, persisté en `localStorage` (clé `rdc.taux_fc_usd`, défaut `2850 FC/USD`).
- Formatage français : `12,50 $ · 35 625 FC` ; FC sans décimales, séparateur espace.
- Chaque mouvement de caisse **fige le taux du jour** (`MouvementCaisse.tauxFcUsd`) — auditabilité bidevise.

### 5.2 Paiement fractionné

Le bouton **« Acompte… »** enregistre un paiement partiel : `montantPayeUsd` + `soldeUsd` (à régler à la sortie), avec mode de paiement espèces FC / espèces USD / mobile money / Illlicocash. Le reçu imprime la ligne « Échéance (acompte) » et le « Reste dû ».

### 5.3 Mutuelles de santé

- Champ « Prise en charge mutuelle » sur la fiche patient : **organisme, % de couverture, n° d'adhérent** (200+ mutuelles volontaires, cotisation moyenne ~5 USD/mois).
- À la caisse : `partMutuelleUsd = total × couverture%` et `ticketModerateurUsd = total − partMutuelleUsd`.
- Le reçu imprime la part mutuelle, le ticket modérateur et les références d'adhérent.

### 5.4 Exonération / indigents

- Champ « Statut d'exonération » sur la fiche patient (FSS, aide sociale) — **obligatoirement reporté sur la facture** (badge + mention imprimée).
- Bouton « Exonéré… » à la caisse : motif **obligatoire** + autorité tracée → badge visuel **« ✅ Prise en charge autorisée »** + mention en encadré sur le reçu.

---

## 6. Dossier patient : le « carnet » avant tout (brief RDC 1.4)

1. **Identifiant simple** généré : `INITIALES-ANNÉE-N°` (ex. `KI-2026-0007`) — lisible, dictable, imprimable sur le carnet papier (JetBrains Mono à l'écran, Arial à l'impression, chiffres tabulaires).
2. **Recherche** par NOM + PRÉNOM + **TÉLÉPHONE** + n° dossier (pas de NSS fiable en RDC) ; insensible à la casse **et aux accents** (normalisation NFD) — le personnel tape souvent sans accents.
3. **Fiche patient synthétique imprimable** (A4, Arial) destinée au carnet détenu par le patient.
4. **Aucune supposition d'email ni de smartphone** : pas de champ email dans le modèle, pas de notification push/SMS dans le prototype (téléphone = simple champ texte).
5. **Création rapide** : Nom + Prénom + Sexe + Âge estimé suffisent ; adresse/téléphone optionnels, modifiables plus tard. Le bouton « Créer ce patient » est **dans la dropdown de recherche** (zéro navigation).

---

## 7. Pharmacie & stocks (brief RDC 1.5, 3.5)

1. **Stock en temps réel** à côté de chaque médicament (écran Consultation **et** Pharmacie) :
   - 🔴 `rupture` : stock = 0 · 🟠 `bas` : stock ≤ seuil · 🟢 `ok`.
   - Les alertes agrégées s'affichent sur l'Accueil et en tête de l'écran Pharmacie.
2. **Alternative thérapeutique en cas de rupture** : `trouverAlternative()` propose un médicament de la **même classe thérapeutique**, disponible, au prix le plus proche, substituable en 1 clic (`substituerLigne`). La délivrance est **bloquée** tant qu'une ligne est en rupture — jamais de décrément partiel silencieux.
3. **Vente directe** (patient externe sans consultation) : panier + encaissement + ticket — flux complet à droite de l'écran Pharmacie.
4. La **délivrance décrémente le stock** et génère le ticket imprimable (bidevise).

---

## 8. Résilience technique (brief RDC Partie 4)

### 8.1 Auto-save 30 s (coupures d'électricité)

- Hook `useDraftAutosave` (`hooks.ts`) : écrit le brouillon de consultation en `localStorage` **toutes les 30 s**, à la fermeture de l'onglet et au démontage.
- Clé par patient : `rdc.draft.consultation.<idPatient>` ; indicateur « 💾 Brouillon enregistré à HH:MM » affiché en permanence.
- Au retour sur l'écran, si un brouillon existe : proposition **« Reprendre le brouillon »** / « Recommencer à zéro » avec horodatage.
- Le store applicatif entier (`rdcStore`) est aussi persisté (`rdc.store.v1`) : les patients créés, triages et paiements du prototype survivent à un arrêt machine.

### 8.2 Indicateur de connexion permanent

- Hook `useOnlineStatus` : 🟢 **En ligne** / 🟠 **Mode dégradé** (2G/slow-2g via `navigator.connection`) / 🔴 **Hors ligne** (events `online`/`offline` + sondage 15 s).
- Affiché dans l'en-tête des **5 écrans** (jamais dans un menu).

### 8.3 Feuille de route offline (phases de migration)

| Brique | État prototype | Migration |
|---|---|---|
| Auto-save localStorage | ✅ fait | conserver tel quel |
| Store client persisté | ✅ fait (mock) | remplacé par IndexedDB (Dexie) + React Query |
| Service Worker app shell | ❌ | Workbox (precache + runtime cache) |
| Background Sync | ❌ | file d'écriture différée (mutations en attente) |
| Timeout 8 s + retry ×3 backoff exponentiel | ❌ | interceptor axios (config.js) |

### 8.4 Optimisation réseau (spécification de branchement)

Pagination agressive, requêtes en batch (10 patients/requête), compression gzip/brotli côté serveur, aucune image lourde — les écrans prototype n'chargent **aucune ressource réseau** (polices auto-hébergées via `@fontsource`, données locales).

---

## 9. Impression (brief RDC 4.3)

Pattern `.print-zone` (`design-system/typography.scss`) : à l'impression, **seul le document sort**, toute l'interface est masquée (`visibility` + `.no-print`).

| Document | Format | Écran | Style |
|---|---|---|---|
| Reçu / facture | A4 | Caisse | Arial 12 pt, noir/blanc, mention exonération/urgence encadrée |
| Ordonnance | A5 | Consultation | compact, **posologie en gras** (info vitale) |
| Fiche carnet patient | A4 | Patients | identification complète + statut mutuelle/exonération |
| Ticket pharmacie | ticket | Pharmacie | lignes, total bidevise, taux du jour |

Règles : Arial/Helvetica (`--font-print`), noir sur blanc, `page-break-inside: avoid` sur les lignes de tableaux, jamais d'italique sur posologies et montants.

---

## 10. Typographie & accessibilité (brief RDC Partie 2)

Implémenté dans `design-system/typography.scss` (surcharge non destructive par cascade des tokens existants) :

- **Corps ≥ 16 px** partout (les tokens historiques en 14 px sont remontés) ; sur mobile, les tailles secondaires remontent aussi à 16 px (`@media max-width 640px`).
- **Interligne ≥ 1.5** (`--line-height-normal: 1.5`).
- Piles : `--font-sans` (Inter → system-ui → Arial), `--font-mono` (JetBrains Mono → ui-monospace), `--font-print` (Arial) — auto-hébergées `@fontsource`, **zéro CDN** (offline).
- **Pas d'italique** sur les informations critiques (`.text-critical`, `i/em` normalisés) ; jamais de graisse < 400.
- JetBrains Mono + `tabular-nums` + `zero` feature sur IDs, dossiers et montants (confusion 0/O, 1/l évitée).
- Contrastes WCAG AA minimum (tokens sémantiques existants, ex. texte danger `#DC2626` = 4.53:1) ; boutons critiques ≥ 64 px.

---

## 11. Règle des 3 clics — vérification par écran

| Écran | Action critique | Chemin | Clics |
|---|---|---|---|
| Accueil `/rdc` | Démarrer une urgence | bouton URGENCE → remplir → « Démarrer la prise en charge » | **3** |
| Accueil `/rdc` | Aller en pharmacie | bouton PHARMACIE → … | **1** |
| Patients `/rdc/patients` | Retrouver un patient | taper ≥ 2 car. → cliquer le résultat | **2** |
| Patients `/rdc/patients` | Créer un patient | taper → « Créer ce patient » → « Créer le patient » | **3** |
| Caisse `/rdc/caisse` | Encaisser totalité | cocher actes → « Payé totalité » → Imprimer | **3** |
| Caisse `/rdc/caisse` | Urgence vitale | « Urgence vitale… » → motif → Autoriser | **3** |
| Consultation | Ordonnance imprimée | remplir prescription → « Enregistrer et imprimer l'ordonnance » | **2** |
| Pharmacie | Délivrer une ordonnance | « Délivrer » → Imprimer | **2** |
| Pharmacie | Substituer une rupture | « Délivrer » → « Substituer » → « Délivrer » | **3** |

Feedback visuel immédiat (< 100 ms) : états hover/active des boutons géants, badges de stock live, toasts de confirmation, badge « Prise en charge autorisée », indicateur d'autosave.

---

## 12. Correspondance prototype ↔ API réelle `api_hopital` (non modifiée)

Le prototype tourne sur un store local mocké ; chaque action correspond à un endpoint existant ou à un **gap à combler côté backend (dans une future version du backend, hors périmètre actuel)** :

| Action prototype | Endpoint `api_hopital` | État |
|---|---|---|
| Recherche / liste patients | `GET /patients` (`patient.model.js getPatient`) | ✅ branchable tel quel |
| Création patient | `POST /patients` (`createPatient` — nom, prenom, sexe, tel…) | ✅ branchable (âge estimé → `dateNaissance` approximée ou nouveau champ) |
| Détail patient | `GET /patients/:id` (`getPatientOne`) | ✅ |
| Médicaments + stock | `GET /pharma` (`medicament.nomMedicament, stock`) | ✅ branchable |
| Création ordonnance | `POST /ordonnance` (`ordonnance.model.js`) | ✅ branchable |
| Facture | `POST /factures` + `insertFactureDetails` | ✅ branchable |
| Paiement | `POST /paiement` (`id_facture, amount, methode_paiement`) | ✅ branchable (`methode_paiement` porte « Espèces FC/USD / Mobile money ») |
| **Bidevise FC/USD + taux paramétrable** | — | ⚠️ gap : stocker le taux sur `paiements` (colonne `taux`) |
| **Mutuelle (organisme, %, n° adhérent)** | — | ⚠️ gap : tables `mutuelle` + `patient_mutuelle` |
| **Exonération / statut FSS** | — | ⚠️ gap : champs `exonere`, `motif_exoneration`, `autorise_par` sur `factures` |
| **Triage 4 niveaux + urgence vitale** | — | ⚠️ gap : table `triage` (niveau, motif, orientation, urgence_vitale, autorise_par) |
| **Stock temps réel + seuils + alternatives** | stock présent mais sans seuil/classe | ⚠️ gap : colonnes `seuil`, `classe_therepeutique` sur `medicament` |
| **Patient référé (centre de santé)** | `typepatient` existe | ✅ branchable via `typePatient` |

> ⚠️ Ces gaps backend sont **hors périmètre** (le backend est gelé) : ils sont listés pour le plan de migration §phase 2+ et devront faire l'objet d'une évolution API coordonnée avec l'équipe backend.

---

## 13. Ce qui est volontairement NON fait (brief RDC Partie 5)

- ❌ Command Palette ⌘K → remplacée par des boutons visibles et une recherche unique.
- ❌ Dark mode prioritaire (bonus conservé via les tokens existants, mode clair = standard).
- ❌ Widgets dashboard drag & drop → KPI fixes (écran Accueil).
- ❌ Progressive disclosure poussé → sections pliables **ouvertes par défaut** sur les infos courantes (Motif, Prescriptions).
- ❌ Intégrations email/SMS → champ « Téléphone » uniquement.
- ❌ Animations gadget → transitions ≤ 150 ms, sobres, `prefers-reduced-motion` respecté.
