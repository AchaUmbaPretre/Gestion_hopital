/**
 * Smoke test — l'app se monte et protège les routes.
 * Sans session persistée → redirection /login → formulaire visible.
 */
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { QueryProvider } from './app/providers/QueryProvider';
import { ToastProvider } from './design-system/components/molecules/Toast/Toast';
import AppRouter from './app/router/AppRouter';

test('redirige vers la page de connexion quand aucune session n’existe', async () => {
  render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <AppRouter />
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </PersistGate>
    </Provider>,
  );

  const heading = await screen.findByRole('heading', { name: /se connecter/i }, { timeout: 10000 });
  expect(heading).toBeInTheDocument();
});
