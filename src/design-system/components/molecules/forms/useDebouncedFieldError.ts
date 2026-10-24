/**
 * useDebouncedFieldError — reporte l'affichage d'une erreur de
 * validation de 300ms (brief étape 4) : l'utilisateur n'est pas
 * sanctionné pendant la frappe, l'erreur apparaît dès la pause.
 */
import { useEffect, useState } from 'react';

export function useDebouncedFieldError(error: string | undefined, delay = 300): string | undefined {
  const [debounced, setDebounced] = useState(error);

  useEffect(() => {
    // L'erreur disparaît immédiatement (dès correction), elle
    // n'apparaît qu'après la pause de frappe.
    if (!error) {
      setDebounced(undefined);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(error), delay);
    return () => window.clearTimeout(timer);
  }, [error, delay]);

  return debounced;
}
