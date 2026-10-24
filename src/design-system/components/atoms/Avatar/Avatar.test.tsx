import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('affiche les initiales en fallback (pas d\u2019image fournie)', () => {
    render(<Avatar name="Marie Dupont" />);
    expect(screen.getByText('MD')).toBeInTheDocument();
  });

  it('les initiales sont annoncées par le nom complet (role=img)', () => {
    render(<Avatar name="Marie Dupont" />);
    expect(screen.getByRole('img', { name: 'Marie Dupont' })).toBeInTheDocument();
  });

  it('rend l\u2019image quand src est fourni', () => {
    render(<Avatar name="Marie Dupont" src="/marie.png" alt="Portrait" />);
    const img = screen.getByRole('img', { name: 'Portrait' });
    expect(img).toHaveAttribute('src', '/marie.png');
  });

  it('repli sur les initiales si l\u2019image échoue', () => {
    render(<Avatar name="Jean Martin" src="/broken.png" />);
    const img = screen.getByRole('img', { name: 'Jean Martin' });
    fireEvent.error(img);
    expect(screen.getByText('JM')).toBeInTheDocument();
  });

  it('initiales basées sur le premier et le dernier mot', () => {
    render(<Avatar name="Marie Claire Dupont Saint-Exupéry" />);
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('statut : libellé annoncé en sr-only', () => {
    render(<Avatar name="Dr Sidi" status="online" />);
    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });
});
