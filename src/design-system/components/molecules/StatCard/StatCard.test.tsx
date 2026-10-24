import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('affiche label, valeur et tendance', () => {
    render(
      <StatCard
        label="Patients admis"
        value={128}
        trend={{ direction: 'up', label: '+12 % cette semaine' }}
      />,
    );
    expect(screen.getByText('Patients admis')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('+12 % cette semaine')).toBeInTheDocument();
  });

  it('rend un bouton navigable quand onClick est fourni', async () => {
    const onClick = jest.fn();
    render(<StatCard label="RDV du jour" value={9} onClick={onClick} />);
    const card = screen.getByRole('button', { name: /RDV du jour/ });
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('affiche un skeleton en chargement (pas de valeur figée)', () => {
    render(<StatCard label="Factures" value={0} loading />);
    expect(screen.queryByText('Factures')).toBeInTheDocument();
    // La valeur n'est pas rendue pendant le chargement.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
