'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Types for cached data
interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  startDate: any;
  endDate: any;
  notes: string;
  clientId: string;
  clientName?: string;
  companyId: string;
}

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  notes: string;
  userId?: string;
  inviteStatus: 'pending' | 'accepted' | 'none';
  inviteToken?: string;
  companyId: string;
  createdAt: any;
}

interface RateCard {
  id: string;
  name: string;
  description: string;
  active: boolean;
  templateId?: string | null;
  templateName?: string | null;
  rates: any[];
  expenses?: any[];
  companyId: string;
  createdAt: any;
  updatedAt?: any;
  createdBy?: string;
}

interface Client {
  id: string;
  name: string;
  active: boolean;
}

interface Stats {
  projects: number;
  clients: number;
  subcontractors: number;
  rateCards: number;
}

interface CachedData {
  projects: Project[];
  subcontractors: Subcontractor[];
  rateCards: RateCard[];
  clients: Client[];
  stats: Stats;
  timestamp: number;
}

interface ClientDataContextType {
  cachedData: CachedData | null;
  isLoading: boolean;
  prefetchClientData: (companyId: string, clientId: string | null) => Promise<void>;
  invalidateCache: () => void;
  updateProjects: (projects: Project[]) => void;
  updateSubcontractors: (subcontractors: Subcontractor[]) => void;
  updateRateCards: (rateCards: RateCard[]) => void;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const prefetchClientData = async (companyId: string, clientId: string | null) => {
    console.log('[ClientDataContext] Prefetching data for:', clientId ? `client ${clientId}` : 'all clients');
    setIsLoading(true);

    try {
      // Fetch all data in parallel
      const [projectsData, subcontractorsData, rateCardsData, clientsData, statsData] = await Promise.all([
        fetchProjects(companyId, clientId),
        fetchSubcontractors(companyId, clientId),
        fetchRateCards(companyId),
        fetchClients(companyId),
        fetchStats(companyId)
      ]);

      const newCachedData: CachedData = {
        projects: projectsData,
        subcontractors: subcontractorsData,
        rateCards: rateCardsData,
        clients: clientsData,
        stats: statsData,
        timestamp: Date.now()
      };

      setCachedData(newCachedData);
      console.log('[ClientDataContext] Prefetch complete:', {
        projects: projectsData.length,
        subcontractors: subcontractorsData.length,
        rateCards: rateCardsData.length,
        clients: clientsData.length
      });
    } catch (error) {
      console.error('[ClientDataContext] Error prefetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async (companyId: string, clientId: string | null): Promise<Project[]> => {
    try {
      let projectsQuery;
      if (clientId) {
        projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', companyId),
          where('clientId', '==', clientId)
        );
      } else {
        projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', companyId)
        );
      }
      
      const projectsSnap = await getDocs(projectsQuery);
      
      // Also fetch clients map for project client names
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', companyId)
      );
      const clientsSnap = await getDocs(clientsQuery);
      const clientsMap = new Map<string, string>();
      clientsSnap.forEach(doc => {
        clientsMap.set(doc.id, doc.data().name);
      });
      
      return projectsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clientName: clientsMap.get(doc.data().clientId) || 'Unknown Client',
      } as Project));
    } catch (error) {
      console.error('[ClientDataContext] Error fetching projects:', error);
      return [];
    }
  };

  const fetchSubcontractors = async (companyId: string, clientId: string | null): Promise<Subcontractor[]> => {
    try {
      if (clientId) {
        // Workspace-scoped: Only fetch subcontractors for this client's projects
        const projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', companyId),
          where('clientId', '==', clientId)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const projectIds = projectsSnap.docs.map(doc => doc.id);
        
        if (projectIds.length === 0) {
          return [];
        }
        
        // Get all project assignments for these projects
        const assignmentsQuery = query(
          collection(db, 'projectAssignments'),
          where('companyId', '==', companyId)
        );
        const assignmentsSnap = await getDocs(assignmentsQuery);
        
        const subcontractorIds = new Set<string>();
        assignmentsSnap.docs.forEach(doc => {
          const assignment = doc.data();
          if (projectIds.includes(assignment.projectId)) {
            subcontractorIds.add(assignment.subcontractorId);
          }
        });
        
        if (subcontractorIds.size === 0) {
          return [];
        }
        
        // Fetch only the relevant subcontractors
        const subcontractorsQuery = query(
          collection(db, 'subcontractors'),
          where('companyId', '==', companyId)
        );
        const subcontractorsSnap = await getDocs(subcontractorsQuery);
        
        return subcontractorsSnap.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Subcontractor))
          .filter(sub => subcontractorIds.has(sub.id));
      } else {
        // All clients view
        const subcontractorsQuery = query(
          collection(db, 'subcontractors'),
          where('companyId', '==', companyId)
        );
        const subcontractorsSnap = await getDocs(subcontractorsQuery);
        
        return subcontractorsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Subcontractor));
      }
    } catch (error) {
      console.error('[ClientDataContext] Error fetching subcontractors:', error);
      return [];
    }
  };

  const fetchRateCards = async (companyId: string): Promise<RateCard[]> => {
    try {
      const rateCardsQuery = query(
        collection(db, 'rateCards'),
        where('companyId', '==', companyId)
      );
      const rateCardsSnap = await getDocs(rateCardsQuery);
      
      return rateCardsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as RateCard));
    } catch (error) {
      console.error('[ClientDataContext] Error fetching rate cards:', error);
      return [];
    }
  };

  const fetchClients = async (companyId: string): Promise<Client[]> => {
    try {
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', companyId)
      );
      const clientsSnap = await getDocs(clientsQuery);
      
      return clientsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Client));
    } catch (error) {
      console.error('[ClientDataContext] Error fetching clients:', error);
      return [];
    }
  };

  const fetchStats = async (companyId: string): Promise<Stats> => {
    try {
      const [projectsSnap, clientsSnap, subsSnap, ratesSnap] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'clients'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'subcontractors'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'rateCards'), where('companyId', '==', companyId)))
      ]);
      
      return {
        projects: projectsSnap.size,
        clients: clientsSnap.size,
        subcontractors: subsSnap.size,
        rateCards: ratesSnap.size,
      };
    } catch (error) {
      console.error('[ClientDataContext] Error fetching stats:', error);
      return { projects: 0, clients: 0, subcontractors: 0, rateCards: 0 };
    }
  };

  const invalidateCache = () => {
    console.log('[ClientDataContext] Cache invalidated');
    setCachedData(null);
  };

  const updateProjects = (projects: Project[]) => {
    if (cachedData) {
      setCachedData({ ...cachedData, projects, timestamp: Date.now() });
    }
  };

  const updateSubcontractors = (subcontractors: Subcontractor[]) => {
    if (cachedData) {
      setCachedData({ ...cachedData, subcontractors, timestamp: Date.now() });
    }
  };

  const updateRateCards = (rateCards: RateCard[]) => {
    if (cachedData) {
      setCachedData({ ...cachedData, rateCards, timestamp: Date.now() });
    }
  };

  return (
    <ClientDataContext.Provider
      value={{
        cachedData,
        isLoading,
        prefetchClientData,
        invalidateCache,
        updateProjects,
        updateSubcontractors,
        updateRateCards,
      }}
    >
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData() {
  const context = useContext(ClientDataContext);
  if (context === undefined) {
    throw new Error('useClientData must be used within a ClientDataProvider');
  }
  return context;
}
