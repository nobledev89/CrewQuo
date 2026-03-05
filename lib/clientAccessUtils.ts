/**
 * Utility functions for client access management
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ClientOrganization,
  ClientUser,
  ContractorClientRelationship,
  ClientProjectAccess,
  ClientUserInvite,
} from './types';

/**
 * Get or create a client organization
 */
export async function getOrCreateClientOrganization(
  clientName: string,
  clientId: string,
  companyId: string,
  userId: string,
  domain?: string
): Promise<ClientOrganization> {
  // First check if an organization with this name already exists
  const orgsQuery = query(
    collection(db, 'clientOrganizations'),
    where('name', '==', clientName)
  );
  const orgsSnap = await getDocs(orgsQuery);
  
  if (!orgsSnap.empty) {
    // Return existing organization
    const orgDoc = orgsSnap.docs[0];
    return { id: orgDoc.id, ...orgDoc.data() } as ClientOrganization;
  }
  
  // Create new organization
  const newOrgRef = await addDoc(collection(db, 'clientOrganizations'), {
    name: clientName,
    domain,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  });
  
  const newOrgDoc = await getDoc(newOrgRef);
  return { id: newOrgDoc.id, ...newOrgDoc.data() } as ClientOrganization;
}

/**
 * Link a client record to a client organization
 */
