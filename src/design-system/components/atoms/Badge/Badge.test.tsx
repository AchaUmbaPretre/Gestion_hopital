import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('rend le texte du statut', () => {
    render(<Badge>Stable</Badge>);
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('statut critique affiché avec variante danger', () => {
    render(<Badge variant="danger" dot>Allergies sévères</Badge>);
    expect(screen.getByText('Allergies sévères')).toBeInTheDocument();
    // Le dot est décoratif (aria-hidden)
    expect(screen.getByText('Allergies sévères').querySelector('span')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('variantes de statut rendues sans erreur', () => {
    render(
      <>
        <Badge variant="success">Payée</Badge>
        <Badge variant="warning">En attente</Badge>
        <Badge variant="info">Analyse en cours</Badge>
        <Badge variant="neutral">Archivé</Badge>
      </>,
    );
    expect(screen.getByText('Payée')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Analyse en cours')).toBeInTheDocument();
    expect(screen.getByText('Archivé')).toBeInTheDocument();
  });

  it('accepte des attributs HTML additionnels (title…)', () => {
    render(<Badge title="Hémoglobine 13 g/dL">Normale</Badge>);
    expect(screen.getByText('Normale')).toHaveAttribute('title', 'Hémoglobine 13 g/dL');
  });
});
