'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useClientContext, ClientContext, setPrefetchFunction } from './useClientContext';
import { Client } from './types';
import { ClientDataProvider, useClientData } from './ClientDataContext';

interface ClientFilterContextType {
  clients: Client[];
  selectedClient: ClientContext;
  selectClient: (clientId: string | null, clientName: string) => void;
  clearClientSelection: () => void;
  hasClients: boolean;
  loading: boolean;
}

const ClientFilterContext = createContext<ClientFilterContextType | undefined>(undefined);

function ClientFilterProviderInner({ children }: { children: ReactNode }) {
  const clientContext = useClientContext();
  const { prefetchClientData } = useClientData();

  // Connect the prefetch function to useClientContext
  useEffect(() => {
    setPrefetchFunction(prefetchClientData);
  }, [prefetchClientData]);

  return (
    <ClientFilterContext.Provider value={clientContext}>
      {children}
    </ClientFilterContext.Provider>
  );
}

export function ClientFilterProvider({ children }: { children: ReactNode }) {
  return (
    <ClientDataProvider>
      <ClientFilterProviderInner>
        {children}
      </ClientFilterProviderInner>
    </ClientDataProvider>
  );
}

export function useClientFilter() {
  const context = useContext(ClientFilterContext);
  if (context === undefined) {
    throw new Error('useClientFilter must be used within a ClientFilterProvider');
  }
  return context;
}