export async function linkClientToOrganization(
  clientId: string,
  clientOrgId: string,
  clientOrgName: string
): Promise<void> {
  await updateDoc(doc(db, 'clients', clientId), {
    clientOrgId,
    clientOrgName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Create or update contractor-client relationship
 */
export async function createContractorClientRelationship(
  contractorCompanyId: string,
  contractorCompanyName: string,
  clientOrgId: string,
  clientOrgName: string,
  contractorClientId: string,
  createdBy: string,
  settings?: {
    defaultShowCosts?: boolean;
    defaultShowMargins?: boolean;
    defaultShowSubcontractorRates?: boolean;
    allowClientNotes?: boolean;
    showDraftStatus?: boolean;
    showRejectedStatus?: boolean;
  }
): Promise<string> {
  const relationshipId = `${contractorCompanyId}_${clientOrgId}`;
  const relationshipRef = doc(db, 'contractorClientRelationships', relationshipId);
  
  const relationshipData = {
    contractorCompanyId,
    contractorCompanyName,
    clientOrgId,
    clientOrgName,
    contractorClientId,
    defaultShowCosts: settings?.defaultShowCosts ?? false,
    defaultShowMargins: settings?.defaultShowMargins ?? false,
    defaultShowSubcontractorRates: settings?.defaultShowSubcontractorRates ?? false,
    allowClientNotes: settings?.allowClientNotes ?? true,
    showDraftStatus: settings?.showDraftStatus ?? true,
    showRejectedStatus: settings?.showRejectedStatus ?? true,
    active: true,
    createdAt: serverTimestamp(),
    createdBy,
    updatedAt: serverTimestamp(),
  };
  
  // Check if exists
  const existingDoc = await getDoc(relationshipRef);
  if (existingDoc.exists()) {
    // Update existing
    await updateDoc(relationshipRef, {
      ...relationshipData,
      createdAt: existingDoc.data().createdAt, // Preserve original
    });
  } else {
    // Create new
    await setDoc(relationshipRef, relationshipData);
  }
  
  return relationshipId;
}

/**
 * Get contractor-client relationship with settings
 */
export async function getContractorClientRelationship(
  contractorCompanyId: string,
  clientOrgId: string
): Promise<ContractorClientRelationship | null> {
  const relationshipId = `${contractorCompanyId}_${clientOrgId}`;
  const relationshipDoc = await getDoc(doc(db, 'contractorClientRelationships', relationshipId));
  
  if (!relationshipDoc.exists()) {
    return null;
  }
  
  return { id: relationshipDoc.id, ...relationshipDoc.data() } as ContractorClientRelationship;
}

/**
 * Grant project access to a client organization
 */
export async function grantProjectAccess(
  contractorCompanyId: string,
  clientOrgId: string,
  projectId: string,
  projectName: string,
  grantedBy: string,
  overrides?: {
    overrideShowCosts?: boolean;
    overrideShowMargins?: boolean;
    overrideShowSubcontractorRates?: boolean;
  }
): Promise<string> {
  const accessId = `${clientOrgId}_${projectId}`;
  const accessRef = doc(db, 'clientProjectAccess', accessId);
  
  const accessData = {
    contractorCompanyId,
    clientOrgId,
    projectId,
    projectName,
    grantedBy,
    grantedAt: serverTimestamp(),
    ...overrides,
    active: true,
  };
  
  await setDoc(accessRef, accessData, { merge: true });
  return accessId;
}

/**
 * Revoke project access
 */
export async function revokeProjectAccess(
  clientOrgId: string,
  projectId: string
): Promise<void> {
  const accessId = `${clientOrgId}_${projectId}`;
  await updateDoc(doc(db, 'clientProjectAccess', accessId), {
    active: false,
  });
}

/**
 * Check if a client org has access to a project
 */
export async function hasProjectAccess(
  clientOrgId: string,
  projectId: string
): Promise<boolean> {
  const accessId = `${clientOrgId}_${projectId}`;
  const accessDoc = await getDoc(doc(db, 'clientProjectAccess', accessId));
  
  return accessDoc.exists() && accessDoc.data()?.active === true;
}

/**
 * Get all projects a client org has access to for a specific contractor
 */
export async function getClientAccessibleProjects(
  contractorCompanyId: string,
  clientOrgId: string
): Promise<ClientProjectAccess[]> {
  const accessQuery = query(
    collection(db, 'clientProjectAccess'),
    where('contractorCompanyId', '==', contractorCompanyId),
    where('clientOrgId', '==', clientOrgId),
    where('active', '==', true)
  );
  
  const accessSnap = await getDocs(accessQuery);
  return accessSnap.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as ClientProjectAccess));
}

/**
 * Get visibility settings for a project (with fallback to relationship defaults)
 */
export async function getProjectVisibilitySettings(
  contractorCompanyId: string,
  clientOrgId: string,
  projectId: string
): Promise<{
  showCosts: boolean;
  showMargins: boolean;
  showSubcontractorRates: boolean;
  allowClientNotes: boolean;
  showDraftStatus: boolean;
  showRejectedStatus: boolean;
}> {
  // Get project access (may have overrides)
  const accessId = `${clientOrgId}_${projectId}`;
  const accessDoc = await getDoc(doc(db, 'clientProjectAccess', accessId));
  
  // Get relationship defaults
  const relationship = await getContractorClientRelationship(contractorCompanyId, clientOrgId);
  
  if (!relationship) {
    // Return safe defaults
    return {
      showCosts: false,
      showMargins: false,
      showSubcontractorRates: false,
      allowClientNotes: true,
      showDraftStatus: true,
      showRejectedStatus: true,
    };
  }
  
  const accessData = accessDoc.data();
  
  return {
    showCosts: accessData?.overrideShowCosts ?? relationship.defaultShowCosts,
    showMargins: accessData?.overrideShowMargins ?? relationship.defaultShowMargins,
    showSubcontractorRates: accessData?.overrideShowSubcontractorRates ?? relationship.defaultShowSubcontractorRates,
    allowClientNotes: relationship.allowClientNotes,
    showDraftStatus: relationship.showDraftStatus,
    showRejectedStatus: relationship.showRejectedStatus,
  };
}

/**
 * Get all contractors a client user has access to
 */
export async function getClientUserContractors(
  userId: string
): Promise<Array<{ id: string; name: string; projectCount: number }>> {
  // Get client user record
  const clientUserQuery = query(
    collection(db, 'clientUsers'),
    where('userId', '==', userId)
  );
  const clientUserSnap = await getDocs(clientUserQuery);
  
  if (clientUserSnap.empty) {
    return [];
  }
  
  const clientUser = clientUserSnap.docs[0].data() as ClientUser;
  const contractorIds = clientUser.contractorCompanyIds || [];
  
  // Fetch contractor details and count projects
  const contractors = await Promise.all(
    contractorIds.map(async (contractorId) => {
      const companyDoc = await getDoc(doc(db, 'companies', contractorId));
      const companyData = companyDoc.data();
      
      // Count accessible projects
      const accessQuery = query(
        collection(db, 'clientProjectAccess'),
        where('contractorCompanyId', '==', contractorId),
        where('clientOrgId', '==', clientUser.clientOrgId),
        where('active', '==', true)
      );
      const accessSnap = await getDocs(accessQuery);
      
      return {
        id: contractorId,
        name: companyData?.name || 'Unknown Contractor',
        projectCount: accessSnap.size,
      };
    })
  );
  
  return contractors;
}

/**
 * Generate a unique invite token
 */
export function generateInviteToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a client user invite
 */
export async function createClientUserInvite(
  email: string,
  contractorCompanyId: string,
  contractorCompanyName: string,
  clientOrgId: string,
  clientOrgName: string,
  invitedBy: string
): Promise<string> {
  const inviteToken = generateInviteToken();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days
  
  const inviteRef = await addDoc(collection(db, 'clientUserInvites'), {
    email,
    contractorCompanyId,
    contractorCompanyName,
    clientOrgId,
    clientOrgName,
    invitedBy,
    inviteToken,
    status: 'pending',
    sentAt: serverTimestamp(),
    expiresAt,
  });
  
  return inviteToken;
}

/**
 * Get invite by token
 */
export async function getInviteByToken(token: string): Promise<ClientUserInvite | null> {
  const invitesQuery = query(
    collection(db, 'clientUserInvites'),
    where('inviteToken', '==', token),
    where('status', '==', 'pending')
  );
  
  const invitesSnap = await getDocs(invitesQuery);
  
  if (invitesSnap.empty) {
    return null;
  }
  
  const inviteDoc = invitesSnap.docs[0];
  const invite = { id: inviteDoc.id, ...inviteDoc.data() } as ClientUserInvite;
  
  // Check if expired
  if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
    await updateDoc(doc(db, 'clientUserInvites', invite.id), {
      status: 'expired',
    });
    return null;
  }
  
  return invite;
}

/**
 * Accept a client user invite
 */
export async function acceptClientUserInvite(
  inviteId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'clientUserInvites', inviteId), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  });
}

/**
 * Cancel a client user invite
 */
export async function cancelClientUserInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'clientUserInvites', inviteId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  });
}

/**
 * Delete a client user invite
 */
export async function deleteClientUserInvite(inviteId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'clientUserInvites', inviteId));
}
