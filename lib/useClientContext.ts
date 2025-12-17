import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Client } from './types';

export interface ClientContext {
  clientId: string | null; // null means "My Company" (all clients)
  clientName: string;
  isAllClients: boolean; // Helper to check if viewing all clients
}

export function useClientContext() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientContext>({
    clientId: null,
    clientName: 'My Company',
    isAllClients: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[ClientContext] Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('[ClientContext] User authenticated:', user.uid);
        await loadClients(user.uid);
      } else {
        console.log('[ClientContext] No user authenticated');
        setClients([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadClients = async (userId: string) => {
    try {
      setLoading(true);
      
      // Get user document to get the actual companyId
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        console.log('[ClientContext] User document not found');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const companyId = userData.companyId || userData.ownCompanyId;

      console.log('[ClientContext] User ID:', userId);
      console.log('[ClientContext] User data companyId:', companyId);

      if (!companyId) {
        console.log('[ClientContext] No companyId found in user document');
        setLoading(false);
        return;
      }

      // Fetch ALL clients for this company
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', companyId)
      );

      console.log('[ClientContext] Querying ALL clients with companyId:', companyId);
      const clientsSnapshot = await getDocs(clientsQuery);
      console.log('[ClientContext] Found', clientsSnapshot.size, 'total clients');
      
      const clientsList: Client[] = [];
      
      clientsSnapshot.forEach((docSnapshot) => {
        const clientData = { id: docSnapshot.id, ...docSnapshot.data() } as Client;
        console.log('[ClientContext] Client:', clientData);
        clientsList.push(clientData);
      });

      // Sort alphabetically
      clientsList.sort((a, b) => a.name.localeCompare(b.name));

      console.log('[ClientContext] Final clients list:', clientsList);
      setClients(clientsList);
      
      // Try to restore workspace from localStorage
      try {
        const saved = localStorage.getItem('selectedWorkspace');
        if (saved) {
          const workspace = JSON.parse(saved);
          // Verify the client still exists
          if (clientsList.some(c => c.id === workspace.clientId)) {
            console.log('[ClientContext] Restoring workspace from localStorage:', workspace);
            setSelectedClient({
              clientId: workspace.clientId,
              clientName: workspace.clientName,
              isAllClients: false
            });
          } else {
            console.log('[ClientContext] Saved workspace client no longer exists, clearing');
            localStorage.removeItem('selectedWorkspace');
          }
        }
      } catch (e) {
        console.error('[ClientContext] Error restoring workspace:', e);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('[ClientContext] Error loading clients:', error);
      setLoading(false);
    }
  };

  const selectClient = (clientId: string | null, clientName: string) => {
    console.log('[ClientContext] Switching workspace to:', clientName, clientId);
    setSelectedClient({ 
      clientId, 
      clientName,
      isAllClients: clientId === null 
    });
    
    // Store in localStorage for persistence across page reloads
    if (clientId) {
      localStorage.setItem('selectedWorkspace', JSON.stringify({ clientId, clientName }));
    } else {
      localStorage.removeItem('selectedWorkspace');
    }
  };

  const clearClientSelection = () => {
    console.log('[ClientContext] Clearing workspace selection');
    setSelectedClient({ 
      clientId: null, 
      clientName: 'My Company',
      isAllClients: true 
    });
    localStorage.removeItem('selectedWorkspace');
  };

  return {
    clients,
    selectedClient,
    loading,
    selectClient,
    clearClientSelection,
    hasClients: clients.length > 0,
  };
}
