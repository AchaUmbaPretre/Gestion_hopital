import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('est caché aux lecteurs d\u2019écran (aria-hidden)', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('applique les dimensions fournies', () => {
    const { container } = render(
      <Skeleton variant="rectangular" width={200} height={80} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('80px');
  });

  it('animated=false : pas d\u2019animation shimmer', () => {
    const { container } = render(<Skeleton animated={false} />);
    const el = container.firstElementChild as HTMLElement;
    // La classe d'animation n'est pas présente (identity-obj-proxy en Jest)
    expect(el.className).not.toContain('animated');
  });
});
