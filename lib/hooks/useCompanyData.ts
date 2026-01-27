import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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

// Fetch clients with caching
export function useClients(companyId: string | undefined) {
  return useQuery({
    queryKey: ['clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', companyId)
      );
      const clientsSnap = await getDocs(clientsQuery);
      
      const clients: Client[] = clientsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Client));
      
      return clients.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
  });
}

// Fetch projects with caching
export function useProjects(companyId: string | undefined, clientId: string | null = null) {
  return useQuery({
    queryKey: ['projects', companyId, clientId],
    queryFn: async () => {
      if (!companyId) return [];
      
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
      
      // Fetch clients for mapping
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
    },
    enabled: !!companyId,
    staleTime: 60 * 1000, // Fresh for 1 minute
  });
}

// Fetch subcontractors with caching
export function useSubcontractors(companyId: string | undefined, clientId: string | null = null) {
  return useQuery({
    queryKey: ['subcontractors', companyId, clientId],
    queryFn: async () => {
      if (!companyId) return [];
      
      if (clientId) {
        // Workspace-scoped: Only fetch subcontractors for this client's projects
        const projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', companyId),
          where('clientId', '==', clientId)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const projectIds = projectsSnap.docs.map(doc => doc.id);
        
        if (projectIds.length === 0) return [];
        
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
        
        if (subcontractorIds.size === 0) return [];
        
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
    },
    enabled: !!companyId,
    staleTime: 60 * 1000, // Fresh for 1 minute
  });
}

// Fetch rate cards with caching
export function useRateCards(companyId: string | undefined) {
  return useQuery({
    queryKey: ['rateCards', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const rateCardsQuery = query(
        collection(db, 'rateCards'),
        where('companyId', '==', companyId)
      );
      const rateCardsSnap = await getDocs(rateCardsQuery);
      
      return rateCardsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as RateCard));
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
  });
}

// Combined stats hook - fetches lazily
export function useStats(companyId: string | undefined, clientId: string | null = null) {
  return useQuery({
    queryKey: ['stats', companyId, clientId],
    queryFn: async () => {
      if (!companyId) {
        return { projects: 0, clients: 0, subcontractors: 0, rateCards: 0 };
      }
      
      // Fetch projects - filter by client if specified
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
      
      // For client workspace: filter subcontractors by project assignments
      let subcontractorsCount = 0;
      if (clientId) {
        const projectIds = projectsSnap.docs.map(doc => doc.id);
        
        if (projectIds.length > 0) {
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
          
          subcontractorsCount = subcontractorIds.size;
        }
      } else {
        const subsSnap = await getDocs(
          query(collection(db, 'subcontractors'), where('companyId', '==', companyId))
        );
        subcontractorsCount = subsSnap.size;
      }
      
      // Clients and rate cards are always company-wide
      const [clientsSnap, ratesSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'rateCards'), where('companyId', '==', companyId)))
      ]);
      
      return {
        projects: projectsSnap.size,
        clients: clientId ? 1 : clientsSnap.size, // If viewing a client workspace, show 1
        subcontractors: subcontractorsCount,
        rateCards: ratesSnap.size,
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes (stats change less frequently)
  });
}
