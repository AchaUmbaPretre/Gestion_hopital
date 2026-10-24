# Plan de migration — Refonte RDC de Gestion Hôpital (v2)

> **v2 — Cadrage RDC (remplace la v1 orientée SaaS occidental).**
> La v1 (fondations design system, shell, DataTable/Form) reste livrée et
> consultable dans l'historique git (commit `5aec9be`) ; ses briques
> techniques restent valables. Ce document réoriente l'ordre et le contenu
> des phases vers la **réalité métier des HGR en RDC** :
> réalisation du parcours de soins réel, résilience offline, simplicité ≤ 3 clics.
>
> **Principe cardinal inchangé : aucun big bang.** Chaque phase livre une app
> fonctionnelle, committable module par module. Le backend `api_hopital`
> n'est **pas modifié** ; les gaps API sont listés au §Gaps backend.

## Ce qui change par rapport à la v1

| Retiré (v1, non pertinent RDC) | Remplacé par |
|---|---|
| Command Palette ⌘K | Boutons visibles + recherche patient unique |
| Dark mode prioritaire | Mode clair standard (dark = bonus conservé via tokens) |
| Widgets dashboard drag & drop | KPI fixes et clairs (écran Accueil) |
| Progressive disclosure poussé | Tout visible d'un coup ; sections pliables ouvertes par défaut |
| Animations framer-motion poussées | Transitions sobres ≤ 150 ms, feedback immédiat |
| Intégrations email/SMS | Champ « Téléphone » simple |

| Ajouté (RDC) | Où |
|---|---|
| Bidevise FC/USD, taux paramétrable | Caisse + tous les montants |
| Urgence vitale — paiement différé tracé (arrêté n°1250/2025) | Accueil/Triage + Caisse |
| Mutuelles (% couverture, ticket modérateur) + exonérations/FSS | Patients + Caisse |
| Triage 4 niveaux (Rouge/Orange/Jaune/Vert) | Accueil/Triage |
| Mode offline (auto-save 30 s, indicateur réseau, PWA) | Tous les écrans |
| Recherche par téléphone, insensible aux accents | Patients |
| Impression carnet (A4), ordonnance (A5), facture (A4), ticket | pattern `.print-zone` |
| Alertes rupture de stock + alternatives thérapeutiques | Pharmacie |

## État des lieux

| Sujet | Constat | Action |
|---|---|---|
| Fondations design system | ✅ livrées (tokens 3 niveaux, 10 atoms, ThemeProvider, polices auto-hébergées, 105 tests) | conservées |
| Shell applicatif | ✅ livré (Sidebar rôles, TopBar, ⌘K, layouts, router lazy, main 158 KB gzip vs 696 KB) | ⌘K retiré en phase 1 ; sidebar simplifiée en phase 7 |
| DataTable + Form system | ✅ livrés | réutilisés par les modules |
| **Prototype RDC** | ✅ **livré (phase 0)** : `typography.scss` + 5 écrans cœur sous `/rdc/*` + docs/RDC_BUSINESS_LOGIC.md | validation terrain avant bascule |
| **Offline (phase 1)** | ✅ **livré** : SW Workbox (precache + cache API + Background Sync), Dexie (outbox + patients récents), moteur de sync, axios durcé (8 s / retry ×3), badge « en attente de synchronisation » | branchement API réelle phase 2 ✅ |
| **Patients (phase 2)** | ✅ **livré** : liste fusionnée local ∪ serveur (dédup identité sans accents/téléphone), création via outbox (payload 15 colonnes MySQL + extras audit), fiche 360° avec historique des passages, carnet sur données réelles | validation terrain 3 clics / 3G |
| Backend | gelé ; patients/médicaments/factures/paiements branchables ; gaps mutuelle/exonération/triage/bidevise/seuils | voir §Gaps backend |

## Phase 0 — Prototype des 5 écrans cœur RDC ✅ (FAIT)

