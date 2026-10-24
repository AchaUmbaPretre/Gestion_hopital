import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('rend le libellé et répond au clic', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Enregistrer la consultation</Button>);

    await userEvent.click(
      screen.getByRole('button', { name: 'Enregistrer la consultation' }),
    );
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('est de type button par défaut (pas de soumission accidentelle de form)', () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('en état loading : désactivé, aria-busy, spinner visible', () => {
    render(<Button loading>Enregistrer</Button>);

    const button = screen.getByRole('button', { name: /Enregistrer/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    // Le spinner decorative est rendu (svg aria-hidden)
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('disabled ne déclenche pas le clic', async () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Supprimer
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('propage les libellés d\'action (microcopy verbe d\'action)', () => {
    render(<Button variant="danger">Supprimer définitivement</Button>);
    expect(
      screen.getByRole('button', { name: 'Supprimer définitivement' }),
    ).toBeInTheDocument();
  });

  it('rend les icônes gauche/droite', () => {
    render(
      <Button
        iconLeft={<span data-testid="icon-left" />}
        iconRight={<span data-testid="icon-right" />}
      >
        Nouveau patient
      </Button>,
    );
    expect(screen.getByTestId('icon-left')).toBeInTheDocument();
    expect(screen.getByTestId('icon-right')).toBeInTheDocument();
  });

  it('cachent les icônes pendant le loading', () => {
    render(
      <Button loading iconLeft={<span data-testid="icon-left" />}>
        Enregistrer
      </Button>,
    );
    expect(screen.queryByTestId('icon-left')).not.toBeInTheDocument();
  });

  it('peut recevoir le focus clavier', () => {
    render(<Button>Enregistrer</Button>);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    button.focus();
    expect(button).toHaveFocus();
  });
});
