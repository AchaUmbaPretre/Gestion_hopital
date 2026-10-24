/**
 * QueryProvider — @tanstack/react-query (server state, brief 3.2).
 * Defaults "hôpital" :
 *  - staleTime 30 s : évite les requêtes en rafale entre onglets ;
 *  - refetchOnWindowFocus OFF : calme (pas de flicker au retour d'onglet) ;
 *  - retry 1 : l'API peut redémarrer, mais pas 3 x 5 s d'attente ;
 *  - pas de retry sur 4xx (400/401/403 = réponse, pas une panne).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status =
            typeof error === 'object' && error && 'response' in error
              ? (error as { response?: { status?: number } }).response?.status
              : undefined;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: { retry: 0 },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState(paresseux) : client unique par montage d'app (tests inclus).
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
