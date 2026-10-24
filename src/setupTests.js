// jest-dom ajoute les matchers personnalisés (toBeInTheDocument…).
import '@testing-library/jest-dom';

// ⚠️ react-scripts 5 force `resetMocks: true` : les implémentations
// posées à l'installation sont EFFACÉES avant chaque test. On
// ré-applique donc l'implémentation dans un beforeEach (pattern
// canonique CRA + matchMedia).
const matchMediaMock = jest.fn();

window.matchMedia = matchMediaMock;

beforeEach(() => {
  matchMediaMock.mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // legacy API (antd 4)
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

// ScrollIntoView (palette ⌘K, pagination) — absent de jsdom.
// Aucune implémentation nécessaire : resetMocks n'affecte pas le
// comportement "no-op" attendu.
Element.prototype.scrollIntoView = jest.fn();
