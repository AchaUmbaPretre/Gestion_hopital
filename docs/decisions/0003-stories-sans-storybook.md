# ADR-0003 — Stories CSF3 sans dépendance Storybook immédiate

**Statut** : Accepté · **Date** : 2026-10-24

## Contexte

Le workflow demandé est "composant → stories Storybook → test →
intégration". Installer Storybook 8 dans un projet CRA ajoute ~250 MB de
devDeps et un outillage webpack parallèle, pour une valeur utilisable
plus tard (l'écran ne peut être validé qu'au moment du layout global).

## Décision

- Chaque atom est livré avec un fichier `.stories.tsx` au format **CSF3**
  standard (`export default meta` + exports nommés).
- Les types `Meta<T>`/`StoryObj<T>` sont remplacés par des types locaux
  structurellement compatibles (`atoms/_story-types.ts`) : le build CRA
  compile sans `@storybook/react`.
- Storybook sera activé à l'étape 3 (`npx storybook@latest init`) : les
  stories existantes sont consommées sans modification.

## Conséquences

- ✅ Zéro MB ajouté au bundle (les stories sont tree-shaken du build prod).
- ✅ Le "contrat story" force à réfléchir aux états de chaque composant.
- ⚠️ Les stories ne sont pas visualisables tant que Storybook n'est pas
  installé — compensé par les tests + la doc DESIGN_SYSTEM.md.