- [x] `src/design-system/typography.scss` : pile Inter/JetBrains Mono/Arial, corps ≥ 16 px, interligne 1.5, pattern `.print-zone` (A4/A5), print Arial noir/blanc.
- [x] Écran 1 — **Accueil/Triage « 3 boutons »** (`/rdc`) : Urgence (triage 4 niveaux + urgence vitale tracée), Consultation, Pharmacie ; KPI fixes ; alertes stock.
- [x] Écran 2 — **Recherche + création rapide patient** (`/rdc/patients`) : autocomplete ≥ 2 car. (debounce 250 ms, nom/prénom/téléphone/dossier, sans accents), création inline, mutuelle/exonération, fiche carnet imprimable.
- [x] Écran 3 — **Caisse en un écran** (`/rdc/caisse`) : actes cochés, FC+USD simultanés (taux paramétrable), mutuelle + ticket modérateur, Payé totalité / Acompte / Exonéré / Urgence vitale (motif obligatoire + badge « Prise en charge autorisée »), reçu A4.
- [x] Écran 4 — **Consultation mode crayon** (`/rdc/consultation`) : 5 sections pliables, prescriptions avec stock live + alternative si rupture, auto-save 30 s + restauration, « Enregistrer et imprimer l'ordonnance » → file pharmacie.
- [x] Écran 5 — **Pharmacie Scan & Go** (`/rdc/pharmacie`) : file d'attente + vente directe, délivrance = décrément stock + ticket, blocage rupture + substitution 1 clic.
- [x] Routes `/rdc/*` branchées **additivement** (les 20 routes héritées intactes) ; TS strict zéro `any` ; build + 105 tests verts.

**Règle de validation** : faire tourner le prototype avec le personnel (secrétaire, caissier, infirmier) avant toute bascule — chaque écran doit passer le test « 3 clics / 30 s » et le test 3G simulé (throttling Chrome DevTools).

## Phase 1 — Fondations techniques RDC (offline & réseau) ✅ (FAIT)

1. [x] **PWA offline-first** : Service Worker (`src/service-worker.ts`, compilé par
   WorkboxWebpackPlugin.InjectManifest de CRA 5) — précache de l'app shell complet,
   `NavigationRoute` vers index.html, runtime cache des GET `/api/*` en **NetworkFirst**
   (timeout 8 s, cache `rdc-api-v1`, expiration 7 jours / 300 entrées,
   `purgeOnQuotaError`) ; manifest.json RDC (nom, lang fr, standalone, theme #2563EB) ;
   enregistrement en production uniquement (`serviceWorkerRegistration.ts`, SKIP_WAITING).
2. [x] **File d'écriture différée (outbox)** : IndexedDB via **Dexie 4**
   (`src/offline/db.ts` — tables `outbox` / `patients_recent` LRU 200 / `meta`) ;
   chaque action du store RDC trace sa mutation (`src/pages/rdc/data/rdcStore.ts`) :
   cible `api` (endpoints existants : patients, ordonnance, factures, paiement) →
   rejeu automatique ; cible `local` (gaps backend : triage, mutuelle, exonération,
   stocks) → trace conservée + imprimée, JAMAIS perdue, jamais envoyée prématurément.
3. [x] **Moteur de synchronisation** (`src/offline/syncEngine.ts`) : rejeu au retour
   réseau, au message `RDC_SYNC` du SW (**Background Sync**, tag `rdc-outbox-sync`),
   au démarrage (+2,5 s) et par sondage 60 s ; lots de 50, clé d'idempotence par
   mutation (`X-Idempotence-Key`), 4xx → statut « echec » (action manuelle visible),
   réseau/5xx → rejeu ultérieur, max 10 essais.
4. [x] **Résilience axios** (`src/services/resilience.ts`) : timeout **8 s**, retry
   **×3 backoff exponentiel** (1 s / 2 s / 4 s), rejeu limité aux méthodes sûres
   (GET/HEAD) et aux erreurs transitoires (réseau, timeout, 5xx, 429, 408) — un
   POST n'est JAMAIS re-joué aveuglément (les mutations passent par l'outbox).
   Branché sur le client global (`installerResilienceGlobale`) et sur `userRequest`.
5. [x] **Statut visible** : badge `SyncBadge` (TopBar + en-tête des 5 écrans RDC) :
   « N en attente de synchronisation » (clic = sync immédiate), « Synchronisation… »,
   « N échec(s) » — le personnel voit toujours ce qui attend le réseau.
6. [x] **Retrait ⌘K** : CommandPalette supprimée, déclencheur remplacé par un bouton
   VISIBLE « Rechercher un patient » (→ `/rdc/patients`) ; QUICK_ACTIONS retirées ;
   `/` = accueil RDC (hub 3 boutons), ancien dashboard conservé sur `/dashboard`.
7. [x] **Consolidation tokens** : `design-system/tokens/rdc.scss` (triage 4 niveaux,
   indicateur réseau, états de sync) — consommés par `rdc.module.scss` et SyncBadge.

