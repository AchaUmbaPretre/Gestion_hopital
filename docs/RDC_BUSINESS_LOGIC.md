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

## 14. Infrastructure offline livrée (phase 1 — brief Partie 4)

> Implémentation concrète de la résilience : coupures réseau (connexion ~32 %)
> ET coupures d'électricité. **Aucune écriture métier n'est jamais perdue.**

### 14.1 Persistance et Service Worker

| Couche | Rôle |
|---|---|
| Store local (localStorage) | État métier du prototype : patients, triages, ordonnances, mouvements de caisse — survit aux coupures (déjà phase 0). |
| **IndexedDB / Dexie** (`src/offline/db.ts`) | `outbox` (file d'écriture différée), `patients_recent` (LRU 200 — base du cache React Query phase 2), `meta`. |
| **Service Worker** (`src/service-worker.ts`) | Précache de l'app shell complet (l'app démarre sans réseau) ; GET `/api/*` en **NetworkFirst** (timeout 8 s, cache 7 j, purge sur quota) — un dossier déjà consulté reste consultable hors ligne. |

### 14.2 File d'écriture différée (outbox) — règles

1. Chaque action métier trace une mutation avec **clé d'idempotence** (déduplication).
2. Cible **`api`** (endpoints existants : `POST /patients`, `/ordonnance`, `/factures`, `/paiement`) → rejeu automatique.
3. Cible **`local`** (gaps backend : triage, mutuelle, exonération, décrément stock, vente directe) → trace conservée en file + imprimée sur les documents — **zéro perte d'information**, rejeu dès que le backend expose l'endpoint.
4. Rejeu déclenché par : retour du réseau, **Background Sync** (même onglet fermé), démarrage, sondage 60 s. Lots de 50 ; en-tête `X-Idempotence-Key` pour dédupliquer côté serveur.
5. Statuts visibles (badge permanent TopBar + en-têtes RDC) : « N en attente de synchronisation » (orange), « Synchronisation… » (bleu), « N échec(s) » (rouge — rejet serveur 4xx, action manuelle, jamais une boucle silencieuse).

### 14.3 Résilience réseau axios (`src/services/resilience.ts`)

- Timeout **8 s** (réseau HGR instable : ne pas faire attendre 2 min) ;
- retry **×3 backoff exponentiel** (1 s / 2 s / 4 s) ;
- rejeu **GET uniquement** et uniquement sur erreurs transitoires (réseau, timeout, 5xx, 429, 408) ;
- **un POST n'est jamais re-joué aveuglément** : doubler un encaissement est inacceptable — les mutations passent par l'outbox avec clé d'idempotence ;
- compression gzip/brotli : gérée par le navigateur (Accept-Encoding), rien à activer côté client.

### 14.4 Frontière testée

25 suites / 120 tests verts, dont 15 nouveaux : mise en file + compteurs, dédup
par idempotence, rejeu réussi, 4xx → « echec » (pas de boucle), erreur réseau →
rejeu différé, cible `local` jamais envoyée, LRU patients récents plafonné à 200.

## 15. Branchement API réelle — patients (phase 2)

> `api_hopital` reste **gelé** : cette phase adapte le front aux endpoints
> existants. Nouvelles suites : `src/services/patientsApi.test.ts` +
> `src/pages/rdc/data/usePatients.test.ts` — 27 suites / 148 tests verts.

### 15.1 Endpoints consommés (sans modification backend)

| Besoin | Endpoint existant | Limite acceptée |
|---|---|---|
| Liste de travail | `GET /api/patient` | **pas de param de recherche serveur** → filtrage local instantané sans accents (gap « param q » ajouté à la liste des gaps pour les gros volumes) |
| Types de patient (FK du POST) | `GET /api/patient/type` | sert de valeur par défaut du formulaire rapide |
| Historique factures | `GET /api/factures` | filtrage client par `patient_id` |
| Historique consultations | `GET /api/consult` | filtrage client par `patientId` |
| Création | `POST /api/patient` | via **outbox** (jamais de POST direct), payload mappé sur les 15 colonnes destructurées par le contrôleur |

### 15.2 Architecture de données (offline-first inchangée)

1. **Le store local reste la source de vérité de la journée** : rendu
   instantané, fonctionne 100 % hors ligne, alimente l'outbox.
2. La liste serveur arrive via **React Query** (`['rdc','patients']`,
   staleTime 5 min, retry `false` — axios a déjà re-joué ×3) et est
   **fusionnée** avec le store : dédup par identité (nom + prénom
   normalisés sans accents + 9 derniers chiffres du téléphone).
