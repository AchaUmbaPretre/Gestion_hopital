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
// Reset global (box-sizing, typo tokens, focus-visible) — étape 3,
// remplace le reset Poppins hérité de App.css.
import './design-system/foundation/reset.scss';
// ThemeProvider : dark mode ([data-theme] + prefers-color-scheme).
import { ThemeProvider } from './app/providers/ThemeProvider';
// QueryProvider : server state via @tanstack/react-query (étape 3.2).
import { QueryProvider } from './app/providers/QueryProvider';
// ToastProvider : notifications (remplace react-toastify, étape 3).
import { ToastProvider } from './design-system/components/molecules/Toast/Toast';
// ----------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ThemeProvider>
        <QueryProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </QueryProvider>
      </ThemeProvider>
    </PersistGate>
  </Provider>,
);


reportWebVitals();
