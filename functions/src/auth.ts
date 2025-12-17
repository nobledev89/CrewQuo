import * as admin from 'firebase-admin';

export interface SubcontractorRoleInfo {
  subcontractorId: string;
  status: string;
}

export interface UserClaims {
  companyId: string; // Legacy field
  ownCompanyId: string;
  activeCompanyId: string;
  role: 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';
  subcontractorRoles?: {
    [companyId: string]: SubcontractorRoleInfo;
  };
}

/**
 * Set custom claims for a user based on their user document
 */
export async function setCustomUserClaims(
  uid: string,
  claims: UserClaims
): Promise<void> {
  await admin.auth().setCustomUserClaims(uid, claims);
}

/**
 * Build custom claims from user document data
 */
export function buildUserClaims(userData: any, uid?: string): UserClaims {
  const fallbackId = uid || 'unknown';
  
  const claims: UserClaims = {
    companyId: userData.companyId || userData.ownCompanyId || fallbackId,
    ownCompanyId: userData.ownCompanyId || userData.companyId || fallbackId,
    activeCompanyId: userData.activeCompanyId || userData.ownCompanyId || userData.companyId || fallbackId,
    role: userData.role || 'ADMIN',
  };

  // Add subcontractor roles if present
  if (userData.subcontractorRoles && Object.keys(userData.subcontractorRoles).length > 0) {
    claims.subcontractorRoles = userData.subcontractorRoles;
  }

  return claims;
}

/**
 * Update user claims from their Firestore document
 */
export async function refreshUserClaims(uid: string): Promise<void> {
  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) {
    throw new Error('User document not found');
  }

  const userData = userDoc.data()!;
  const claims = buildUserClaims(userData, uid);
  
  await setCustomUserClaims(uid, claims);
}

/**
 * Extract and validate user claims from request
 */
export function getUserClaims(request: { data: any; auth?: any }): UserClaims {
  if (!request.auth) {
    throw new Error('Unauthenticated');
  }

  const token = request.auth.token;
  const ownCompanyId = token.ownCompanyId as string;
  const activeCompanyId = token.activeCompanyId as string;
  const role = token.role as 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';

  if (!ownCompanyId || !activeCompanyId || !role) {
    throw new Error('Missing required user claims. User needs to be invited properly.');
  }

  const claims: UserClaims = {
    companyId: token.companyId || ownCompanyId,
    ownCompanyId,
    activeCompanyId,
    role,
  };

  if (token.subcontractorRoles) {
    claims.subcontractorRoles = token.subcontractorRoles;
  }

  return claims;
}

/**
 * Verify user has required role
 */
export function requireRole(
  claims: UserClaims,
  allowedRoles: Array<'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR'>
): void {
  if (!allowedRoles.includes(claims.role)) {
    throw new Error(`Insufficient permissions. Required: ${allowedRoles.join(' or ')}`);
  }
}

/**
 * Verify user is admin or manager
 */
export function requireAdminOrManager(claims: UserClaims): void {
  requireRole(claims, ['ADMIN', 'MANAGER']);
}
