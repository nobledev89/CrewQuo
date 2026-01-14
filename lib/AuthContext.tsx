'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface UserData {
  email: string;
  name: string;
  role: string;
  companyId: string;
  ownCompanyId?: string;
  activeCompanyId?: string;
  subcontractorRoles?: {
    [companyId: string]: {
      subcontractorId: string;
      status: string;
    };
  };
}

interface CompanyData {
  name: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt?: any;
  currency?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  companyData: CompanyData | null;
  loading: boolean;
  isActingAsSubcontractor: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Setting up unified auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[AuthContext] Auth state changed:', currentUser?.uid);
      
      if (currentUser) {
        setUser(currentUser);
        
        try {
          // Fetch user and company data in parallel
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const fetchedUserData = userDoc.data() as UserData;
            setUserData(fetchedUserData);
            
            // Fetch company data
            const companyId = fetchedUserData.companyId;
            if (companyId) {
              const companyDocRef = doc(db, 'companies', companyId);
              const companyDoc = await getDoc(companyDocRef);
              
              if (companyDoc.exists()) {
                setCompanyData(companyDoc.data() as CompanyData);
              }
            }
          }
        } catch (error) {
          console.error('[AuthContext] Error fetching user/company data:', error);
        }
        
        setLoading(false);
      } else {
        setUser(null);
        setUserData(null);
        setCompanyData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isActingAsSubcontractor = (): boolean => {
    if (!userData) return false;
    
    // Primary role is SUBCONTRACTOR
    if (userData.role === 'SUBCONTRACTOR') return true;
    
    // User is viewing a company where they're a subcontractor
    const activeCompanyId = userData.activeCompanyId || userData.companyId;
    const ownCompanyId = userData.ownCompanyId || userData.companyId;
    
    // If viewing a different company and they have a subcontractor role there
    if (activeCompanyId !== ownCompanyId) {
      return !!(userData.subcontractorRoles && activeCompanyId in userData.subcontractorRoles);
    }
    
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        companyData,
        loading,
        isActingAsSubcontractor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
