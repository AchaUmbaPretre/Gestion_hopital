# ADR-0002 — Migration TypeScript progressive (CRA)

**Statut** : Accepté · **Date** : 2026-10-24

## Contexte

Le brief exige "TypeScript strict partout, zéro any" (Phase 3.5), mais
l'application est 100 % .jsx (≈ 100 fichiers). Une conversion massive
viole la règle "pas de big bang rewrite" et bloquerait toute livraison
fonctionnelle pendant des semaines.

## Décision

- Ajout de `typescript` + `@types/react` + `@types/react-dom` en devDeps.
- `tsconfig.json` avec `strict: true`, `noUncheckedIndexedAccess: true`,
  `noUnusedLocals/Parameters: true`, `allowJs: true`, `checkJs: false`.
- **Tout nouveau fichier = .tsx/.ts strict.** Les fichiers .jsx existants
  ne sont PAS vérifiés (checkJs: false) et continuent de compiler.
- Un module .jsx est converti en .tsx uniquement quand il est touché
  par une refonte de module (étape 5) — jamais "au passage".

## Conséquences

- ✅ Le design system et les futures features sont typés strictement dès
  le premier commit.
- ✅ Zéro interruption de service pendant la migration.
- ⚠️ Les frontières JS→TS sont typées faiblement tant que le module JS
  n'est pas converti — acceptable et tracé.
- ⚠️ `noUncheckedIndexedAccess` a déjà attrapé un vrai bug potentiel
  (Avatar hue) : validé.
