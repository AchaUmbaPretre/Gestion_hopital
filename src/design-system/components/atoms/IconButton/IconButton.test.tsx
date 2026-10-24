import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('expose un aria-label obligatoire (label prop)', () => {
    render(
      <IconButton label="Supprimer le patient Dupont">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(
      screen.getByRole('button', { name: 'Supprimer le patient Dupont' }),
    ).toBeInTheDocument();
  });

  it('affiche le label en title (tooltip natif)', () => {
    render(
      <IconButton label="Modifier">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Modifier' })).toHaveAttribute(
      'title',
      'Modifier',
    );
  });

  it('répond au clic', async () => {
    const handleClick = jest.fn();
    render(
      <IconButton label="Rafraîchir" onClick={handleClick}>
        <svg aria-hidden="true" />
      </IconButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rafraîchir' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('loading : désactivé et aria-busy', () => {
    render(
      <IconButton label="Enregistrer" loading>
        <svg aria-hidden="true" />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
