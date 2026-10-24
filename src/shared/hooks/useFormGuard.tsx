/**
 * useFormGuard — confirmation d'abandon de formulaire (étape 4).
 * 1. Navigation interne : useBlocker (react-router data router —
 *    createBrowserRouter est déjà en place depuis l'étape 3).
 * 2. Fermeture d'onglet / reload : beforeunload (standard navigateur).
 * Le composant rend un ConfirmDialog quand la navigation est bloquée :
 *   const blocker = useFormGuard(isDirty);
 *   <FormGuardDialog blocker={blocker} />
 */
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../../design-system/components/molecules/ConfirmDialog/ConfirmDialog';

type Blocker = ReturnType<typeof useBlocker>;

const DEFAULT_MESSAGE = 'Des modifications non enregistrées seront perdues.';

export function useFormGuard(
  active: boolean,
  message: string = DEFAULT_MESSAGE,
): Blocker {
  const blocker = useBlocker(active);

  useEffect(() => {
    if (!active) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active, message]);

  // Purge automatique de l'état bloqué si la garde se désactive.
  useEffect(() => {
    if (!active && blocker.state === 'blocked') blocker.reset();
  }, [active, blocker]);

  return blocker;
}

export function FormGuardDialog({
  blocker,
  title = 'Quitter sans enregistrer ?',
  message = DEFAULT_MESSAGE,
}: {
  blocker: Blocker;
  title?: string;
  message?: string;
}) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      title={title}
      confirmLabel="Quitter sans enregistrer"
      tone="danger"
    >
      {message}
    </ConfirmDialog>
  );
}
