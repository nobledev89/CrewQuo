import { useState, useEffect } from 'react';
import { auth, db, functions } from './firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CompanyContext } from './types';

export function useCompanyContext() {
  const [contexts, setContexts] = useState<CompanyContext[]>([]);
  const [activeContext, setActiveContext] = useState<CompanyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadContexts();
  }, []);

  const loadContexts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const availableContexts: CompanyContext[] = [];

      // Add own company
      const ownCompanyDoc = await getDoc(doc(db, 'companies', userData.ownCompanyId));
      if (ownCompanyDoc.exists()) {
        availableContexts.push({
          companyId: userData.ownCompanyId,
          companyName: ownCompanyDoc.data().name,
          role: userData.role,
          isOwnCompany: true,
        });
      }

      // Add subcontractor companies
      if (userData.subcontractorRoles) {
        for (const [companyId, roleInfo] of Object.entries(userData.subcontractorRoles)) {
          if ((roleInfo as any).status === 'active') {
            const companyDoc = await getDoc(doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
              availableContexts.push({
                companyId,
                companyName: companyDoc.data().name,
                role: 'SUBCONTRACTOR', // When working for another company, always subcontractor
                isOwnCompany: false,
              });
            }
          }
        }
      }

      setContexts(availableContexts);

      // Set active context
      const active = availableContexts.find(c => c.companyId === userData.activeCompanyId);
      setActiveContext(active || availableContexts[0] || null);

    } catch (error) {
      console.error('Error loading contexts:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchContext = async (targetCompanyId: string) => {
    setSwitching(true);
    try {
      // Call Cloud Function to switch context
      const switchCompanyContextFn = httpsCallable(functions, 'switchCompanyContext');
      await switchCompanyContextFn({ targetCompanyId });

      // Force token refresh
      await auth.currentUser?.getIdToken(true);

      // Reload the page to update UI with new context
      window.location.reload();
    } catch (error) {
      console.error('Error switching context:', error);
      alert('Failed to switch company context. Please try again.');
      setSwitching(false);
    }
  };

  return {
    contexts,
    activeContext,
    loading,
    switching,
    switchContext,
    hasMultipleContexts: contexts.length > 1,
  };
}