3. **Le patient LOCAL gagne le doublon** : il porte le dossier imprimable
   INIT-ANNÉE-N°, les actes du jour et les statuts mutuelle/exonération
   saisis localement. Aucun doublon visible à l'écran après sync.
4. Cache HTTP NetworkFirst du Service Worker (phase 1) + cache React
   Query : la liste reste consultable hors ligne sans configuration
   supplémentaire ; le champ `source: 'api' | 'local'` distingue l'origine.

### 15.3 Création rapide branchée

- Création = écriture locale immédiate (≤ 30 s garanti, même hors ligne)
  + trace outbox `creer_patient` cible `api` → **rejeu immédiat si en
  ligne** (`lancerSynchronisation()`), sinon au retour réseau.
- Payload : les 15 colonnes MySQL (`nom_patient`, `prenom`,
  `dateNaissance`, `lieuNaissance`, `sexe`, `province`, `adresse`, `tel`,
  `email`, `societePatient`, `assurance`, `profession`, `typePatient`,
  `groupeSanguin`, `img`) + extras RDC d'audit (`dossier`, `age_estime`,
  `refere`, `source`) — ignorés par le backend actuel, prêts pour les
  colonnes à venir.
- **`dateNaissance` APPROCHÉE** (1er janvier de l'année déduite de l'âge
  estimé) : satisfait la colonne NOT NULL sans inventer une DDN
  vérifiée — l'âge estimé reste la référence affichée (réalité RDC).
- **`typePatient`** : premier type exposé par `GET /api/patient/type`,
  null si l'API est injoignable (le rejeu échouera alors visiblement :
  badge « échec », trace conservée — zéro perte, réglage manuel).

### 15.4 Fiche 360° — historique des passages

- **Actes du jour (store local)** : caisse (avec mention « Urgence
  vitale — paiement différé » et solde dû), ordonnances (statut
  pharmacie), triages (niveau + urgence vitale) — toujours disponibles.
- **Historique serveur** : consultations (type, médecin, prix) +
  factures (n°, statut, montant) filtrés par patient. `Promise.allSettled` :
  un endpoint en panne ne prive pas le soignant de tout l'historique.
- Les patients créés hors ligne (dossier INIT-ANNÉE-N°) n'interrogent
  pas le serveur (id non numérique) : leur historique jour est déjà
  couvert par le store — ils apparaîtront côté serveur après sync.
- Affichage bicolonne FC/USD (MoneyDual), 20 passages max, bandeau
  explicite si serveur injoignable (+ bouton Réessayer).

### 15.5 Nouveaux gaps backend constatés (négociation à prévoir)

