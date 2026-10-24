# Plan de migration — Refonte UI/UX Gestion Hôpital

> Translation incrémentale de l'application existante (React CRA + Redux
> Toolkit + Ant Design + Sass) vers la plateforme "senior-grade".
> **Principe cardinal : aucun big bang.** Chaque étape livre une app
> fonctionnelle, committable écran par écran.

## État des lieux (audit express — Phase 0)

| Sujet | Constat | Action |
|-------|---------|--------|
| Bundle | main.js = 2.36 MB (696 KB gzip), zéro code splitting | Route-based lazy loading (étape 4) |
| TypeScript | 0 % — tout en .jsx | Nouveau code en .tsx strict, cohabitation (ADR-002) |
| Data layer | Services axios isolés + Redux global, interceptor JWT bugué (`header:` au lieu de `headers:` dans `src/config.js`) | React Query (étape 3.2) + fix interceptor |
| Styles | SCSS globaux par page, valeurs magiques | CSS Modules + tokens, migration par module |
| UI libs | antd 5 + react-select + react-toastify | Remplacement progressif par le design system maison |
| Bugs préexistants | `ListeRdv.jsx` : fonctions non définies (corrigé — stubs documentés) ; `index.html` lang="en" (corrigé) | — |
| Backend RDV | Pas de route DELETE (noté pour l'équipe backend) | Hors périmètre frontend |

## Fondations livrées (Étape 1 & 2 — FAIT)

- [x] Design tokens 3 niveaux + dark mode ([data-theme] + prefers-color-scheme)
- [x] 10 atoms : Button, IconButton, Input, Select, Badge, Tag, Avatar, Spinner, Skeleton, Tooltip
- [x] ThemeProvider + useTheme + anti-FOUC
- [x] Polices auto-hébergées (Inter, JetBrains Mono)
- [x] 52 tests unitaires verts, build de production vert
- [x] docs/DESIGN_SYSTEM.md + ADRs 0001→0006

## Étape 3 — Layout global & shell applicatif

1. **Molecules** : FormField, SearchBar, StatCard, EmptyState, ConfirmDialog,
   Toast (remplace react-toastify), Pagination, FilterBar, Breadcrumb.
2. **Organisms** : Sidebar rétractable (persistée localStorage), TopBar
   (menu utilisateur + toggle dark mode + NotificationCenter), **CommandPalette
   ⌘K** (recherche globale patients/docteurs/factures + actions rapides).
3. **Templates** : DashboardLayout, AuthLayout, DetailLayout, FormLayout.
4. **Motion** : ajout de `framer-motion` (≈ 30 KB gzip, justifié) — transitions
   de page fade+slide 8px, springs listes (stiffness 300 / damping 30).
5. **Router** : routes centralisées + React.lazy par page + Suspense skeletons.

Livrable : shell de navigation complet autour des pages existantes (aucune
page cassée).

## Étape 4 — DataTable générique + Form system

1. **DataTable** : colonnes configurables (persistées), tri multi-colonnes,
   filtres chips sauvegardés en URL, sélection multiple + actions bulk,
   export CSV/PDF/Excel, densité (compact/normal/comfortable), virtual
   scrolling `react-window` > 200 rows, skeleton rows, actions rapides au hover.
2. **Form system** : `<FormInput>`, `<FormSelect>`, `<FormDatePicker>`,
   `<FormAutocomplete>` (patients, debounce 250ms), `<FormFileUpload>` ;
   validation zod inline (debounce 300ms) ; auto-save brouillon
   (localStorage) ; confirmation d'abandon.

## Étape 5 — Refonte modules (ordre impératif)

| # | Module | Points clés |
|---|--------|-------------|
| 5.1 | **Auth / Login** | AuthLayout, validation zod, états loading/error, redirection |
| 5.2 | **Dashboard** | KPI cards, graphiques Chart.js lazy, actions rapides, timeline du jour, widgets par rôle |
| 5.3 | **Patients** | Liste (DataTable) + **fiche 360°** : header sticky (allergies en badges rouges), onglets, timeline médicale, panneau alertes cliniques |
| 5.4 | **RDV** | react-big-calendar lazy (vues J/S/M/Agenda), créneau → modal pré-remplie, code couleur par médecin ; demander DELETE RDV au backend |
| 5.5 | **Consultations** | Fiche consultation, auto-save, mode crayon sur la fiche détail |
| 5.6 | **Ordonnances** | Sélecteur de médicaments + posologie, impression PDF |
| 5.7 | **Laboratoire** | Prescriptions, transmissions, badges de statut |
| 5.8 | **Pharmacie** | Stock, ordonnances à délivrer |
| 5.9 | **Factures + Paiements** | Statuts colorés, optimistic update sur paiement, export |
| 5.10 | **Admissions** | Flux d'admission simplifié |
| 5.11 | **Statistiques** | Filtres période, graphiques lazy, export |

Chaque module : nouvelle page TSX branchée sur React Query + design system,
**remplacement de l'ancienne route en un commit** (rollback trivial).

## Étape 6 — Dark mode + responsive fine-tuning

- Bottom-bar mobile, tables → cards empilées, filtres en drawer.
- Sidebar icons-only (tablette), complète (desktop).
- Relecture contrastes dark sur chaque module (axe-core).

## Étape 7 — A11y audit + Lighthouse + tests E2E

- axe-core en CI (`@axe-core/react` en dev), correction des violations.
- Lighthouse ≥ 95 (perf via code splitting : cible < 300 KB gzip initial —
  baseline actuelle 696 KB).
- Playwright : parcours patient, consultation, facturation.
- Test SUS (5 utilisateurs minimum) → objectif ≥ 85.

## Architecture cible (Phase 3.1 du brief)

```
src/
  design-system/   ✅ créé (tokens, components/atoms, foundation, motion)
  features/        étape 5 — patients/, consultations/, factures/, …
  shared/          étape 3-4 — api/ (axios+interceptors), components/,
                   hooks/ (useDebounce, useMediaQuery, useKeyboard), utils/, layouts/
  app/             ✅ providers/ créé — router/ + store/ à l'étape 3
```

## Règles de cohabitation pendant la migration

1. Les pages .jsx existantes **continuent de fonctionner** telles quelles.
2. Toute nouvelle page/fonctionnalité = .tsx + tokens + atoms.
3. antd disparaît module par module ; chaque commit retire ses usages.
4. Redux reste limité à auth/prefs/notifications ; le server state migre
   vers React Query (`@tanstack/react-query`) — ajout à l'étape 3.2.
5. redux-persist : PAS de changement de structure du state `user`
   (compat garantie) ; nouvelles slices = nouvelles clés.
6. Chaque commit = 1 composant ou 1 écran cohérent + ses tests.

## Dépendances — journal justifié

| Paquet | Taille | Justification | Statut |
|--------|--------|---------------|--------|
| typescript + @types/* | dev only | Brief : TS strict | ✅ installé |
| @fontsource/inter + jetbrains-mono | ~90 KB woff2 au total (subsets latin) | Auto-hébergé santé/offline (RGPD, réseau hospitalier fermé) vs CDN Google | ✅ installé |
| @tanstack/react-query | ~13 KB gzip | Server state (brief 3.2) | étape 3 |
| framer-motion | ~30 KB gzip | Motion design (brief 1.3) | étape 3 |
| react-window | ~6 KB gzip | Virtual scrolling listes (brief 2.3) | étape 4 |
| @playwright/test | dev only | E2E (brief 3.5) | étape 7 |
| storybook 8 | dev only | Visualisation des stories CSF3 déjà écrites | étape 3 (optionnel) |

Alternative écartée : migration Next.js/Vite — violerait "pas de big bang
rewrite" (ADR-006).
