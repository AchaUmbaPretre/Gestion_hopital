# ADR-0001 — Tokens de design en 3 niveaux

**Statut** : Accepté · **Date** : 2026-10-24 · **Décideur** : Product Design + Frontend

## Contexte

Le code existant contient des valeurs magiques éparpillées dans des SCSS
globaux par page (couleurs hexadécimales dupliquées, espacements
incohérents). Une refonte UI sans fondation tokenisée reproduirait la
dette. Le mode sombre et l'audit de contraste (WCAG 2.2 AA) exigent une
source de vérité unique.

## Décision

Architecture en 3 niveaux stricte :

1. **primitive.scss** — valeurs brutes sans intention (`--blue-600`,
   `--space-4`). Exposées en CSS custom properties pour l'inspectabilité.
2. **semantic.scss** — intentions (`--color-primary`, `--color-bg-surface`,
   `--color-status-danger`), composées depuis les primitives via `@use`.
   C'est le SEUL niveau que les composants consomment pour les couleurs.
3. **component.scss** — dimensions de composants (`--button-height-md`).

## Conséquences

- ✅ Dark mode = réassignation des tokens sémantiques (zéro duplication CSS).
- ✅ Audit de contraste centralisé : chaque ratio est documenté dans
  semantic.scss au moment de définir le token.
- ✅ Rebranding = éditer primitive.scss.
- ⚠️ Discipline requise : interdire `--blue-600` dans les composants
  (revue de code + lint futur).
- ⚠️ Les primitives CSS vars augmentent légèrement le CSS final (~4 KB)
  — négligeable face à l'inspectabilité.
