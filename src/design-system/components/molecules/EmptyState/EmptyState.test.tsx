import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('affiche titre et description', () => {
    render(
      <EmptyState
        title="Aucun patient trouvé"
        description="Modifiez vos filtres ou créez une nouvelle fiche patient."
      />,
    );
    expect(screen.getByText('Aucun patient trouvé')).toBeInTheDocument();
    expect(
      screen.getByText(/Modifiez vos filtres ou créez une nouvelle fiche/),
    ).toBeInTheDocument();
  });

  it('propose l’action suivante', async () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="Aucun résultat"
        action={<button type="button" onClick={onClick}>Nouveau patient</button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau patient' }));
    expect(onClick).toHaveBeenCalled();
  });
});
