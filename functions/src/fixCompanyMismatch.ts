import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const fixCompanyMismatch = functions.https.onCall(async (data, context) => {
  // Only allow admins to run this
  if (!context.auth || context.auth.token.role !== 'ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can run this function');
  }
  
  const userId = data.userId || 'MWNFsacjB9YdeF3pNkLe4iP9WD3';
  const projectId = data.projectId || 'hGG4rcX7Me2TzcOIUHci';
  
  const db = admin.firestore();
  const auth = admin.auth();
  
  const log: string[] = [];
  
  try {
    log.push('='.repeat(70));
    log.push('FIXING COMPANY ID MISMATCH');
    log.push('='.repeat(70));
    
    // Get user document
    log.push('\n1️⃣ Fetching user document...');
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) {
      throw new Error('User document not found');
    }
    
    log.push(`   User activeCompanyId: ${userData?.activeCompanyId}`);
    log.push(`   User subcontractorRoles: ${JSON.stringify(userData?.subcontractorRoles, null, 2)}`);
    
    // Get project document
    log.push('\n2️⃣ Fetching project document...');
    const projectDoc = await db.collection('projects').doc(projectId).get();
    const projectData = projectDoc.data();
    
    if (!projectData) {
      throw new Error('Project document not found');
    }
    
    log.push(`   Project companyId: ${projectData?.companyId}`);
    log.push(`   Project name: ${projectData?.name}`);
    
    const projectCompanyId = projectData?.companyId;
    
    log.push('\n3️⃣ Checking which company ID is valid...');
    
    // Check if project's company exists
    const projectCompanyDoc = await db.collection('companies').doc(projectCompanyId).get();
    const projectCompanyExists = projectCompanyDoc.exists;
    log.push(`   Project company (${projectCompanyId}): ${projectCompanyExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    if (!projectCompanyExists) {
      throw new Error('Project company does not exist!');
    }
    
    const correctCompanyId = projectCompanyId;
    log.push(`\n✅ Will align user to project company: ${correctCompanyId}`);
    
    // Update user's subcontractorRoles
    log.push('\n4️⃣ Updating user assignment...');
    
    const currentSubRoles = userData?.subcontractorRoles || {};
    const subRoleForCorrectCompany = currentSubRoles[correctCompanyId];
    
    if (!subRoleForCorrectCompany) {
      // Find existing subcontractor role from another company
      const existingRoleKeys = Object.keys(currentSubRoles);
      if (existingRoleKeys.length > 0) {
        const existingRole = currentSubRoles[existingRoleKeys[0]];
        
        log.push(`   Adding subcontractor role for company: ${correctCompanyId}`);
        log.push(`   Using subcontractor ID: ${existingRole.subcontractorId}`);
        
        // Add the new company to subcontractorRoles
        currentSubRoles[correctCompanyId] = {
          subcontractorId: existingRole.subcontractorId,
          role: existingRole.role || 'SUBCONTRACTOR',
          companyName: projectCompanyDoc.data()?.name || 'Unknown'
        };
        
        // Update Firestore
        await db.collection('users').doc(userId).update({
          subcontractorRoles: currentSubRoles,
          activeCompanyId: correctCompanyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        log.push('   ✅ User document updated in Firestore');
        
        // Update Auth custom claims
        log.push('\n5️⃣ Updating Firebase Auth custom claims...');
        await auth.setCustomUserClaims(userId, {
          companyId: userData?.companyId,
          ownCompanyId: userData?.ownCompanyId,
          activeCompanyId: correctCompanyId,
          role: userData?.role,
          subcontractorRoles: currentSubRoles
        });
        
        log.push('   ✅ Auth custom claims updated');
        log.push('\n' + '='.repeat(70));
        log.push('✅ FIX COMPLETED!');
        log.push('='.repeat(70));
        
      } else {
        log.push('   ❌ ERROR: No existing subcontractor roles found');
        throw new Error('No existing subcontractor roles found to copy from');
      }
    } else {
      log.push('   ℹ️  User already has subcontractor role for correct company');
      
      // Just update activeCompanyId if needed
      if (userData?.activeCompanyId !== correctCompanyId) {
        await db.collection('users').doc(userId).update({
          activeCompanyId: correctCompanyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await auth.setCustomUserClaims(userId, {
          companyId: userData?.companyId,
          ownCompanyId: userData?.ownCompanyId,
          activeCompanyId: correctCompanyId,
          role: userData?.role,
          subcontractorRoles: currentSubRoles
        });
        
        log.push('   ✅ Updated activeCompanyId');
        log.push('\n✅ FIX COMPLETED!');
      } else {
        log.push('   ✅ Everything already correct!');
      }
    }
    
    return {
      success: true,
      log: log.join('\n'),
      message: 'User permissions have been fixed. Please refresh the page or sign out and back in.'
    };
    
  } catch (error: any) {
    log.push(`\n❌ Error: ${error.message}`);
    return {
      success: false,
      log: log.join('\n'),
      error: error.message
    };
  }
});
