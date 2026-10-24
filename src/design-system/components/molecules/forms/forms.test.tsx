import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormInput } from './FormInput/FormInput';
import { FormSelect } from './FormSelect/FormSelect';
import { FormDatePicker } from './FormDatePicker/FormDatePicker';
import { FormAutocomplete } from './FormAutocomplete/FormAutocomplete';
import { FormFileUpload } from './FormFileUpload/FormFileUpload';
import { FormField } from '../FormField/FormField';

const schema = z.object({
  nom: z.string().min(3, 'Au moins 3 caractères'),
  service: z.string().min(1, 'Sélectionnez un service'),
  date: z.string().min(1, 'Date requise'),
  patient: z.object({ value: z.string(), label: z.string() }).nullable(),
  piece: z.any().nullable(),
});

type Values = z.infer<typeof schema>;

function Harness({ onValues }: { onValues?: (values: Values) => void }) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { nom: '', service: '', date: '', patient: null, piece: null },
    mode: 'onChange',
  });

  return (
    <form onSubmit={handleSubmit((values) => onValues?.(values))} noValidate>
      <FormInput name="nom" control={control} label="Nom du patient" required />
      <FormSelect
        name="service"
        control={control}
        label="Service"
        placeholder="Choisir…"
        options={[
          { label: 'Maternité', value: 'maternite' },
          { label: 'Urgences', value: 'urgences' },
        ]}
      />
      <FormDatePicker name="date" control={control} label="Date de consultation" required />
      <FormAutocomplete
        name="patient"
        control={control}
        label="Patient"
        loadOptions={async (query) =>
          query.includes('ka')
            ? [{ value: '1', label: 'Jean Kabila', meta: '+243…' }]
            : []
        }
      />
      <FormFileUpload name="piece" control={control} label="Pièce jointe" maxSizeMB={1} />
      <button type="submit">Enregistrer</button>
    </form>
  );
}

describe('Form system', () => {
  it('FormInput : champ fonctionnel, requis lié au label', async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/Nom du patient/);
    await userEvent.type(input, 'Jean Kabila');
    expect(input).toHaveValue('Jean Kabila');
    expect(input).toBeRequired();
  });

  it('FormInput : l’erreur zod apparaît après la pause de frappe (300ms)', async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/Nom du patient/);
    await userEvent.type(input, 'ab'); // trop court
    // Immédiatement après la frappe : pas encore d'erreur visible.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole('alert')).toHaveTextContent('Au moins 3 caractères'),
      { timeout: 1500 },
    );
  });

  it('FormSelect : sélectionne une option', async () => {
    render(<Harness />);
    const select = screen.getByLabelText(/Service/);
    await userEvent.selectOptions(select, 'urgences');
    expect(select).toHaveValue('urgences');
  });

  it('FormDatePicker : input date natif avec valeur ISO', async () => {
    render(<Harness />);
    const date = screen.getByLabelText(/Date de consultation/);
    expect(date).toHaveAttribute('type', 'date');
    await userEvent.type(date, '2026-10-24');
    expect(date).toHaveValue('2026-10-24');
  });

  it('FormAutocomplete : debounce 250ms puis options serveur, sélection clavier', async () => {
    render(<Harness />);
    const combo = screen.getByRole('combobox', { name: /Patient/ });
    await userEvent.type(combo, 'ka');

    // Options chargées après le debounce + la requête asynchrone.
    const option = await screen.findByRole('option', { name: /Jean Kabila/ }, { timeout: 2000 });
    expect(option).toHaveAttribute('aria-selected', 'false');

    await userEvent.type(combo, '{arrowdown}{enter}');
    expect(combo.getAttribute('aria-expanded')).toBe('false');
    // La sélection est affichée dans la zone de sélection.
    expect(screen.getAllByText('Jean Kabila').length).toBeGreaterThan(0);
  });

  it('FormAutocomplete : aucun résultat annonce un état vide', async () => {
    render(<Harness />);
    const combo = screen.getByRole('combobox', { name: /Patient/ });
    await userEvent.type(combo, 'zz');
    expect(await screen.findByText('Aucun résultat', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('FormFileUpload : sélection + liste avec taille + retrait', async () => {
    render(<Harness />);
    const dropzone = screen.getByText(/Glissez-déposez ou/).closest('[role="button"]') as HTMLElement;
    const file = new File(['contenu'], 'ordonnance.pdf', { type: 'application/pdf' });
    await userEvent.upload(
      screen.getByLabelText(/Pièce jointe/) as HTMLInputElement,
      file,
    );
    expect(screen.getByText('ordonnance.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 Ko')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retirer ordonnance.pdf' }));
    expect(screen.queryByText('ordonnance.pdf')).not.toBeInTheDocument();
    expect(dropzone).toBeInTheDocument();
  });

  it('FormField reste compatible (habillage manuel)', () => {
    render(
      <FormField label="Champ libre" htmlFor="libre" hint="Indication">
        <input id="libre" />
      </FormField>,
    );
    expect(screen.getByLabelText('Champ libre')).toBeInTheDocument();
    expect(screen.getByText('Indication')).toBeInTheDocument();
  });
});
