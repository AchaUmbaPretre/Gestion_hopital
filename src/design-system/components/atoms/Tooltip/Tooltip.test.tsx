import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from './Tooltip';
import { Button } from '../Button/Button';

describe('Tooltip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderTooltip = () =>
    render(
      <Tooltip content="Numéro de dossier médical">
        <Button>DM-2024-001</Button>
      </Tooltip>,
    );

  it('n\u2019est pas visible initialement', () => {
    renderTooltip();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('apparaît au hover après le délai et est lié via aria-describedby', () => {
    renderTooltip();
    const button = screen.getByRole('button', { name: 'DM-2024-001' });

    fireEvent.mouseEnter(button);
    // Avant le délai : rien
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Après 300ms : visible + lié
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Numéro de dossier médical');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('disparaît à la sortie du hover', () => {
    renderTooltip();
    const button = screen.getByRole('button', { name: 'DM-2024-001' });

    fireEvent.mouseEnter(button);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('apparaît au focus clavier', () => {
    renderTooltip();
    const button = screen.getByRole('button', { name: 'DM-2024-001' });

    fireEvent.focus(button);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('se ferme avec Échap (WCAG 1.4.13)', () => {
    renderTooltip();
    const button = screen.getByRole('button', { name: 'DM-2024-001' });

    fireEvent.mouseEnter(button);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('contenu vide : jamais de tooltip', () => {
    render(
      <Tooltip content="">
        <Button>OK</Button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'OK' });
    fireEvent.mouseEnter(button);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
