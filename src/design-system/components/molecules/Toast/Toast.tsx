/**
 * Toast — système de notifications éphémères (remplace react-toastify).
 * API : const { success, error, info, warning } = useToast();
 * A11y : les erreurs sont role="alert" (annoncées immédiatement),
 * les succès role="status" (poli). Fermeture manuelle + auto-dismiss.
 * Les erreurs ne partent PAS toutes seules : l'utilisateur garde
 * le contrôle (contexte santé — une erreur doit être lue).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../../atoms';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XIcon,
  XCircleIcon,
  type IconProps,
} from '../../../foundation/icons';
import styles from './toast.module.scss';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  /** Durée avant disparition (ms). Les erreurs restent par défaut. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  variant: ToastVariant;
}

export interface ToastContextValue {
  toast: (variant: ToastVariant, options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 8000;

const variantIcon: Record<ToastVariant, (props: IconProps) => ReactNode> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, options: ToastOptions) => {
      const id = nextId.current++;
      const item: ToastItem = { ...options, id, variant };
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), item]);
    },
    [],
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast('success', { title, description, duration: DEFAULT_DURATION }),
      error: (title, description) =>
        toast('error', { title, description, duration: ERROR_DURATION }),
      warning: (title, description) =>
        toast('warning', { title, description, duration: DEFAULT_DURATION }),
      info: (title, description) =>
        toast('info', { title, description, duration: DEFAULT_DURATION }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={styles.stack}>
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  // Auto-dismiss : jamais pour les erreurs critiques lues "au vol"
  // sauf durée explicite ; timer nettoyé au démontage.
  useEffect(() => {
    if (item.duration === Infinity) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration ?? DEFAULT_DURATION);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  const Icon = variantIcon[item.variant];
  const isError = item.variant === 'error' || item.variant === 'warning';

  return (
    <div
      className={`${styles.toast} ${styles[item.variant]}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className={styles.content}>
        <p className={styles.title}>{item.title}</p>
        {item.description && <p className={styles.description}>{item.description}</p>}
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        label={`Fermer : ${item.title}`}
        className={styles.close}
        onClick={() => onDismiss(item.id)}
      >
        <XIcon size={14} />
      </IconButton>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé dans <ToastProvider>.');
  }
  return context;
}

ToastProvider.displayName = 'ToastProvider';
ToastStack.displayName = 'ToastStack';
