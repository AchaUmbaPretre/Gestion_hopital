import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import { buildCsv, sortRows, toggleSort, type DataColumn } from './dataTableTypes';

interface Patient {
  id: number;
  nom: string;
  age: number;
  service: string;
}

const patients: Patient[] = [
  { id: 1, nom: 'Kabila', age: 34, service: 'Maternité' },
  { id: 2, nom: 'Mbuyi', age: 51, service: 'Urgences' },
  { id: 3, nom: 'Ilunga', age: 27, service: 'Maternité' },
];

const columns: DataColumn<Patient>[] = [
  { key: 'nom', header: 'Nom', value: (row) => row.nom },
  { key: 'age', header: 'Âge', value: (row) => row.age, align: 'right', width: '80px' },
  { key: 'service', header: 'Service', value: (row) => row.service },
];

describe('DataTable', () => {
  it('affiche les en-têtes et les lignes', () => {
    render(
      <DataTable data={patients} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" />,
    );
    expect(screen.getByRole('table', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Kabila' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Urgences' })).toBeInTheDocument();
  });

  it('trie asc puis desc au clic sur un en-tête', async () => {
    const { container } = render(
      <DataTable data={patients} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" />,
    );
    const table = screen.getByRole('table', { name: 'Patients' });
    await userEvent.click(screen.getByRole('button', { name: /Nom/ }));
    expect(table.querySelector('[aria-sort="ascending"]')).not.toBeNull();
    const firstAsc = container.querySelectorAll('[role="row"]')[1]!.textContent;
    expect(firstAsc).toContain('Ilunga'); // I < K < M

    await userEvent.click(screen.getByRole('button', { name: /Nom/ }));
    expect(table.querySelector('[aria-sort="descending"]')).not.toBeNull();
  });

  it('filtre avec la recherche rapide', async () => {
    render(
      <DataTable data={patients} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" />,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'Maternité');
    expect(screen.getByRole('cell', { name: 'Kabila' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ilunga' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Mbuyi' })).not.toBeInTheDocument();
  });

  it('sélectionne des lignes et exécute une action bulk', async () => {
    const onExport = jest.fn();
    render(
      <DataTable
        data={patients}
        columns={columns}
        rowKey={(row) => row.id}
        ariaLabel="Patients"
        selectable
        bulkActions={[{ key: 'export', label: 'Exporter la sélection', onClick: onExport }]}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner la ligne 1' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner la ligne 3' }));
    expect(screen.getByText('2 sélectionné(s)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter la sélection' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const exported = onExport.mock.calls[0]![0] as Patient[];
    expect(exported.map((row) => row.nom)).toEqual(['Kabila', 'Ilunga']);
  });

  it('pagine côté client (pageSize 2)', async () => {
    render(
      <DataTable
        data={patients}
        columns={columns}
        rowKey={(row) => row.id}
        ariaLabel="Patients"
        pageSize={2}
      />,
    );
    expect(screen.getByRole('cell', { name: 'Kabila' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Ilunga' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByRole('cell', { name: 'Ilunga' })).toBeInTheDocument();
  });

  it('exécute onRowClick au clic et au clavier (Entrée)', async () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        data={patients}
        columns={columns}
        rowKey={(row) => row.id}
        ariaLabel="Patients"
        onRowClick={onRowClick}
      />,
    );
    const row = screen.getByRole('cell', { name: 'Kabila' }).closest('[role="row"]') as HTMLElement;
    await userEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith(patients[0]);
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('affiche l’EmptyState et les skeletons', () => {
    const { rerender } = render(
      <DataTable data={[]} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" />,
    );
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();

    rerender(
      <DataTable data={patients} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" loading />,
    );
    // 8 lignes de skeleton, aucune valeur réelle
    expect(screen.queryByRole('cell', { name: 'Kabila' })).not.toBeInTheDocument();
  });

  it('groupe d’en-tête : la case « tout sélectionner » devient indéterminée', async () => {
    render(
      <DataTable data={patients} columns={columns} rowKey={(row) => row.id} ariaLabel="Patients" selectable />,
    );
    const all = screen.getByRole('checkbox', { name: 'Tout sélectionner' }) as HTMLInputElement;
    expect(all.checked).toBe(false);
    await userEvent.click(all);
    expect(all.checked).toBe(true);
    expect(screen.getByText('3 sélectionné(s)')).toBeInTheDocument();
  });
});

describe('helpers DataTable (purs)', () => {
  it('buildCsv : BOM + séparateur ; + échappement des guillemets', () => {
    const csv = buildCsv(columns, patients);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Nom";"Âge";"Service"');
    expect(csv).toContain('"Kabila";"34";"Maternité"');
  });

  it('toggleSort : asc → desc ; Shift+clic ajoute un 2e niveau', () => {
    expect(toggleSort([], 'nom', false)).toEqual([{ key: 'nom', dir: 'asc' }]);
    expect(toggleSort([{ key: 'nom', dir: 'asc' }], 'nom', false)).toEqual([{ key: 'nom', dir: 'desc' }]);
    const two = toggleSort([{ key: 'nom', dir: 'asc' }], 'age', true);
    expect(two).toEqual([
      { key: 'nom', dir: 'asc' },
      { key: 'age', dir: 'asc' },
    ]);
  });

  it('sortRows : tri numérique puis chaîne, multi-niveaux', () => {
    const rules = [{ key: 'service', dir: 'asc' as const }, { key: 'age', dir: 'desc' as const }];
    const result = sortRows(patients, columns, rules);
    expect(result.map((row) => row.nom)).toEqual(['Kabila', 'Ilunga', 'Mbuyi']);
  });
});
