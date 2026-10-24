# ADR-0005 — Garde-fou global prefers-reduced-motion

**Statut** : Accepté · **Date** : 2026-10-24

## Contexte

Le brief exige le respect de `prefers-reduced-motion` (Phase 1.2, 4.1).
La méthode WCAG standard applique un override global avec `!important` ;
la règle projet interdit `!important` en Sass.

## Décision

- Chaque composant du design system respecte `prefers-reduced-motion`
  **localement** (dans son `.module.scss`, sans `!important`) :
  Skeleton coupe son shimmer, Badge coupe le pulse, Tooltip coupe le fade,
  Spinner ralentit (l'activité reste perceptible).
- UN garde-fou global existe dans `tokens/index.scss` avec `!important`
  — **seule exception autorisée du codebase**, car un override de
  spécificité 0 (`*`) ne peut pas gagner contre les animations des
  bibliothèques tierces (antd, react-big-calendar) sans `!important`.
  Il protège les usagers vestibulaires contre les animations qu'on ne
  contrôle pas encore.

## Conséquences

- ✅ Conformité WCAG 2.2 (2.3.3) dès maintenant, y compris sur le code
  tiers non encore migré.
- ✅ Exception documentée, bornée, révocable : quand antd/rbc auront
  disparu, le garde-fou global pourra être supprimé si chaque composant
  gère sa reduced-motion locale.
- ⚠️ La revue de code interdira tout autre `!important` (lint règle
  `declaration-no-important` à l'étape 7).