| Gap | Pourquoi |
|---|---|
| `GET /patients?q=` | le filtrage serveur deviendra nécessaire au-delà de quelques milliers de patients (la liste complète transite aujourd'hui) |
| Colonne `dossier` | le dossier INIT-ANNÉE-N° reste généré côté front ; sans colonne, l'ID MySQL (numérique) s'affiche pour les fiches serveur |
| Dédupe serveur par `X-Idempotence-Key` | le backend actuel l'ignore : un rejeu après 4xx réussi peut créer un doublon physique (limité par la dédup UI) |

## 16. Branchement API réelle — caisse & facturation (phase 3)

### 16.1 Endpoints consommés (backend gelé, adapté côté front)

| Endpoint | Usage phase 3 |
|---|---|
| `POST /api/factures` | une facture par passage en caisse (contrôleur : `patient_id, date_emission, date_limite, montant_total, status` ; modèle : `req.body.service_details`) |
| `POST /api/paiement` | chaque encaissement (`id_facture, amount, date_paiement, methode_paiement, transaction_id`) |
| `GET /api/factures` | réconciliation des ids + historique 360° (JOIN `patient.nom_patient`) |
| `GET /api/paiement` | encaissements joints aux factures de la fiche 360° |

### 16.2 Correspondance des champs (front RDC → colonnes MySQL)

- **`service_details`** (SNAKE_CASE — le destructuring `serviceDetails`
  du contrôleur n'est PAS celui lu par `insertFactureDetails`) :
  `{ service_type: <catégorie HGR>, service_id: 0, montant: <USD> }`.
  `service_id = 0` : la caisse facture des actes tarifés, il n'existe
  ni enregistrement de consultation ni ligne de médicament source à ce
  stade (le formulaire hérité FormFactures.jsx soumet lui aussi des
  service_id vides) ; `GET /api/factures/one` affichera « Unknown
  Service » pour ces lignes, le montant reste intact.
- **`status`** : `Payée` (totalité / acompte soldé), `Partielle`
  (acompte à découvert), `Exonérée` (statut d'exonération), `En
  attente` (urgence vitale — paiement différé). Conventions de
  l'écran hérité FactureDetail.jsx.
- **`date_limite`** : jour même si rien n'est dû, sinon +15 jours
  (acompte, régularisation d'urgence vitale).
- **`amount` / `montant_total`** : en USD, devise de référence des
  tarifs ; l'encaissement FC est converti au taux TRACÉ dans le
  payload (`taux_fc_usd`) — audit bidevise.
- **`methode_paiement`** : `especes_fc` / `especes_usd` /
  `mobile_money` (mobile money ou Illlicocash).
- **`transaction_id`** : référence du reçu local (`REC-ANNÉE-N°`) —
  trace croisée reçu imprimé ↔ ligne serveur, en attendant une
  colonne dédiée.
- **Extras RDC dans le payload** (ignorés par le backend actuel,
  prêts pour les colonnes à venir — zéro perte) : `facture_locale`,
  `dossier_patient`, `patient_identite`, `part_mutuelle`,
  `ticket_moderateur`, `mutuelle` (organisme, %, n° adhérent),
  `motif_exoneration`, `autorise_par`, `taux_fc_usd`, `source`.

### 16.3 Réconciliation des identifiants (contrainte : POST /factures ne renvoie pas d'id)

Le contrôleur répond `{ message: 'Facture créée avec succès' }` sans
l'id créé ; les acomptes exigent pourtant l'`id_facture` serveur.
Deux niveaux de résolution, à l'ENVOI (jamais à la mise en file) :

1. **Cache IndexedDB** (`meta map_facture:<référence>`) : rempli dès
   que la réconciliation d'une facture a réussi — les acomptes
   suivants partent sans aucun GET supplémentaire.
2. **Correspondance live** sur GET /api/factures : même patient_id,
   même montant (±0,01 USD), même date d'émission (préfixe), en
   excluant les ids déjà appariés (anti double-appariement si deux
   factures identiques le même jour) ; la plus récente non appariée
   gagne. Ambiguïté résiduelle documentée (§16.5).

Le **patient** suit la même logique : id numérique direct s'il vient
de l'API, sinon correspondance par identité (nom + prénom normalisés
sans accents + téléphone — même clé que la fusion d'écran Patients)
sur GET /api/patient. L'ordre FIFO de l'outbox garantit que la
création patient est rejouée AVANT la première facture.

**ErreurAttente** : un prérequis manquant (patient pas encore
synchronisé, facture pas encore visible côté serveur) met l'entrée en
attente SANS consommer d'essai — jamais de paiement orphelin, jamais
de bascule en « echec » pour une simple question d'ordre. Entrées
antérieures à la phase 3 (payloads prototype, sans identité de
réconciliation) : elles restent en attente visibles dans le badge,
sans pollution du serveur ; purge possible via la réinitialisation de
démonstration.

### 16.4 Acomptes multiples (paiement fractionné — réalité RDC)

- Dépose d'acompte à l'admission → facture `Partielle` + première
  ligne `paiements` ; solde réglé à la sortie → `ajouterAcompte()`
  déduit du solde de la facture d'origine et n'émet qu'une ligne
  `paiements` supplémentaire — JAMAIS une seconde facture.
- L'écran Caisse affiche le bandeau « Solde en cours » (facture
  REC-…, reste dû en FC + USD) avec bouton « Régler / compléter ce
  paiement » : 1 clic sur le bandeau, montant pré-rempli au solde,
  encaissement — 3 clics au total.
- Reçu d'acompte : variante imprimée « Acompte — facture REC-… » avec
  encaissé + reste dû, SANS re-détail des actes (facturés une seule
  fois).
- L'exonération et l'urgence vitale ne créent PAS de ligne de
  paiement (montant encaissé 0 = bruit en base) : la facture porte le
  statut et le solde, la trace (autorité + motif) voyage dans le
  payload et s'imprime sur le reçu.

### 16.5 Gaps backend constatés (négociation à prévoir)

| Gap | Impact | Contournement actuel |
|---|---|---|
| POST /factures ne renvoie pas l'id créé | acomptes sans id direct | réconciliation (§16.3) — robuste mais un GET /factures par cycle |
| Colonnes mutuelle / exonération / taux / référence absentes | audit partiel en base | extras dans le payload + trace imprimée sur le reçu |
| `service_details.service_id = 0` | lignes « Unknown Service » dans GET /factures/one | montants intacts ; la résolution par référentiel d'actes est un gap à ouvrir |
| Dédupe `X-Idempotence-Key` ignoré côté serveur | doublon possible si un POST 4xx-raté est réémis après correction | dédup UI par clé d'idempotence + visibilité du badge |
| Ambiguïté de réconciliation (2 factures identiques même jour même patient) | appariement à la plus récente non appariée | cache rempli à la création : le premier appariement est quasi certain ; cas limite documenté |
| `GET /patients?q=` (déjà §15.5) | — | filtrage local |

### 16.6 Vérification des 3 clics (caisse, phase 3 incluse)

1. **Totalité** : patient → cocher actes → « Payé totalité » → reçu —
   3 interactions clavier/souris après sélection patient.
2. **Acompte** : patient → « Acompte… » (montant pré-rempli) → OK — 2
   clics ; régler un solde existant : bandeau → « Régler / compléter »
   → OK — 2 clics.
3. **Urgence vitale** : patient → « Urgence vitale… » → motif +
   autorité → « Autoriser la prise en charge » — jamais bloqué par le
   paiement (arrêté n°1250/2025), trace complète, badge « Prise en
   charge autorisée ».

## 17. Branchement API réelle — consultation & ordonnances (phase 4)

### 17.1 Endpoints consommés (api_hopital, mise à niveau B1)

| Endpoint | Usage phase 4 |
|---|---|
| `GET /api/consult/consult_type` | types de consultation (nom + prix → liste de l'écran, réconciliation par nom) |
| `GET /api/docteur` | médecins (réponse enveloppée `{success, data}` — id `users.id` requis par POST /consult) |
| `GET /api/pharma` | stock temps réel → hydratation du store (`hydraterMedicamentsServeur`, « local gagne ») |
| `POST /api/consult` | `{patientId, personnelId, id_typeConsultation, dateConsultation, diagnostic, notes}` → **id_consultation renvoyé (B1)** |
| `POST /api/ordonnance` | `{consultationId, medicamentId, quantite, dateOrdre}` — UNE ligne par médicament |
| `POST /api/traitement` | `{consultationId, medicament, dose, frequence, duree, instructions}` — OBLIGATOIRE : `GET /api/ordonnance/one` fait un INNER JOIN traitement |

**Mise à niveau backend B1 (commit api_hopital 2b9da37, autorisée par le
propriétaire)** : tous les POST renvoient désormais l'id créé
(`id_patient`, `id_consultation`, `id_ordonnance`, `id_traitement`,
`id_paiement`, `id_facture`) — les modèles créateurs ont été convertis
au style callback (le package `mysql` ne renvoie RIEN via
`await pool.query()` sans callback) ; `GET /api/patient?q=` recherche
nom/prénom/téléphone ; `POST /api/pharma/stock` ajuste le stock de
façon atomique (jamais négatif) — prêt pour la phase 5.

### 17.2 Chaîne de synchronisation `creer_ordonnance`

Un SEUL type métier dans l'outbox couvre la chaîne réelle (rejeu
`offline/envoiMetier.ts → envoyerOrdonnance`) :

1. **Patient serveur** : numérique dans le payload, cache B1
   (`map_patient:<dossier>`) sinon réconciliation identité — sinon
   ErreurAttente (FIFO : le patient est toujours traité avant).
2. **Médecin** (`personnel_id`) : JAMAIS deviné — si la liste des
   médecins n'a jamais été chargée sur ce poste, ErreurAttente
   explicite (l'attribution d'un acte médical est une donnée légale).
3. **Type de consultation** : id numérique, sinon réconciliation par
   nom normalisé (GET consult_type).
4. **POST /api/consult** → `id_consultation` (B1) ; secours : le POST
   n'est JAMAIS relancé — réconciliation patient+date+diagnostic ;
   l'id est mis en cache (`map_consult:<ordonnance_locale>`) : un
   cycle interrompu (ligne en attente) ne crée JAMAIS de doublon de
   consultation.
5. **PAR ligne** : id médicament (numérique direct, cache
   `map_medic:<nom>` ou correspondance par nom sur GET /api/pharma) →
   POST /api/ordonnance + POST /api/traitement (clés d'idempotence
   dérivées `cle:ordo:i` / `cle:trait:i` — le dédupe serveur B2 les
   rend définitifs).

Tout prérequis manquant → ErreurAttente : l'entrée attend SANS
consommer d'essai, jamais d'ordonnance partielle.

### 17.3 Écran Consultation (réel)

- Bandeau référentiels TOUT VISIBLE : Type de consultation (avec
  prix USD) + Médecin — listes du dernier cache SW hors ligne, défaut
  = premier de la liste, jamais modifié derrière le dos de l'agent.
- Médicaments = stock HYDRATÉ (serveur + seed local, décréments du
  jour préservés) ; badges de stock et alternatives inchangés.
- Notes cliniques complètes dans la colonne `notes` : motif,
  antécédents, constantes (T°/TA/pouls/poids), observations — la
  traçabilité ne se limite pas au diagnostic structuré.
- Auto-save 30 s + restauration INCHANGÉS (anti-coupure).

### 17.4 Gaps restants (mise à jour après B1 + B2)

| Gap | État |
|---|---|
| ~~POST sans id créé~~ | ✅ B1 résolu (frontend consomme, fallback réconciliation conservé) |
| ~~GET /patients?q=~~ | ✅ B1 résolu (consommation frontend à la phase 5) |
| ~~Décrément de stock~~ | ✅ B1 (`POST /api/pharma/stock`) — **branché phase 5** (délivrance + vente directe, voir §18) |
| ~~Colonnes mutuelle / exonération / taux / dossier + table triage~~ | ✅ B2 (`migrations/001_rdc_metier.sql`, additive et sûre à relancer) — persistance AUTOMATIQUE des payloads déjà envoyés par le frontend dès que la migration est appliquée (`utils/rdcColumns.js`, dégradation gracieuse : sans migration, comportement hérité intact) |
| ~~Dédupe `X-Idempotence-Key` côté serveur~~ | ✅ B2 (`middleware/idempotence.middleware.js` : clé connue → réponse stockée rejouée, zéro doublon après coupure réseau) |
| `classe_therepeutique` + `seuil` sur `medicament` | ✅ colonnes créées par B2 — le frontend peut les alimenter via POST /api/pharma (extension à ouvrir phase 6) ; en attendant, alternative = carte de correspondance frontend |
| Tables `mutuelle` / `patient_mutuelle` | ✅ créées par B2 — CRUD mutuelles **ouvert en B3** (voir §18) |

## 18. Branchement API réelle — pharmacie, mutuelles, triage (phase 5)

### 18.1 Endpoints consommés (api_hopital, mise à niveau B3 — commit `57217cc`)

| Endpoint | Usage RDC |
|---|---|
| `POST /api/pharma/stock` (B1) | Sortie de stock ATOMIQUE à chaque délivrance et vente directe : `{ id, quantite: -n }` — `GREATEST(0, stock + ?)` : jamais de stock négatif ; le contrôleur renvoie le nouveau stock |
| `GET /api/ordonnance` (B3) | File d'attente inter-postes : **une ligne par médicament** (le GROUP BY hérité effondrait N lignes en 1 — la pharmacie ne voyait qu'un médicament sur N), `id_ordonnance` + `medicament_id` + `id_patient` exploitables, ORDER BY DESC LIMIT 200 |
| `POST /api/pharma/vente` (B3) | Carnet de ventes directes (table `vente_pharma`) : vente au comptoir SANS dossier patient |
| `GET /api/pharma/vente` (B3) | 100 dernières ventes (contrôle journalier, réconciliation) |
| `GET/POST /api/mutuelle` (B3) | Liste des mutuelles actives (datalist Patients) / création d'organisme |
| `GET/POST /api/patient/mutuelle` (B3) | Affectations d'un patient / UPSERT affectation (clé unique patient+mutuelle, n° adhérent) |
| `POST /api/triage` (B2) | Triage 4 niveaux + urgence vitale (payload snake_case) |

### 18.2 La délivrance, bout en bout (offline-first)

1. **Sur le poste** (instantané, fonctionne hors ligne) : stock local
   décrémenté, statut « délivrée », ticket imprimable.
2. **Dans l'outbox** : une trace `delivrer_ordonnance` (cible api)
   porte `sorties: [{medicament_id, nom_medicament, quantite}]` — l'id
   numérique quand le stock vient de l'API, null pour un médicament du
   cache local (résolution par nom au rejeu : cache `map_medic` puis
   GET /api/pharma).
3. **Au rejeu** : un `POST /api/pharma/stock` PAR ligne, clé
   d'idempotence dérivée `<clé>:stock:<i>` — le middleware B2 rejoue la
   réponse stockée : un rejeu après coupure réseau ne décrémente
   JAMAIS deux fois.
4. Tout prérequis manquant → `ErreurAttente` (retour en file sans
   consommer d'essai) : jamais de sortie partielle.

### 18.3 File d'attente inter-postes (nouveauté B3)

Les ordonnances créées au service B apparaissent au comptoir A :
- section « Ordonnances d'autres postes » — lignes serveur groupées par
  consultation, dédup des importations déjà faites sur ce poste ;
- **Prendre en charge** (1 clic) → l'ordonnance devient délivrable
  localement (`SRV-<idConsultation>`, nom du patient affiché depuis le
  serveur même sans fiche locale) ;
- la délivrance enregistre la SORTIE physique de stock — elle ne
  recrée JAMAIS l'ordonnance (elle existe déjà côté serveur) ;
- hors ligne : dernier cache SW affiché avec badge explicite 🟠.

### 18.4 Vente directe = carnet de ventes (réalité HGR)

- Deux traces api : sorties de stock (idem délivrance) + `creer_vente`
  → `POST /api/pharma/vente` (table `vente_pharma`).
- Référence locale `VTE-ANNÉE-HHMMSS` (unique, imprimable, sans
  compteur d'état), client nommé ou ANONYME (client_nom null), lignes
  en JSON, total USD + **taux FC/USD au moment de la vente** (audit
  bidevise).
- Choix de modélisation : PAS de facture à patient fictif — la caisse
  centrale n'intervient que pour les ventes liées à un dossier
  (ordonnance → facture → paiements, phase 3). Le carnet remplace la
  facture, comme sur le papier du comptoir.

### 18.5 Mutuelles : de la saisie libre à l'endpoint réel

- L'agent saisit l'organisme LIBREMENT (200+ mutuelles, liste jamais
  bloquante) ; le serveur SUGGÈRE via datalist les noms officiels + % de
  couverture (`GET /api/mutuelle`, cache 10 min).
- L'enregistrement trace `affecter_mutuelle` (cible api) :
  `POST /api/patient/mutuelle` au rejeu — id patient résolu par la
  chaîne standard (numérique → cache B1 → réconciliation identité), id
  mutuelle résolu par nom (GET /api/mutuelle, insensible accents/casse).
- UPSERT côté serveur : ré-affecter met à jour le n° adhérent au lieu
  de doubler la ligne.

### 18.6 Triage branché + ErreurDefinitive (nouveau contrat d'erreur)

- `creer_triage` passe en cible api (`POST /api/triage` — endpoint B2),
  payload snake_case ; l'urgence vitale porte `autorise_par` +
  `motif_autorisation` (contrôlée AUSSI côté serveur, 400 sinon).
- **ErreurDefinitive** (nouvelle classe outbox) : le 501 « migration
  001 non appliquée » bascule l'entrée en échec IMMÉDIATEMENT avec un
  message explicite — rejouer 10 fois ne créera jamais la table ; la
  trace reste en file, visible et imprimée (zéro perte, réenvoi
  manuel possible après application de la migration).

### 18.7 Vérification des 3 clics (pharmacie, phase 5 incluse)

| Tâche | Clics | Détail |
|---|---|---|
| Délivrer une ordonnance de la file | 1 | « Délivrer » → stock + ticket |
| Substituer en cas de rupture | 2 | « Substituer » sur l'alternative → re-délivrer |
| Prendre en charge une ordonnance d'un autre poste | 1 | « Prendre en charge » → file locale |
| Vente directe (1 ligne) | 4 | choisir médicament + quantité + Ajouter + Encaisser |
| Imprimer le ticket de vente | +1 | bouton du modal d'aperçu |

### 18.8 Tests (33 suites / 223 verts)

- Sorties de stock : 1 POST par ligne, quantités négatives, idempotence
  dérivée, introuvable → ErreurAttente sans POST partiel.
- Carnet de ventes : POST sans résolution de patient, client anonyme.
- Affectation mutuelle : réconciliation patient + mutuelle par nom ;
  mutuelle inconnue → ErreurAttente ; 501 → echec immédiat (1 essai).
- Triage : payload snake_case complet (urgence vitale tracée).
- Store : délivrance trace api calibrée, rupture → RIEN décrémenté
  RIEN tracé, vente directe 2 traces + référence VTE, import serveur
  dédup + résolution par nom (introuvable → marqueur INCONNU, jamais
  un crash).
