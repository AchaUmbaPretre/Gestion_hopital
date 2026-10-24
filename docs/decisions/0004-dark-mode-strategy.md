# ADR-0004 — Stratégie dark mode ([data-theme] + prefers-color-scheme)

**Statut** : Accepté · **Date** : 2026-10-24

## Contexte

Le brief demande un toggle dark mode persistant, détecté par défaut via
`prefers-color-scheme`, avec des surfaces sombres neutres (pas de noir
pur) et un contraste conservé. Contexte santé : utilisation de nuit aux
urgences, économie de fatigue visuelle.

## Décision

- `<html data-theme="light|dark">` est la source de vérité du rendu.
- Préférence utilisateur (`light|dark|auto`) persistée dans
  `localStorage['gh.theme']`, défaut **auto**.
- `ThemeProvider` (React) applique le thème et écoute `matchMedia` pour
  le mode auto en temps réel ; expose `useTheme()`.
- **Script anti-FOUC inline** dans `public/index.html` : le thème est
  posé avant le premier paint, sans flash blanc/sombre.
- Les mixins SCSS `theme-light`/`theme-dark` dans semantic.scss éliminent
  la duplication : un token = défini une fois par thème.
- Surfaces sombres : échelle `ink` bleutée (#0F172A → #283655) — neutres
  médicales, jamais #000. Pattern "inverted" sur les boutons primaires
  (fond blue-400 + texte ink-900) pour garantir ≥ 4.5:1.

## Conséquences

- ✅ Toggle disponible dans le menu utilisateur dès l'étape 3 (ThemeProvider
  déjà monté dans index.js).
- ✅ Aucun composant n'a besoin de connaître le thème courant pour le style.
- ⚠️ antd v5 utilise son propre algorithme dark (ConfigProvider theme) —
  le pont sera fait quand antd sera remplacé module par module ; en
  attendant antd reste en mode clair dans le dark (acceptable : les
  pages antd disparaissent progressivement).
