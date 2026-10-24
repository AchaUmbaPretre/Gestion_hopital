# Design System — Gestion Hôpital

> Système de design "Calm Technology" pour plateforme hospitalière.
> Version 0.1.0 — Phase 1 (tokens + atoms). Conforme WCAG 2.2 AA.

## Table des matières

1. [Philosophie](#philosophie)
2. [Architecture des tokens](#architecture-des-tokens)
3. [Couleurs](#couleurs)
4. [Typographie](#typographie)
5. [Espacement & rayons](#espacement--rayons)
6. [Motion](#motion)
7. [Dark mode](#dark-mode)
8. [Composants](#composants)
9. [Règles d'usage](#règles-dusage)

---

## Philosophie

Le design system applique les 6 principes du projet :

| Principe | Traduction concrète |
|----------|---------------------|
| Calm Technology | Surfaces neutres, ombres douces, un seul accent (bleu confiance) |
| Progressive Disclosure | Les atoms sont minimaux ; la complexité vit dans les organisms |
| Zero-training UX | États standardisés partout : la même interaction se comporte pareil |
| Trust by design | Focus visible 2px, confirmations destructives, badges de statut |
| Speed as a feature | Transitions 150ms, skeletons (jamais de spinner plein écran) |
| Mobile-first | Touch targets ≥ 44px sur `pointer: coarse`, tokens responsive |

## Architecture des tokens

Trois niveaux stricts — **un composant ne consomme jamais un niveau inférieur** :

```
tokens/
├── primitive.scss   Niveau 1 — valeurs brutes (--blue-600, --space-4, --radius-lg…)
├── semantic.scss    Niveau 2 — intentions    (--color-primary, --color-bg-surface…)
├── component.scss   Niveau 3 — composants   (--button-height-md, --input-gap-icon…)
└── index.scss       Point d'entrée (importé UNE fois dans src/index.js)
                     + garde-fou prefers-reduced-motion
```

**Exemple de flux** : le bouton lit `--button-height-md` (niveau 3),
qui référence `--radius-button` (niveau 2), qui référence `--radius-md` (niveau 1).
Changer le rayon global = 1 ligne dans `primitive.scss`.

## Couleurs

### Échelles primitives

7 échelles × 11 tons : `blue`, `emerald`, `amber`, `red`, `teal`, `gray`, `slate` (+ `ink` pour les surfaces sombres).

### Tokens sémantiques (à consommer dans les composants)

| Token | Usage | Clair | Sombre |
|-------|-------|-------|--------|
| `--color-primary` | Actions principales | blue-600 `#2563EB` | blue-400 `#60A5FA` |
| `--color-primary-contrast` | Texte sur fond primary | blanc | ink-900 |
| `--color-status-success` | Validations, patient stable | emerald-700 | emerald-400 |
| `--color-status-warning` | Alertes non critiques | amber-700 | amber-400 |
| `--color-status-danger` | Urgences, allergies, erreurs | red-600 | red-400 |
| `--color-status-info` | Labo, infos cliniques | teal-700 | teal-400 |
| `--color-bg-base` | Fond applicatif | gray-50 | ink-900 `#0F172A` |
| `--color-bg-surface` | Cards, panels | blanc | ink-800 `#16203A` |
| `--color-bg-elevated` | Modals, popovers | blanc | ink-700 `#1E2A45` |
| `--color-text-primary/secondary/tertiary` | Hiérarchie de texte | gray-900/600/500 | slate-50/300/400 |

**Contrastes garantis (WCAG AA)** : texte ≥ 4.5:1, composants UI ≥ 3:1,
boutons pleins ≥ 4.5:1 (vérifiés manuellement par palette). Le mode sombre
utilise le pattern "inverted" (fond clair + texte sombre sur boutons primaires)
pour maintenir les ratios.

## Typographie

| Rôle | Token | Taille | Graisse |
|------|-------|--------|---------|
| Display | `--font-size-display` | 40px | bold |
| H1 → H6 | `--font-size-h1`…`h6` | 32→14px | semibold |
| Corps | `--font-size-body` | 14px | regular |
| Corps dense (tables) | `--font-size-body-sm` | 13px | regular |
| Caption | `--font-size-caption` | 12px | regular |
| Overline | `--font-size-overline` | 11px | medium |

- Famille UI : **Inter** (auto-hébergée via `@fontsource/inter`, subsets latin).
- Famille données : **JetBrains Mono** — IDs, n° de sécurité sociale, montants,
  dosages, horodatages. Les inputs `[type=number]`/`[inputmode=numeric]`
  basculent automatiquement en mono.
- `line-height` du corps ≥ 1.5 (`--line-height-normal`).

## Espacement & rayons

- Base 4px : `--space-1` (4) → `--space-24` (96).
- Tokens composites : `--space-card-padding`, `--space-form-gap`, `--space-section-gap`.
- Rayons : `--radius-xs` (4) → `--radius-2xl` (20), `--radius-full` (pill).
- Composites : `--radius-button`, `--radius-card`, `--radius-dialog`.

## Motion

| Type | Token | Durée |
|------|-------|-------|
| Micro (hover, focus) | `--transition-micro` | 150ms ease-out |
| Macro (modals, pages) | `--transition-macro` | 250ms ease-in-out |
| Limite absolue | `--duration-slow` | **400ms max** (urgence santé) |

Spring (listes/cards, étape Framer Motion) : `stiffness 300, damping 30`, stagger 30ms.
**Toute animation respecte `prefers-reduced-motion`** (garde-fou global dans `index.scss`).

## Dark mode

Stratégie (ADR-004) :

```html
<html data-theme="light|dark">   ← posé par ThemeProvider + script anti-FOUC
```

- Préférence : `localStorage['gh.theme']` = `light | dark | auto` (défaut : `auto`).
- `auto` suit `prefers-color-scheme` en temps réel (listener `matchMedia`).
- Les composants ne lisent QUE les tokens sémantiques → le dark mode est gratuit.
- API React : `useTheme()` → `{ preference, resolvedTheme, setPreference, toggle }`.

```tsx
const { resolvedTheme, toggle } = useTheme();
<IconButton label="Basculer le thème" onClick={toggle}>
  {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
</IconButton>
```

## Composants

### Inventaire (Phase 1.2 — atoms)

| Composant | Fichiers | Tests | Stories |
|-----------|----------|-------|---------|
| Button | `Button.tsx` + `button.module.scss` | 8 | 10 |
| IconButton | ✓ | 4 | 5 |
| Input | ✓ | 8 | 6 |
| Select (natif) | ✓ | 6 | 4 |
| Badge | ✓ | 4 | 7 |
| Tag | ✓ | 4 | 4 |
| Avatar | ✓ | 6 | 5 |
| Spinner | ✓ | 3 | 3 |
| Skeleton | ✓ | 3 | 6 |
| Tooltip | ✓ | 7 | 3 |

Import unique :

```tsx
import { Button, Badge, Tooltip } from '…/design-system/components/atoms';
```

### Exemples d'usage clinique

**Bouton avec chargement (mutation React Query, étape 3.2)**

```tsx
<Button loading={isSaving} onClick={handleSubmit}>
  Enregistrer la consultation
</Button>
```

**Badge de statut clinique**

```tsx
<Badge variant="danger" dot>Allergies sévères</Badge>
<Badge variant="success">Stable</Badge>
```

**Champ validé (react-hook-form + zod)**

```tsx
<Input
  label="Numéro de sécurité sociale"
  required
  error={errors.nss?.message}
  helperText="15 chiffres, sans espaces"
  {...register('nss')}
/>
```

**Tooltip accessible sur un bouton icon-only**

```tsx
<Tooltip content="Imprimer l'ordonnance">
  <IconButton label="Imprimer l'ordonnance"><PrintIcon /></IconButton>
</Tooltip>
```

### Contract qualité de chaque composant

- ✅ TypeScript strict (zéro `any`), props typées et documentées
- ✅ Tous les états : default / hover / focus-visible / active / disabled / loading / error
- ✅ A11y : labels, `aria-*`, navigation clavier, live regions si besoin
- ✅ Dark mode via tokens sémantiques uniquement
- ✅ `prefers-reduced-motion` respecté
- ✅ CSS Modules (`.module.scss`), zéro `!important`, zéro valeur magique (tokens)
- ✅ Test Testing Library + stories CSF3

## Règles d'usage

1. **Un seul `primary` par vue** — l'action principale est évidente.
2. Verbes d'action sur les boutons ("Enregistrer la consultation"), jamais "OK".
3. Erreurs formulaires = quoi + pourquoi + comment corriger.
4. Skeletons pour les listes/fiches, spinner inline pour les actions.
5. Rouge = danger clinique réel, jamais décoratif.
6. Interdit de consommer `--blue-600` directement : passer par `--color-primary`.
7. Interdit d'ajouter des couleurs hors `primitive.scss`.
8. Storybook (activation future) : `npx storybook@latest init` détecte les
   stories CSF3 existantes sans modification (ADR-003).

## Étape 4 — DataTable & Form system

### DataTable (`design-system/components/organisms/DataTable`)

Grille div + rôles ARIA (`table`/`row`/`columnheader`/`cell`) : un seul
code path pour les listes normales et les listes virtualisées
(react-window `FixedSizeList` au-delà de **200 lignes**).

| Capacité | Détail |
|---|---|
| Tri | multi-colonnes (clic = 1er niveau, Shift+clic = 2e), `aria-sort` |
| Colonnes | masquables, persistées `gh.table.<storageKey>.hidden` |
| Densité | compact / normal / comfortable (persistée `gh.table.density`, tokens `--table-row-height-*`) |
| Sélection | header `indeterminate`, barre d'actions bulk, compteur |
| Export | CSV (BOM + `;` Excel FR), Excel `.xlsx` (xlsx), Imprimer/PDF (`window.print` + CSS print scopée) |
| Recherche | filtre rapide cliente sur les colonnes visibles |
| Pagination | cliente automatique ou serveur (`pagination` prop) |
| États | skeleton rows (8), EmptyState, actions au hover + focus |

```tsx
<DataTable
  ariaLabel="Liste des patients"
  data={patients}
  columns={[
    { key: 'nom', header: 'Nom', value: (p) => p.nom_patient },
    { key: 'sexe', header: 'Sexe', value: (p) => p.sexe, width: '80px' },
    { key: 'tel', header: 'Téléphone', value: (p) => p.tel, hiddenByDefault: true },
  ]}
  rowKey={(p) => p.id_patient}
  selectable
  bulkActions={[{ key: 'export', label: 'Exporter la sélection', onClick: (rows) => … }]}
  rowActions={(p) => <IconButton label={`Voir ${p.nom_patient}`} onClick={() => …}><ArrowLeftIcon /></IconButton>}
  onRowClick={(p) => navigate(`/patient/${p.id_patient}`)}
  storageKey="patients"
/>
```

**Règles** : `value` est la source de vérité (tri + export + recherche) ;
`render` est purement visuel. L'export porte sur le jeu filtré/trié,
pas seulement la page visible.

### Form system (`design-system/components/molecules/forms`)

Champs branchés **react-hook-form** (`Controller`) — validation zod
déclarée dans le formulaire via `zodResolver`. L'erreur s'affiche
après **300 ms de pause de frappe** (jamais pendant).

| Composant | Sous le capot | Points clés |
|---|---|---|
| `FormInput` | atome `Input` | types text/email/password/tel/number |
| `FormSelect` | atome `Select` natif | mobile-first, zéro dépendance |
| `FormDatePicker` | `input type="date"` natif | picker OS, mono (dates stables) |
| `FormAutocomplete` | combobox ARIA | debounce **250 ms**, `loadOptions`, ↑↓↵Échap, spinner |
| `FormFileUpload` | dropzone | glisser-déposer, `accept`, `maxSizeMB`, liste + retrait |

```tsx
const schema = z.object({ nom: z.string().min(3), patient: z.any() });
const { control, handleSubmit } = useForm({ resolver: zodResolver(schema) });

<FormInput name="nom" control={control} label="Nom du patient" required />
<FormAutocomplete
  name="patient" control={control} label="Patient"
  loadOptions={chercherPatients /* (q) => Promise<AutocompleteOption[]> */}
/>
```

### Hooks formulaire (`shared/hooks`)

- **`useDraftAutosave(key)`** — brouillon localStorage écrit debouncé
  (500 ms) : `saveDraft(values)` sur `watch()`, `loadDraft()` au
  montage, `clearDraft()` après soumission.
- **`useFormGuard(isDirty)` + `<FormGuardDialog blocker={blocker} />`** —
  confirmation d'abandon : `useBlocker` (navigation interne, data
  router actif) + `beforeunload` (reload/fermeture).
