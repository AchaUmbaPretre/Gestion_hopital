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
| Backend | gelé ; patients/médicaments/factures/paiements branchables ; gaps mutuelle/exonération/triage/bidevise/seuils | voir §Gaps backend |
| Offline | auto-save localStorage + store persisté (prototype) | Workbox + IndexedDB en phase 1 |

## Phase 0 — Prototype des 5 écrans cœur RDC ✅ (FAIT)

- [x] `src/design-system/typography.scss` : pile Inter/JetBrains Mono/Arial, corps ≥ 16 px, interligne 1.5, pattern `.print-zone` (A4/A5), print Arial noir/blanc.
- [x] Écran 1 — **Accueil/Triage « 3 boutons »** (`/rdc`) : Urgence (triage 4 niveaux + urgence vitale tracée), Consultation, Pharmacie ; KPI fixes ; alertes stock.
- [x] Écran 2 — **Recherche + création rapide patient** (`/rdc/patients`) : autocomplete ≥ 2 car. (debounce 250 ms, nom/prénom/téléphone/dossier, sans accents), création inline, mutuelle/exonération, fiche carnet imprimable.
- [x] Écran 3 — **Caisse en un écran** (`/rdc/caisse`) : actes cochés, FC+USD simultanés (taux paramétrable), mutuelle + ticket modérateur, Payé totalité / Acompte / Exonéré / Urgence vitale (motif obligatoire + badge « Prise en charge autorisée »), reçu A4.
- [x] Écran 4 — **Consultation mode crayon** (`/rdc/consultation`) : 5 sections pliables, prescriptions avec stock live + alternative si rupture, auto-save 30 s + restauration, « Enregistrer et imprimer l'ordonnance » → file pharmacie.
- [x] Écran 5 — **Pharmacie Scan & Go** (`/rdc/pharmacie`) : file d'attente + vente directe, délivrance = décrément stock + ticket, blocage rupture + substitution 1 clic.
- [x] Routes `/rdc/*` branchées **additivement** (les 20 routes héritées intactes) ; TS strict zéro `any` ; build + 105 tests verts.

**Règle de validation** : faire tourner le prototype avec le personnel (secrétaire, caissier, infirmier) avant toute bascule — chaque écran doit passer le test « 3 clics / 30 s » et le test 3G simulé (throttling Chrome DevTools).

## Phase 1 — Fondations techniques RDC (offline & réseau)

1. **PWA offline-first** : Workbox (precache app shell + runtime cache API), manifest, IndexedDB via **Dexie** (patients récents, files d'attente, brouillons), **Background Sync** pour les mutations en attente (file d'écriture différée avec statut « en attente de synchronisation »).
2. **Résilience réseau** : interceptor axios — timeout 8 s, retry ×3 backoff exponentiel, compression activée ; batch de requêtes (10 patients/requête).
3. **Data layer** : React Query pour TOUT le server state (keys `['patients','list',filters]`, `['patient',id]`, `['stock']`) ; le store mock RDC devient un adapter Dexie/React Query **sans changer les écrans**.
4. **Retrait ⌘K** + simplification de la navigation (boutons géants de l'accueil = hub).
5. Consolidation tokens : variables RDC (bidevise, triage) dans `design-system/tokens/`.

Backend requis : aucun. Risque : IndexedDB quota — mitigation : LRU sur patients récents. Acceptation : l'app démarre et permet triage + consultation + facturation **100 % hors ligne** ; resynchronisation automatique au retour du réseau.

## Phase 2 — Parcours patient (branchement API réelle)

Remplace : `pages/patient/*` (liste, formulaire). Branchement : `GET/POST /patients` existants.

1. Recherche serveur (param `q` nom/prénom/tél/dossier) avec cache React Query + filtre local instantané.
2. Création rapide → `POST /patients` (âge estimé conservé côté UI ; `dateNaissance` optionnelle).
3. Fiche 360° minimaliste RDC : identité, mutuelle, exonération, historique des passages (consultations + factures existantes).
4. Impression carnet branchée sur les données réelles.

Critères : retrouver un patient connu en ≤ 3 clics / < 2 s sur 3G ; création d'un nouveau patient en < 30 s.

## Phase 3 — Caisse & facturation (bidevise, mutuelles, exonérations)

Remplace : `pages/factures/*`, `pages/paiement/*`. Branchement : `POST /factures` + `insertFactureDetails` + `POST /paiement`.

1. Le panier d'actes alimente `factures` + `facture_details` ; chaque encaissement → `paiements` (`methode_paiement` : Espèces FC / Espèces USD / Mobile money).
2. Acomptes = plusieurs `paiements` sur la même facture ; solde calculé côté UI + affiché.
3. Mutuelle / exonération / urgence vitale : **dans l'attente des colonnes backend** (voir §Gaps), les traces restent dans la file offline locale ET imprimées sur le reçu — zéro perte d'information.
4. Recus numérotés `REC-ANNÉE-N°` ; file d'impression locale si imprimante hors ligne.

Critères : encaissement totalité en 3 clics ; reçu A4 imprimé immédiatement ; traces exonération/urgence exportables (audit).

## Phase 4 — Consultation & ordonnances

Remplace : `pages/consultation/*`, `pages/ordonnance/*`. Branchement : `POST /consult` + `POST /ordonnance`.

1. Le prototype « mode crayon » conserve son auto-save 30 s ; l'enregistrement écrit en base (ou en file offline).
2. Prescription : stock réel `GET /pharma` (rafraîchi à l'ouverture) ; alternative thérapeutique au clic tant que le backend n'a pas la colonne `classe` (carte de correspondance embarquée, maintenue côté frontend).
3. « Enregistrer et imprimer l'ordonnance » = 1 clic → base + file pharmacie + A5.

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
6. `api_hopital` non modifié ; toute évolution backend documentée et négociée séparément.

## Gaps backend (nécessaires aux règles RDC — hors périmètre actuel)

| Règle métier | Donnée manquante |
|---|---|
| Bidevise auditable | colonne `taux_fc_usd` sur `paiements` |
| Mutuelles | tables `mutuelle` + liaison patient (organisme, % couverture, n° adhérent) |
| Exonération / urgence vitale | colonnes `mode`, `motif`, `autorise_par` sur `factures` |
| Triage 4 niveaux | table `triage` (niveau, motif, orientation, urgence_vitale) |
| Alternatives thérapeutiques | colonne `classe_therepeutique` + `seuil` sur `medicament` |
| Référence patient RDC | colonne `dossier` (INIT-ANNÉE-N°) sur `patient` |

## Journal des dépendances — justifié

| Paquet | Taille | Justification | Statut |
|---|---|---|---|
| typescript + @types/* | dev only | TS strict | ✅ installé |
| @fontsource/inter + jetbrains-mono | ~90 KB woff2 | Auto-hébergé offline (aucun CDN) | ✅ installé |
| @tanstack/react-query | ~13 KB gzip | Server state + offline cache | ✅ installé |
| react-window | ~6 KB gzip | Listes longues | ✅ installé |
| workbox-* | ~12 KB gzip runtime | PWA offline-first (phase 1) | à installer phase 1 |
| dexie (+ dexie-react-hooks) | ~25 KB gzip | IndexedDB mutations/patients récents (phase 1) | à installer phase 1 |
| @playwright/test | dev only | E2E parcours critiques (phase 7) | à installer phase 7 |

Écartées : toute lib UI concurrente d'Ant Design ; Chart.js conservé uniquement si les statistiques restent demandées ; framer-motion conservé pour transitions sobres (retrait possible si poids jugé inutile terrain).
