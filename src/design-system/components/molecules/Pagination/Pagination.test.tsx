import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('ne rend rien pour une seule page', () => {
    render(<Pagination page={1} pageCount={1} onChange={jest.fn()} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('marque la page courante avec aria-current', () => {
    render(<Pagination page={2} pageCount={5} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 3' })).not.toHaveAttribute('aria-current');
  });

  it('navigue page suivante / précédente', async () => {
    const onChange = jest.fn();
    render(<Pagination page={2} pageCount={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Page précédente' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('désactive "précédente" sur la première page', () => {
    render(<Pagination page={1} pageCount={5} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
  });

  it('insère des ellipses quand la plage est grande', () => {
    render(<Pagination page={5} pageCount={20} onChange={jest.fn()} />);
    expect(screen.getAllByText('…').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Page 20' })).toBeInTheDocument();
  });
});
