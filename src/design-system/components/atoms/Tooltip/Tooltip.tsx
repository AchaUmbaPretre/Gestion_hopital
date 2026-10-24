/**
 * Tooltip — infobulle accessible, ZÉRO dépendance (ADR-007).
 * Affichage au hover ET au focus (clavier), fermeture Échap,
 * délai 300ms, aria-describedby sur le trigger.
 *
 * Limitation v1 : positionnement CSS simple (le wrapper inline-block
 * entoure le trigger). Migration vers @floating-ui si positions
 * avancées nécessaires — documenté dans MIGRATION_PLAN.md.
 */
import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEventHandler,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';
import styles from './tooltip.module.scss';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/** Props injectées sur le trigger (tous nos atoms les étendent déjà). */
export type TooltipTriggerProps = {
  'aria-describedby'?: string;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
};

export interface TooltipProps {
  /** Contenu de l'infobulle. */
  content: ReactNode;
  /** Élément déclencheur — doit accepter ref/handlers (Button, IconButton…). */
  children: ReactElement<TooltipTriggerProps>;
  position?: TooltipPosition;
  /** Délai d'apparition en ms (défaut 300). */
  delay?: number;
}

const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  // Fermeture Échap (recommandation WCAG 1.4.13).
  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, hide]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const triggerProps: TooltipTriggerProps = {
    'aria-describedby': visible ? id : undefined,
    onMouseEnter: (event) => {
      show();
      children.props.onMouseEnter?.(event);
    },
    onMouseLeave: (event) => {
      hide();
      children.props.onMouseLeave?.(event);
    },
    onFocus: (event) => {
      show();
      children.props.onFocus?.(event);
    },
    onBlur: (event) => {
      hide();
      children.props.onBlur?.(event);
    },
  };

  const contentEmpty = content === null || content === undefined || content === '';

  return (
    <span className={styles.wrapper}>
      {cloneElement(children, triggerProps)}
      {!contentEmpty && visible && (
        <span
          role="tooltip"
          id={id}
          className={styles.tooltip}
          data-position={position}
        >
          {content}
        </span>
      )}
    </span>
  );
};

Tooltip.displayName = 'Tooltip';
export default Tooltip;
export { Tooltip };
