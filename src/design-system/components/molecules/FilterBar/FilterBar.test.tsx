import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('masque la barre sans filtre ni children', () => {
    render(<FilterBar filters={[]} onRemove={jest.fn()} />);
    expect(screen.queryByLabelText('Filtres actifs')).not.toBeInTheDocument();
  });

  it('affiche les chips supprimables', async () => {
    const onRemove = jest.fn();
    render(
      <FilterBar
        filters={[
          { key: 'sexe', label: 'Sexe : F' },
          { key: 'service', label: 'Service : Maternité' },
        ]}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('Sexe : F')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Sexe : F' }));
    expect(onRemove).toHaveBeenCalledWith('sexe');
  });

  it('efface tous les filtres', async () => {
    const onClearAll = jest.fn();
    render(
      <FilterBar filters={[{ key: 'sexe', label: 'Sexe : F' }]} onRemove={jest.fn()} onClearAll={onClearAll} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
