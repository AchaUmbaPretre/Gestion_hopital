import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import { store, persistor } from "./redux/store";
import { PersistGate } from 'redux-persist/integration/react'

// ---- Design System (refonte UI 2024) — branchement additif ----
// Polices auto-hébergées (Inter + JetBrains Mono) — voir
// src/design-system/foundation/fonts.ts
import './design-system/foundation/fonts';
// Tokens 3 niveaux (primitive → semantic → component) + garde-fou
// reduced-motion. Charge une seule fois, ici.
import './design-system/tokens/index.scss';
// ThemeProvider : dark mode ([data-theme] + prefers-color-scheme).
import { ThemeProvider } from './app/providers/ThemeProvider';
// ----------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PersistGate>
  </Provider>,
);


reportWebVitals();
