# ADR-0006 — Stack incrémentale : garder CRA, refuser le big bang

**Statut** : Accepté · **Date** : 2026-10-24

## Contexte

L'environnement de développement propose un scaffolding Next.js 16 par
défaut. Le brief impose : "NE PAS faire de big bang rewrite — livrer par
incréments fonctionnels", "NE PAS introduire de lib UI concurrente
(pas de MUI, Chakra, Tailwind)", "NE PAS toucher au backend".

## Décision

**Rester sur React CRA 5 (react-scripts 5, React 18, webpack) et faire
évoluer le code existant en place.**

Écartées :
- **Next.js 16** : migration = réécriture du routing (react-router → App
  Router), du data fetching, de la config. Risque maximal, valeur
  utilisateur immédiate nulle.
- **Vite** : gain de build appréciable mais reconfiguration complète
  (déviation, env vars, imports) — reporté en candidature post-refonte
  (CRA est en fin de vie, voir "dette acceptée").
- **Tailwind / shadcn** : interdits par le brief ; le design system
  maison (tokens + CSS Modules) est la fondation demandée.

## Dépendances ajoutées (justification taille)

| Paquet | Type | Coût |
|--------|------|------|
| typescript ^5.6 | dev | 0 KB runtime |
| @types/react, @types/react-dom, @types/node | dev | 0 KB runtime |
| @fontsource/inter ^5 | runtime | ~90 KB woff2 total, subsets latin uniquement |
| @fontsource/jetbrains-mono ^5 | runtime | ~36 KB woff2 |

Polices auto-hébergées : réseau hospitalier souvent fermé/latence forte,
conformité RGPD (zéro requête CDN tiers), préchargement contrôlé.

## Conséquences

- ✅ Chaque étape du MIGRATION_PLAN.md livre une app déployable.
- ✅ Le risque de régression est borné au périmètre du commit.
- ⚠️ **Dette acceptée** : CRA est en maintenance (ESLint v8 bloqué,
  builds lents). Migration Vite proposée APRÈS l'étape 7, comme commit
  isolé à risque maîtrisé (le design system n'utilise que des APIs
  standard, aucun couplage CRA).