**Critères d'acceptation** : ✅ l'app démarre et permet triage + consultation +
facturation 100 % hors ligne (store local persistant + précache SW) ; la file
outbox se rejoue automatiquement au retour du réseau (25 suites / 120 tests verts,
dont 15 nouveaux tests offline : dédup idempotence, 4xx → echec, réseau → rejeu,
cible local jamais envoyée, LRU 200).

## Phase 2 — Parcours patient (branchement API réelle) ✅ (FAIT)

Remplace : `pages/patient/*` (liste, formulaire). Branchement : `GET/POST /patients` existants.

1. [x] **Liste de travail fusionnée** : `GET /api/patient` (React Query,
   staleTime 5 min, retry false — axios a déjà re-joué ×3) **fusionnée**
   avec le store local de la journée ; dédup par identité (nom + prénom
   normalisés sans accents + 9 derniers chiffres du téléphone), le
   patient LOCAL gagne (dossier imprimable + actes du jour). Le filtrage
   reste local instantané : le backend n'expose pas de param `q`
   (gap documenté §Gaps + RDC_BUSINESS_LOGIC §15.5).
2. [x] **Création rapide → POST /api/patient via l'outbox** (jamais de
   POST direct) : écriture locale immédiate (≤ 30 s garanti hors ligne),
   trace `creer_patient` cible `api`, **rejeu immédiat si en ligne** ;
   payload mappé sur les 15 colonnes MySQL du contrôleur + extras RDC
   d'audit (dossier, âge estimé, référé) ; `dateNaissance` approchée
   (1er janvier de l'année déduite de l'âge estimé — colonne NOT NULL
   sans inventer de DDN) ; `typePatient` = premier type exposé par
   `GET /api/patient/type` (valeur par défaut, null si API injoignable).
3. [x] **Fiche 360° minimaliste RDC** : identité, mutuelle, exonération +
   **historique des passages** — actes du jour (caisse/ordonnances/
   triages du store, disponibles hors ligne, urgence vitale tracée) +
   consultations et factures serveur filtrées par patient
   (`Promise.allSettled` : un endpoint en panne ne coupe pas tout) ;
   montants bicolonne FC/USD ; bandeau explicite + Réessayer si serveur
   injoignable.
4. [x] **Impression carnet branchée sur les données réelles** : la fiche
   carnet A4 consomme le patient mappé (serveur ou local) sans
   modification du gabarit.
5. [x] **Tests** : `patientsApi.test.ts` + `usePatients.test.ts` (lecture
   défensive MySQL, mapping, filtrage historique, payload, fusion/dédup,
   passages locaux) — 27 suites / 148 tests verts, zéro régression.

**Critères** : retrouver un patient connu en ≤ 3 clics / < 2 s sur 3G
(rendu instantané local + cache SW NetworkFirst) ; création d'un nouveau
patient en < 30 s (2 champs requis, le reste modifiable) — le POST part
via l'outbox sans jamais bloquer l'agent.

## Phase 3 — Caisse & facturation (bidevise, mutuelles, exonérations) — ✅ FAIT

Remplace : `pages/factures/*`, `pages/paiement/*`. Branchement : `POST /factures` + `insertFactureDetails` + `POST /paiement`.

**État : livré (commit « phase 3 RDC »). Détail complet dans RDC_BUSINESS_LOGIC.md §16.**

1. ✅ **Payloads calibrés sur le backend réel** (`services/facturationApi.ts`) :
   le panier d'actes alimente `factures` + `facture_details` via
   `service_details` **snake_case** (piège du contrôleur vérifié dans
   `factures.model.js`) ; statuts RDC (`Payée` / `Partielle` /
   `Exonérée` / `En attente`) alignés sur les conventions de l'écran
   hérité ; chaque encaissement → `paiements` (`methode_paiement` :
   `especes_fc` / `especes_usd` / `mobile_money`, `transaction_id` =
   référence du reçu local, trace croisée).
2. ✅ **Acomptes multiples** : `ajouterAcompte()` (store) déduit du
   solde de la facture d'origine et n'émet qu'une ligne `paiements`
   (JAMAIS une seconde facture) ; l'écran Caisse affiche le bandeau
   « Solde en cours » + bouton « Régler / compléter ce paiement »
   (dépose d'acompte à l'admission, solde réglé à la sortie).
3. ✅ **Réconciliation des ids** (POST /factures ne renvoie pas d'id) :
   `offline/envoiMetier.ts` résout à l'envoi l'id serveur du patient
   (numérique direct ou correspondance par identité sur GET
   /api/patient) puis l'id serveur de la facture (cache IndexedDB
   `map_facture:<référence>` + correspondance patient+montant+date en
   exclusion des ids déjà appariés). Un prérequis manquant →
   `ErreurAttente` : l'entry attend le prochain cycle SANS consommer
   d'essai (jamais de paiement orphelin, jamais de bascule en échec
   pour une question d'ordre).
