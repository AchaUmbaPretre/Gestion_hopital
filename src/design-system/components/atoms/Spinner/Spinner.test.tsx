import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('annonce "Chargement…" aux lecteurs d\u2019écran par défaut (role=status)', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
  });

  it('decorative : aucune annonce (usage dans Button loading)', () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('libellé personnalisable', () => {
    render(<Spinner label="Suppression en cours…" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Suppression en cours…',
    );
  });
});
