'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useClientContext, ClientContext } from './useClientContext';
import { Client } from './types';

interface ClientFilterContextType {
  clients: Client[];
  selectedClient: ClientContext;
  selectClient: (clientId: string | null, clientName: string) => void;
  clearClientSelection: () => void;
  hasClients: boolean;
  loading: boolean;
}

const ClientFilterContext = createContext<ClientFilterContextType | undefined>(undefined);

export function ClientFilterProvider({ children }: { children: ReactNode }) {
  const clientContext = useClientContext();

  return (
    <ClientFilterContext.Provider value={clientContext}>
      {children}
    </ClientFilterContext.Provider>
  );
}

export function useClientFilter() {
  const context = useContext(ClientFilterContext);
  if (context === undefined) {
    throw new Error('useClientFilter must be used within a ClientFilterProvider');
  }
  return context;
}
