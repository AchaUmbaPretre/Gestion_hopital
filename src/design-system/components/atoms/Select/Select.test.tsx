import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const SPECIALTIES = [
  { label: 'Cardiologie', value: 'cardio' },
  { label: 'Pédiatrie', value: 'pedia' },
  { label: 'Radiologie', value: 'radio' },
];

describe('Select', () => {
  it('rend toutes les options', () => {
    render(<Select label="Spécialité" options={SPECIALTIES} />);
    expect(screen.getByLabelText('Spécialité')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cardiologie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pédiatrie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Radiologie' })).toBeInTheDocument();
  });

  it('sélectionne une option', async () => {
    render(<Select label="Spécialité" options={SPECIALTIES} />);
    await userEvent.selectOptions(
      screen.getByLabelText('Spécialité'),
      'pedia',
    );
    expect(screen.getByLabelText('Spécialité')).toHaveValue('pedia');
  });

  it('affiche le placeholder comme option vide par défaut', () => {
    render(
      <Select label="Spécialité" options={SPECIALTIES} placeholder="Choisir une spécialité" />,
    );
    expect(
      screen.getByRole('option', { name: 'Choisir une spécialité' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Spécialité')).toHaveValue('');
  });

  it('en erreur : aria-invalid + message role=alert', () => {
    render(
      <Select
        label="Spécialité"
        options={SPECIALTIES}
        error="Ce champ est requis"
      />,
    );
    expect(screen.getByLabelText('Spécialité')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ce champ est requis');
  });

  it('désactive une option individuellement', () => {
    render(
      <Select
        label="Spécialité"
        options={[...SPECIALTIES, { label: 'Anesthésie', value: 'anes', disabled: true }]}
      />,
    );
    expect(screen.getByRole('option', { name: 'Anesthésie' })).toBeDisabled();
  });

  it('helper text lié via aria-describedby', () => {
    render(
      <Select
        label="Service"
        options={SPECIALTIES}
        helperText="Le service détermine la tarification"
      />,
    );
    expect(screen.getByLabelText('Service')).toHaveAttribute('aria-describedby');
  });
});
