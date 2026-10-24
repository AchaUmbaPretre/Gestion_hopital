import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag } from './Tag';

describe('Tag', () => {
  it('rend le contenu du tag', () => {
    render(<Tag>Cardiologie</Tag>);
    expect(screen.getByText('Cardiologie')).toBeInTheDocument();
  });

  it('sans onRemove : aucune croix rendue', () => {
    render(<Tag>Cardiologie</Tag>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('avec onRemove : croix accessible "Retirer X"', async () => {
    const handleRemove = jest.fn();
    render(<Tag onRemove={handleRemove}>Allergie pénicilline</Tag>);

    await userEvent.click(
      screen.getByRole('button', { name: 'Retirer Allergie pénicilline' }),
    );
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('croix désactivée : non cliquable', async () => {
    const handleRemove = jest.fn();
    render(<Tag onRemove={handleRemove} disabled>Diabète</Tag>);

    await userEvent.click(
      screen.getByRole('button', { name: 'Retirer Diabète' }),
    );
    expect(handleRemove).not.toHaveBeenCalled();
  });
});
