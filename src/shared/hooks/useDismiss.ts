/**
 * useDismiss — fermeture "calme" des surfaces flottantes (menus,
 * palette ⌘K, drawer) : clic extérieur + Échap.
 * Le clic extérieur est écouté en phase `pointerdown` pour devancer
 * les handlers de focus ; Échap ne se propage pas (pas de double close).
 */
import { useEffect, type RefObject } from 'react';

interface DismissOptions {
  enabled?: boolean;
  /** Référence de la surface ; les clics à l'intérieur sont ignorés. */
  ref: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  /** Désactive la fermeture par Échap (ex. dialogs avec confirmation). */
  escapeDisabled?: boolean;
}

export function useDismiss({ enabled = true, ref, onDismiss, escapeDisabled = false }: DismissOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        onDismiss();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (escapeDisabled) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ref, onDismiss, escapeDisabled]);
}
