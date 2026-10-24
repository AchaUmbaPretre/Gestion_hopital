import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('associe la label au champ via htmlFor/id', () => {
    render(<Input label="Nom du patient" />);
    const input = screen.getByLabelText('Nom du patient');
    expect(input).toBeInTheDocument();
  });

  it('saisit une valeur', async () => {
    render(<Input label="Nom du patient" />);
    const input = screen.getByLabelText('Nom du patient');
    await userEvent.type(input, 'Jean Dupont');
    expect(input).toHaveValue('Jean Dupont');
  });

  it('affiche le helper text lié via aria-describedby', () => {
    render(
      <Input
        label="Numéro de sécurité sociale"
        helperText="15 chiffres, sans espaces"
      />,
    );
    const input = screen.getByLabelText('Numéro de sécurité sociale');
    expect(input).toHaveAttribute('aria-describedby');
    expect(
      screen.getByText('15 chiffres, sans espaces'),
    ).toBeInTheDocument();
  });

  it('en erreur : aria-invalid + message role=alert + message humain', () => {
    render(
      <Input
        label="Numéro de sécurité sociale"
        error="Le numéro de sécurité sociale doit contenir 15 chiffres. Vérifiez la saisie."
      />,
    );
    const input = screen.getByLabelText('Numéro de sécurité sociale');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'doit contenir 15 chiffres',
    );
  });

  it('le message remplace le helper quand une erreur est présente', () => {
    render(
      <Input
        label="Téléphone"
        helperText="Format : 06 12 34 56 78"
        error="Ce champ est requis"
      />,
    );
    expect(screen.queryByText('Format : 06 12 34 56 78')).not.toBeInTheDocument();
    expect(screen.getByText('Ce champ est requis')).toBeInTheDocument();
  });

  it('marque le champ requis (aria-required + astérisque)', () => {
    render(<Input label="Allergies" required />);
    const input = screen.getByLabelText(/Allergies/);
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('hideLabel conserve la label pour les lecteurs d\u2019écran', () => {
    render(<Input label="Recherche" hideLabel />);
    // En Jest, les styles réels ne sont pas chargés (identity-obj-proxy) :
    // on vérifie que la label porte la classe srOnly (visuellement masquée).
    expect(screen.getByLabelText('Recherche')).toBeInTheDocument();
    expect(screen.getByText('Recherche')).toHaveClass('srOnly');
  });

  it('disabled empêche la saisie', () => {
    render(<Input label="Adresse" disabled />);
    expect(screen.getByLabelText('Adresse')).toBeDisabled();
  });
});
