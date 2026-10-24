// ============================================================
// MOLECULES — Design System Gestion_hopital
// Combinaisons d'atoms sans logique métier. Barrel d'export.
// ============================================================

export { default as FormField } from './FormField/FormField';
export type { FormFieldProps } from './FormField/FormField';

export { default as SearchBar } from './SearchBar/SearchBar';
export type { SearchBarProps, SearchBarSize } from './SearchBar/SearchBar';

export { default as StatCard } from './StatCard/StatCard';
export type {
  StatCardProps,
  StatCardTone,
  StatCardTrend,
} from './StatCard/StatCard';

export { default as EmptyState } from './EmptyState/EmptyState';
export type { EmptyStateProps } from './EmptyState/EmptyState';

export { default as ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog/ConfirmDialog';

export {
  ToastProvider,
  useToast,
} from './Toast/Toast';
export type {
  ToastOptions,
  ToastVariant,
  ToastContextValue,
} from './Toast/Toast';

export { default as Pagination } from './Pagination/Pagination';
export type { PaginationProps } from './Pagination/Pagination';
export { buildPageRange } from './Pagination/Pagination';

export { default as FilterBar } from './FilterBar/FilterBar';
export type { FilterBarProps, ActiveFilter } from './FilterBar/FilterBar';

export { default as Breadcrumb } from './Breadcrumb/Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb/Breadcrumb';
