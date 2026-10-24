import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

function Demo() {
  const { success, error } = useToast();
  return (
    <>
      <button type="button" onClick={() => success('Patient enregistré', 'Fiche mise à jour')}>
        succès
      </button>
      <button type="button" onClick={() => error('Échec de la connexion API')}>
        erreur
      </button>
    </>
  );
}

describe('Toast', () => {
  it('affiche un toast de succès avec description', async () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'succès' }));
    expect(screen.getByText('Patient enregistré')).toBeInTheDocument();
    expect(screen.getByText('Fiche mise à jour')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('annonce les erreurs en role="alert"', async () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'erreur' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Échec de la connexion API');
  });

  it('se referme via le bouton de fermeture', async () => {
    jest.useFakeTimers();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'succès' }));
    await userEvent.click(screen.getByRole('button', { name: /Fermer : Patient enregistré/ }));
    expect(screen.queryByText('Patient enregistré')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('disparaît après la durée par défaut', async () => {
    jest.useFakeTimers();
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'succès' }));
    });
    act(() => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.queryByText('Patient enregistré')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
