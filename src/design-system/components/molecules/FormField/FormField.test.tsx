import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('associe le label au contrôle via htmlFor', () => {
    render(
      <FormField label="Nom du patient" htmlFor="nom-patient">
        <input id="nom-patient" />
      </FormField>,
    );
    expect(screen.getByLabelText('Nom du patient')).toBeInTheDocument();
  });

  it('affiche le marqueur de champ requis', () => {
    render(
      <FormField label="Diagnostic" required>
        <input id="diag" />
      </FormField>,
    );
    const label = screen.getByText(/Diagnostic/);
    expect(label).toHaveTextContent('*');
  });

  it('annonce l’erreur via role="alert" et masque le hint', () => {
    render(
      <FormField label="Téléphone" hint="Format : +243…" error="Numéro invalide">
        <input id="tel" />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Numéro invalide');
    expect(screen.queryByText(/Format :/)).not.toBeInTheDocument();
  });
});
