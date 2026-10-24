import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  it('rend les liens et le courant (aria-current)', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Patients', href: '/liste_patient' },
          { label: 'Jean Kabila' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.getByText('Jean Kabila')).toHaveAttribute('aria-current', 'page');
  });

  it('condense les fils longs derrière un bouton …', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Niveau 2', href: '/a' },
          { label: 'Niveau 3', href: '/b' },
          { label: 'Niveau 4', href: '/c' },
          { label: 'Fiche finale' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /Afficher tous les niveaux/ })).toBeInTheDocument();
    expect(screen.queryByText('Niveau 3')).not.toBeInTheDocument();
    expect(screen.getByText('Fiche finale')).toBeInTheDocument();
  });

  it('déplie tous les niveaux au clic sur …', async () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Niveau 2', href: '/a' },
          { label: 'Niveau 3', href: '/b' },
          { label: 'Niveau 4', href: '/c' },
          { label: 'Fiche finale' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Afficher tous les niveaux/ }));
    expect(screen.getByText('Niveau 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Afficher tous les niveaux/ })).not.toBeInTheDocument();
  });
});
