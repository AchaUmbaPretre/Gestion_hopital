/**
 * Foundation typographique — polices auto-hébergées via @fontsource.
 *
 * Justification dépendance (ADR-006) :
 *  - Conformité santé : aucun appel CDN tiers (RGPD, réseau hospitalier
 *    fermé, offline-friendly). @fontsource embarque les fichiers dans le bundle.
 *  - Poids maîtrisé : seuls les subsets `latin` et les graisses utilisées
 *    sont chargés (4 × ~25 KB woff2 pour Inter, 2 × ~18 KB pour JetBrains Mono).
 *  - Alternative écartée : Google Fonts CDN (requête externe, RGPD, FOUT réseau).
 *
 * Fallbacks déclarés dans tokens/primitive.scss si les fichiers manquent.
 */

// Inter — UI principale
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';

// JetBrains Mono — données médicales : IDs, codes, montants, dosages
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