4. ✅ **Mutuelle / exonération / urgence vitale** : dans l'attente des
   colonnes backend (voir §Gaps), les traces voyagent DANS le payload
   (`part_mutuelle`, `ticket_moderateur`, `mutuelle`, `motif_exoneration`,
   `autorise_par`, `taux_fc_usd`) et restent imprimées sur le reçu —
   zéro perte d'information. Exonération / urgence vitale ne créent
   PAS de ligne de paiement (montant 0 = bruit).
5. ✅ **Historique 360° enrichi** : les encaissements serveurs
   (GET /api/paiement) sont joints aux factures (`Payé X $ sur Y $`,
   acomptes compris) — `Promise.allSettled` à 3 endpoints : un en panne
   ne coupe pas tout.
6. ✅ **Reçus** numérotés `REC-ANNÉE-N°` (déjà en place), variante
   « Acompte — facture REC-… » imprimée sans re-détail des actes ;
   synchronisation immédiate déclenchée après chaque encaissement
   (lancée en fire-and-forget, hors ligne l'outbox prend le relais).

Critères : encaissement totalité en 3 clics ; reçu A4 imprimé
immédiatement ; traces exonération/urgence exportables (audit) —
tous les trois respectés (voir §11 de RDC_BUSINESS_LOGIC.md).

## Phase 4 — Consultation & ordonnances ✅ (FAIT)

Remplace : `pages/consultation/*`, `pages/ordonnance/*`. Branchement : `POST /consult` + `POST /ordonnance`.

**État : livré. Détail complet dans RDC_BUSINESS_LOGIC.md §17.**

1. [x] Le prototype « mode crayon » conserve son auto-save 30 s ; l'enregistrement écrit en base via la chaîne outbox `creer_ordonnance` (POST /api/consult → id_consultation → PAR ligne POST /api/ordonnance + /api/traitement — l'INNER JOIN traitement de la requête de détail impose la ligne de traitement).
2. [x] Prescription : stock réel `GET /pharma` (hydratation du store React Query, « local gagne » pour les décréments du jour) ; alternative thérapeutique au clic tant que la colonne `classe` n'existe pas (carte de correspondance embarquée, maintenue côté frontend).
3. [x] « Enregistrer et imprimer l'ordonnance » = 1 clic → base + file pharmacie + A5.
4. [x] Référentiels réels TOUT VISIBLE : type de consultation (prix USD) + médecin (GET /api/docteur) — hors ligne : dernier cache SW, saisie possible, envoi en ErreurAttente explicite (médecin JAMAIS deviné).
5. [x] **Backend B1 (autorisé, commit api_hopital 2b9da37)** : tous les POST renvoient l'id créé (style callback — le package `mysql` perdait les insertId) ; `GET /api/patient?q=` (recherche serveur nom/prénom/téléphone) ; `POST /api/pharma/stock` (ajustement atomique, jamais négatif) ; correction injection SQL `getConsultOne`. Frontend : raccourci « id renvoyé → cache direct » pour patients/factures (réconciliation = secours antérieur à B1).

## Phase 5 — Pharmacie & laboratoire

Remplace : `pages/medicament/*`, `pages/labo/*`. Branchement : `GET /pharma`, prescriptions labo existantes.

1. File d'attente ordonnances réelle (jointures `ordonnance`/`patient`/`medicament`) ; délivrance = décrément stock via une mutation idempotente.
2. Alertes seuils : seuils configurables côté frontend (`localStorage` établissement) tant que la colonne `seuil` n'existe pas ; alternative de substitution idem phase 4.
3. Vente directe encaissée via la caisse (facture type « Vente directe »).
4. Labo : résultat de prescription + transmission, badges statut (réutilise DataTable).

## Phase 6 — Hospitalisation, urgences, RDV simplifiés

Remplace : `pages/admission/*`, `pages/traitement/*`, `pages/rdv/*`.

1. Admission : plan des lits simple (grille service/lit/occupation), médecin responsable, acompte → caisse.
2. Suivi quotidien : constantes (T°, TA, pouls) en 3 champs, historique linéaire.
3. Sortie : « Clôturer le séjour » → total séjour → facture finale + solde.
4. RDV : liste simple du jour (react-big-calendar retiré s'il n'est pas utilisé terrain — décision au moment de la phase).

