/**
 * DataTable — types & helpers purs (testables sans React).
 * Virtualisation : react-window au-delà de VIRTUAL_THRESHOLD lignes.
 */
import type { ReactNode } from 'react';

/** Au-delà de ce seuil, le corps est virtualisé (react-window). */
export const VIRTUAL_THRESHOLD = 200;

export type Density = 'compact' | 'normal' | 'comfortable';
export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  key: string;
  dir: SortDirection;
}

export interface DataColumn<T> {
  key: string;
  header: string;
  /** Valeur brute : tri + export + recherche rapide. */
  value?: (row: T) => string | number | null | undefined;
  /** Rendu personnalisé (badges, actions…) ; sinon la valeur brute. */
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Largeur de colonne CSS Grid (ex. '120px', '2fr', 'minmax(160px, 2fr)'). */
  width?: string;
  /** Colonnes sensibles (dates de naissance…) masquées par défaut. */
  hiddenByDefault?: boolean;
}

export interface BulkAction<T> {
  key: string;
  label: string;
  onClick: (selected: T[]) => void;
  danger?: boolean;
  icon?: ReactNode;
}

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Valeur textuelle d'une cellule (tri, export, recherche). */
export function cellValue<T>(column: DataColumn<T>, row: T): string {
  const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  return raw === null || raw === undefined ? '' : String(raw);
}

/** Tri multi-colonnes immuable : règles appliquées dans l'ordre. */
export function sortRows<T>(rows: T[], columns: DataColumn<T>[], rules: SortRule[]): T[] {
  if (rules.length === 0) return rows;
  const keyed = columns.filter((column) => rules.some((rule) => rule.key === column.key));
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      const column = keyed.find((c) => c.key === rule.key);
      if (!column) continue;
      const va = cellValue(column, a);
      const vb = cellValue(column, b);
      const numeric = !Number.isNaN(Number(va)) && !Number.isNaN(Number(vb)) && va !== '' && vb !== '';
      const cmp = numeric
        ? Number(va) - Number(vb)
        : va.localeCompare(vb, 'fr', { sensitivity: 'base', numeric: true });
      if (cmp !== 0) return rule.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/** Cycle d'un tri : clic = asc → desc ; Shift+clic = 2e niveau. */
export function toggleSort(current: SortRule[], key: string, additive: boolean): SortRule[] {
  const existing = current.find((rule) => rule.key === key);
  const nextRule = (): SortRule => {
    if (!existing) return { key, dir: 'asc' };
    if (existing.dir === 'asc') return { key, dir: 'desc' };
    return { key, dir: 'asc' };
  };
  if (!additive) return [nextRule()];
  const without = current.filter((rule) => rule.key !== key);
  // Si la clé existe déjà, on la réinsère à sa place (cycle) ;
  // sinon elle devient le dernier critère.
  return existing ? [...without, nextRule()] : [...without.slice(0, 1), nextRule()];
}

/** Recherche rapide insensible à la casse sur les colonnes visibles. */
export function matchesQuickFilter<T>(
  row: T,
  columns: DataColumn<T>[],
  filter: string,
): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return columns.some((column) => cellValue(column, row).toLowerCase().includes(needle));
}

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/** CSV BOM UTF-8, séparateur `;` (Excel FR), échappement RFC 4180. */
export function buildCsv<T>(columns: DataColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => escapeCsv(column.header)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCsv(cellValue(column, row))).join(';'));
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export function downloadFile(content: string | Blob, fileName: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
