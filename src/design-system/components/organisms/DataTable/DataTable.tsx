/**
 * DataTable — organisme de liste (étape 4, brief 2.3).
 * Grille div + rôles ARIA (table/row/cell) : une seule code path
 * pour ≤ 200 lignes et > 200 lignes (react-window FixedSizeList).
 * - Tri multi-colonnes (clic / Shift+clic), aria-sort
 * - Colonnes masquables, persistées localStorage (storageKey)
 * - Densité persistée (compact/normal/comfortable → tokens table)
 * - Sélection multiple + barre d'actions bulk
 * - Export CSV (BOM ; ) / Excel (xlsx) / PDF via impression
 * - Recherche rapide cliente + slot toolbar (FilterBar)
 * - Skeleton rows, EmptyState, actions rapides au hover
 * Aucune dépendance UI : tokens + atoms du design system.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FixedSizeList } from 'react-window';
import * as XLSX from 'xlsx';
import { Button, IconButton, Skeleton } from '../../atoms';
import { SearchBar } from '../../molecules/SearchBar/SearchBar';
import { EmptyState } from '../../molecules/EmptyState/EmptyState';
import { Pagination } from '../../molecules/Pagination/Pagination';
import {
  ChevronDownIcon,
  FileTextIcon,
  GridIcon,
  InboxIcon,
  TableIcon,
  XIcon,
} from '../../../foundation/icons';
import { useDismiss, usePersistentState } from '../../../../shared/hooks';
import {
  buildCsv,
  cellValue,
  downloadFile,
  matchesQuickFilter,
  sortRows,
  toggleSort,
  VIRTUAL_THRESHOLD,
  type BulkAction,
  type DataColumn,
  type Density,
  type ServerPagination,
  type SortRule,
} from './dataTableTypes';
import styles from './dataTable.module.scss';

const ROW_HEIGHT: Record<Density, number> = {
  compact: 40,
  normal: 48,
  comfortable: 56,
};
const LIST_MAX_HEIGHT = 480;
const SKELETON_ROWS = 8;

export interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string | number;
  ariaLabel: string;
  loading?: boolean;
  /** Recherche rapide cliente (défaut true). */
  searchable?: boolean;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  /** Boutons d'action affichés au hover de ligne (ou focus). */
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Pagination serveur ; absente = pagination cliente automatique. */
  pagination?: ServerPagination;
  pageSize?: number;
  /** Persiste les colonnes masquées sous gh.table.<storageKey>.hidden. */
  storageKey?: string;
  /** Slot au-dessus de la table (FilterBar, filtres avancés…). */
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  exportFileName?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  ariaLabel,
  loading = false,
  searchable = true,
  selectable = false,
  bulkActions = [],
  rowActions,
  onRowClick,
  pagination,
  pageSize = 10,
  storageKey,
  toolbar,
  emptyState,
  exportFileName = 'export',
  className,
}: DataTableProps<T>) {
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [quickFilter, setQuickFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [density, setDensity] = usePersistentState<Density>('gh.table.density', 'normal');
  const [clientPage, setClientPage] = useState(1);

  const columnsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  useDismiss({ enabled: columnsMenuOpen, ref: columnsRef, onDismiss: () => setColumnsMenuOpen(false) });
  useDismiss({ enabled: exportMenuOpen, ref: exportRef, onDismiss: () => setExportMenuOpen(false) });

  const persistenceKey = storageKey ? `gh.table.${storageKey}.hidden` : null;
  const [hiddenPersisted, setHiddenPersisted] = usePersistentState<string[]>(
    persistenceKey ?? 'gh.table.hidden.volatile',
    columns.filter((column) => column.hiddenByDefault).map((column) => column.key),
  );
  const hiddenKeys = hiddenPersisted;

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenKeys.includes(column.key)),
    [columns, hiddenKeys],
  );

  const filtered = useMemo(
    () => (searchable ? data.filter((row) => matchesQuickFilter(row, columns, quickFilter)) : data),
    [data, columns, quickFilter, searchable],
  );

  const sorted = useMemo(() => sortRows(filtered, columns, sortRules), [filtered, columns, sortRules]);

  // Pagination : serveur si fournie, sinon cliente automatique.
  const total = pagination ? pagination.total : sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / (pagination ? pagination.pageSize : pageSize)));
  const page = pagination ? Math.min(pagination.page, pageCount) : Math.min(clientPage, pageCount);
  const rows = useMemo(() => {
    if (pagination) return sorted;
    const size = pageSize;
    return sorted.slice((page - 1) * size, page * size);
  }, [sorted, pagination, page, pageSize]);

  const changePage = (next: number) => {
    if (pagination) pagination.onPageChange(next);
    else setClientPage(next);
    setSelected(new Set());
  };

  const selectableKeys = rows.map((row) => String(rowKey(row)));
  const allSelected = selectable && selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key));
  const someSelected = selectableKeys.some((key) => selected.has(key));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) selectableKeys.forEach((key) => next.delete(key));
    else selectableKeys.forEach((key) => next.add(key));
    setSelected(next);
  };

  const toggleRow = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const selectedRows = data.filter((row) => selected.has(String(rowKey(row))));

  // ---------- Export ----------
  const exportRows = sorted; // export du jeu filtré/trié, pas seulement la page
  const handleExportCsv = () => {
    setExportMenuOpen(false);
    downloadFile(buildCsv(visibleColumns, exportRows), `${exportFileName}.csv`, 'text/csv;charset=utf-8');
  };
  const handleExportExcel = () => {
    setExportMenuOpen(false);
    const aoa = [
      visibleColumns.map((column) => column.header),
      ...exportRows.map((row) => visibleColumns.map((column) => cellValue(column, row))),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Données');
    XLSX.writeFile(book, `${exportFileName}.xlsx`);
  };
  const handlePrint = () => {
    setExportMenuOpen(false);
    window.print();
  };

  // ---------- Rendu des lignes ----------
  const gridTemplate = [
    selectable ? '44px' : '',
    ...visibleColumns.map((column) => column.width ?? 'minmax(120px, 1fr)'),
    rowActions ? 'auto' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderCells = (row: T): ReactNode =>
    visibleColumns.map((column) => (
      <div
        key={column.key}
        role="cell"
        className={`${styles.cell} ${column.align ? styles[column.align] : ''}`}
      >
        {column.render ? column.render(row) : cellValue(column, row)}
      </div>
    ));

  const renderRow = (row: T, index: number, style?: React.CSSProperties) => {
    const key = String(rowKey(row));
    const isSelected = selected.has(key);
    return (
      <div
        key={key}
        role="row"
        aria-selected={selectable ? isSelected : undefined}
        aria-rowindex={index + 2}
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${onRowClick ? styles.rowClickable : ''}`}
        style={{ ...style, gridTemplateColumns: gridTemplate }}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        onKeyDown={
          onRowClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(row);
                }
              }
            : undefined
        }
      >
        {selectable && (
          <div role="cell" className={`${styles.cell} ${styles.cellCheck}`}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRow(key)}
              aria-label={`Sélectionner la ligne ${index + 1}`}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
        {renderCells(row)}
        {rowActions && (
          <div role="cell" className={`${styles.cell} ${styles.cellActions}`}>
            {rowActions(row)}
          </div>
        )}
      </div>
    );
  };

  const virtualized = !pagination && rows.length > VIRTUAL_THRESHOLD;

  const classes = [styles.table, styles[density], className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {/* ---------- Barre d'outils ---------- */}
      <div className={styles.toolbarRow}>
        {searchable && (
          <SearchBar
            label={`Filtrer : ${ariaLabel}`}
            value={quickFilter}
            onChange={setQuickFilter}
            onClear={() => setQuickFilter('')}
            placeholder="Filtrer…"
            size="sm"
          />
        )}
        <div className={styles.toolbarSlot}>{toolbar}</div>
        <div className={styles.toolbarTools}>
          <div ref={columnsRef} className={styles.menuHost}>
            <IconButton
              variant="ghost"
              size="sm"
              label="Afficher ou masquer les colonnes"
              aria-expanded={columnsMenuOpen}
              aria-haspopup="true"
              onClick={() => setColumnsMenuOpen((open) => !open)}
            >
              <GridIcon size={16} />
            </IconButton>
            {columnsMenuOpen && (
              <div className={styles.menu} role="menu" aria-label="Colonnes">
                {columns.map((column) => (
                  <label key={column.key} className={styles.menuItem}>
                    <input
                      type="checkbox"
                      checked={!hiddenKeys.includes(column.key)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? hiddenKeys.filter((key) => key !== column.key)
                          : [...hiddenKeys, column.key];
                        setHiddenPersisted(next);
                      }}
                    />
                    {column.header}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div ref={exportRef} className={styles.menuHost}>
            <IconButton
              variant="ghost"
              size="sm"
              label="Exporter les données"
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
              onClick={() => setExportMenuOpen((open) => !open)}
            >
              <FileTextIcon size={16} />
            </IconButton>
            {exportMenuOpen && (
              <div className={styles.menu} role="menu" aria-label="Export">
                <button role="menuitem" type="button" className={styles.menuAction} onClick={handleExportCsv}>
                  CSV (Excel FR)
                </button>
                <button role="menuitem" type="button" className={styles.menuAction} onClick={handleExportExcel}>
                  Excel (.xlsx)
                </button>
                <button role="menuitem" type="button" className={styles.menuAction} onClick={handlePrint}>
                  Imprimer / PDF
                </button>
              </div>
            )}
          </div>

          <IconButton
            variant="ghost"
            size="sm"
            label={`Densité : ${density}`}
            onClick={() => {
              const order: Density[] = ['compact', 'normal', 'comfortable'];
              setDensity(order[(order.indexOf(density) + 1) % order.length] as Density);
            }}
          >
            <TableIcon size={16} />
          </IconButton>
        </div>
      </div>

      {/* ---------- Actions bulk ---------- */}
      {selectable && selected.size > 0 && (
        <div className={styles.bulkBar} role="toolbar" aria-label="Actions sur la sélection">
          <span className={styles.bulkCount}>{selected.size} sélectionné(s)</span>
          {bulkActions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant={action.danger ? 'danger' : 'secondary'}
              onClick={() => {
                action.onClick(selectedRows);
                setSelected(new Set());
              }}
            >
              {action.label}
            </Button>
          ))}
          <IconButton variant="ghost" size="sm" label="Vider la sélection" onClick={() => setSelected(new Set())}>
            <XIcon size={14} />
          </IconButton>
        </div>
      )}

      {/* ---------- Table ---------- */}
      <div className={styles.scroll} role="table" aria-label={ariaLabel} aria-rowcount={data.length}>
        <div role="rowgroup" className={styles.headerGroup}>
          <div role="row" className={styles.headRow} style={{ gridTemplateColumns: gridTemplate }}>
            {selectable && (
              <div role="columnheader" className={`${styles.headCell} ${styles.cellCheck}`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </div>
            )}
            {visibleColumns.map((column) => {
              const rule = sortRules.find((candidate) => candidate.key === column.key);
              const sortable = column.sortable !== false;
              return (
                <div
                  key={column.key}
                  role="columnheader"
                  aria-sort={rule ? (rule.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`${styles.headCell} ${column.align ? styles[column.align] : ''}`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={(event) =>
                        setSortRules((current) => toggleSort(current, column.key, event.shiftKey))
                      }
                    >
                      {column.header}
                      <span className={`${styles.sortIcon} ${rule ? styles.sortActive : ''}`} aria-hidden="true">
                        <ChevronDownIcon size={14} className={rule?.dir === 'asc' ? styles.sortAsc : undefined} />
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </div>
              );
            })}
            {rowActions && <div role="columnheader" className={styles.headCell} aria-label="Actions" />}
          </div>
        </div>

        <div role="rowgroup" className={styles.bodyGroup}>
          {loading ? (
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} role="row" className={styles.row} style={{ gridTemplateColumns: gridTemplate }}>
                {selectable && (
                  <div role="cell" className={styles.cell}>
                    <Skeleton variant="circular" width={16} height={16} animated={false} />
                  </div>
                )}
                {visibleColumns.map((column) => (
                  <div key={column.key} role="cell" className={styles.cell}>
                    <Skeleton variant="text" width={`${60 + ((index * 13) % 35)}%`} animated={false} />
                  </div>
                ))}
                {rowActions && <div role="cell" className={styles.cell} />}
              </div>
            ))
          ) : rows.length === 0 ? (
            emptyState ?? (
              <EmptyState
                icon={InboxIcon}
                title="Aucun résultat"
                description="Modifiez la recherche ou les filtres pour voir plus de résultats."
              />
            )
          ) : virtualized ? (
            <FixedSizeList
              height={Math.min(LIST_MAX_HEIGHT, rows.length * ROW_HEIGHT[density])}
              width="100%"
              itemCount={rows.length}
              itemSize={ROW_HEIGHT[density]}
              itemData={rows}
              className={styles.virtualList}
            >
              {({ index, style, data: listRows }) => renderRow(listRows[index] as T, index, style)}
            </FixedSizeList>
          ) : (
            rows.map((row, index) => renderRow(row, index))
          )}
        </div>
      </div>

      {/* ---------- Pagination ---------- */}
      {!loading && total > (pagination ? pagination.pageSize : pageSize) && (
        <Pagination page={page} pageCount={pageCount} onChange={changePage} />
      )}
    </div>
  );
}

DataTable.displayName = 'DataTable';
export default DataTable;