## Phase 7 — Shell final RDC, impression, qualité

1. Sidebar réduite à 5 entrées (Accueil, Patients, Caisse, Consultation, Pharmacie) + gestion (docteurs, services, utilisateurs) pour l'admin ; les anciennes pages restent accessibles en « mode expert » jusqu'à validation.
2. Retrait définitif des pages .jsx remplacées (un commit par route, rollback trivial).
3. A11y (axe-core) + Lighthouse ≥ 95 + SUS ≥ 85 (5 utilisateurs) + tests E2E Playwright des 4 parcours critiques (urgence vitale, caisse avec mutuelle, consultation→pharmacie, offline/reprise).
4. Tests 3G simulés + coupures d'électricité (kill du serveur) systématiques avant release.

## Règles de cohabitation (héritées de la v1, confirmées)

1. Les pages .jsx existantes continuent de fonctionner jusqu'à leur remplacement.
2. Tout nouveau code = `.tsx` strict, zéro `any`.
3. Ant Design reste l'**unique** lib UI (aucune lib concurrente) ; le design system maison l'habille via tokens.
4. Redux limité à auth/notifications ; server state → React Query.
5. Chaque commit = 1 module cohérent + tests verts (23 suites / 105 tests à ce jour).
6. `api_hopital` : évolution AUTORISÉE par le propriétaire depuis la phase 4 (additive, committée et poussée après chaque amélioration — B1 = ids créés, recherche q, décrément stock ; B2 = migration SQL RDC à venir) ; toute évolution reste documentée (§Gaps → résolus).

## Gaps backend (nécessaires aux règles RDC)

> **Mise à jour phase 4** : le backend `api_hopital` est devenu
> ÉVOLUTIF (autorisation du propriétaire, commits B1 `2b9da37` et B2
> `61ed353`, poussés). Les gaps ci-dessous sont résolus côté serveur :
>
> | Règle métier | Statut |
> |---|---|
> | Bidevise auditable (`taux_fc_usd` sur `paiements`) | ✅ B1 (ids) + B2 (migration) |
> | Mutuelles (tables `mutuelle` + `patient_mutuelle`) | ✅ B2 (CRUD à ouvrir phase 5/6) |
> | Exonération / urgence vitale (`mode`, `motif`, `autorise_par` sur `factures`) | ✅ B2 — persistés automatiquement dès la migration appliquée |
> | Triage 4 niveaux (table `triage`) | ✅ B2 (endpoint `POST /api/triage`, 501 tant que la migration n'est pas passée) |
> | Alternatives thérapeutiques (`classe_therepeutique` + `seuil` sur `medicament`) | ✅ B2 (colonnes créées) |
> | Référence patient RDC (`dossier`) | ✅ B2 |
> | Recherche serveur patients (param `q`) | ✅ B1 |
> | Dédupe des rejeux (`X-Idempotence-Key`) | ✅ B2 (middleware, réponse stockée rejouée) |
> | Ids créés renvoyés par les POST | ✅ B1 |
> | Décrément de stock (`POST /api/pharma/stock`) | ✅ B1 |
>
> **Application de la migration** (à faire sur la base de production) :
> `mysql -u <USER> -p <BASE> < migrations/001_rdc_metier.sql` —
> additive, sûre à relancer ; sans elle, l'héritage fonctionne intact.

## Journal des dépendances — justifié

| Paquet | Taille | Justification | Statut |
|---|---|---|---|
| typescript + @types/* | dev only | TS strict | ✅ installé |
| @fontsource/inter + jetbrains-mono | ~90 KB woff2 | Auto-hébergé offline (aucun CDN) | ✅ installé |
| @tanstack/react-query | ~13 KB gzip | Server state + offline cache | ✅ installé |
| react-window | ~6 KB gzip | Listes longues | ✅ installé |
| workbox-* 7.4.1 | ~12 KB gzip runtime | PWA offline-first (InjectManifest CRA5) | ✅ installé (phase 1) |
| dexie 4.4 | ~25 KB gzip | IndexedDB : outbox + patients récents (phase 1) | ✅ installé |
| fake-indexeddb | dev only | Tests Dexie sous jest (jsdom) | ✅ installé (phase 1) |
| @playwright/test | dev only | E2E parcours critiques (phase 7) | à installer phase 7 |

Écartées : toute lib UI concurrente d'Ant Design ; Chart.js conservé uniquement si les statistiques restent demandées ; framer-motion conservé pour transitions sobres (retrait possible si poids jugé inutile terrain).
