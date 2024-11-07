import { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PeerConnectionManager } from '../../core/connection-manager';
import type { PeerConnectOptions } from '../../core/types';

interface PeerSyncContextValue {
  queryClient: QueryClient;
  manager: PeerConnectionManager & { options: PeerConnectOptions };
}

const PeerSyncContext = createContext<PeerSyncContextValue | null>(null);

export function PeerSyncProvider({
  children,
  options,
}: {
  children: ReactNode;
  options: PeerConnectOptions;
}) {
  const queryClient = new QueryClient();
  const manager = new PeerConnectionManager(options);

  return (
    <QueryClientProvider client={queryClient}>
      <PeerSyncContext.Provider
        value={{ queryClient, manager: Object.assign(manager, { options }) }}
      >
        {children}
      </PeerSyncContext.Provider>
    </QueryClientProvider>
  );
}

export function usePeerSyncContext() {
  const context = useContext(PeerSyncContext);
  if (!context) {
    throw new Error(
      'usePeerSyncContext must be used within a PeerSyncProvider'
    );
  }
  return context;
}
