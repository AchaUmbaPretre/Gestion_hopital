import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('ne rend rien quand open=false', () => {
    render(
      <ConfirmDialog open={false} onClose={jest.fn()} onConfirm={jest.fn()} title="Test">
        Message
      </ConfirmDialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rend le dialog modal avec title et message', () => {
    render(
      <ConfirmDialog
        open
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Supprimer la facture ?"
        confirmLabel="Supprimer"
      >
        Cette action est définitive.
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cette action est définitive.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });

  it('confirme puis ferme', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Confirmer ?">
        …
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Échap annule (onClose)', async () => {
    const onClose = jest.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={jest.fn()} title="Confirmer ?">
        …
      </ConfirmDialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
