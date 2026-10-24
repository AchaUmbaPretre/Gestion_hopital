# Design System — Motion

Philosophie : **le mouvement guide l'attention, il ne la réclame jamais.**
Contexte santé = urgence possible → aucune animation ne doit retarder une
action critique.

## Règles

| Type | Durée max | Easing | Usage |
|------|-----------|--------|-------|
| Micro (hover, focus, toggle) | 150ms | `var(--ease-out)` | feedback instantané |
| Macro (modals, drawers, transitions de page) | 250ms | `var(--ease-in-out)` | changement de contexte |
| Entrées de listes (stagger) | 30ms/item | `var(--ease-spring)` | cards, rows |
| Limite absolue | **400ms** | — | aucune exception (urgence santé) |

## Tokens disponibles (primitive.scss)

- Durées : `--duration-instant` (100ms), `--duration-fast` (150ms),
  `--duration-normal` (250ms), `--duration-slow` (400ms).
- Courbes : `--ease-out`, `--ease-in-out`, `--ease-spring`.

## Accessibilité

Toute animation du design system DOIT respecter `prefers-reduced-motion`.
Le garde-fou global est installé dans `tokens/index.scss` :
les animations et transitions sont réduites à ~0ms quand l'utilisateur
demande moins de mouvement (exception documentée au pattern WCAG,
voir docs/decisions/0005-garde-fou-reduced-motion.md).

## Intégration Framer Motion (étape 3 — layout global)

Framer Motion sera ajouté à l'étape 3 (layouts + navigation) avec
justification de taille (`framer-motion` ≈ 30 KB gzip). En attendant :

- Les transitions CSS via tokens couvrent tous les besoins actuels.
- Spécifications cibles : page fade + slide 8px (`--duration-normal`),
  springs listes `stiffness: 300, damping: 30`, stagger `30ms`.
