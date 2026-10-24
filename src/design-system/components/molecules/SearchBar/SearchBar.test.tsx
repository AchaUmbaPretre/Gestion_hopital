import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

function Controlled({ onClear }: { onClear?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchBar
      label="Rechercher un patient"
      value={value}
      onChange={setValue}
      onClear={onClear}
    />
  );
}

describe('SearchBar', () => {
  it('saisit et propage la valeur (contrôlé)', async () => {
    render(<Controlled />);
    const input = screen.getByRole('searchbox', { name: 'Rechercher un patient' });
    await userEvent.type(input, 'kabila');
    expect(input).toHaveValue('kabila');
  });

  it('soumet via le formulaire', async () => {
    const onSubmit = jest.fn();
    render(
      <SearchBar label="Chercher" value="abc" onChange={jest.fn()} onSubmit={onSubmit} />,
    );
    await userEvent.type(screen.getByRole('searchbox'), '{enter}');
    expect(onSubmit).toHaveBeenCalledWith('abc');
  });

  it('affiche le bouton effacer seulement quand il y a du texte', async () => {
    render(<Controlled onClear={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'a');
    expect(screen.getByRole('button', { name: 'Effacer la recherche' })).toBeInTheDocument();
  });
});
