/**
 * Script to refresh user custom claims
 * Run this to update your authentication token with the latest claims
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function refreshUserToken(email: string) {
  try {
    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    
    console.log(`\nFound user: ${email} (${uid})`);
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.error('User document not found in Firestore');
      process.exit(1);
    }
    
    const userData = userDoc.data()!;
    console.log('\nUser document data:');
    console.log('- ownCompanyId:', userData.ownCompanyId);
    console.log('- activeCompanyId:', userData.activeCompanyId);
    console.log('- role:', userData.role);
    console.log('- subcontractorRoles:', userData.subcontractorRoles || 'none');
    
    // Build claims
    const claims: any = {
      companyId: userData.companyId || userData.ownCompanyId || uid,
      ownCompanyId: userData.ownCompanyId || userData.companyId || uid,
      activeCompanyId: userData.activeCompanyId || userData.ownCompanyId || userData.companyId || uid,
      role: userData.role || 'ADMIN',
    };
    
    // Add subcontractor roles if present
    if (userData.subcontractorRoles && Object.keys(userData.subcontractorRoles).length > 0) {
      claims.subcontractorRoles = userData.subcontractorRoles;
    }
    
    console.log('\nSetting custom claims:');
    console.log(JSON.stringify(claims, null, 2));
    
    // Set custom claims
    await auth.setCustomUserClaims(uid, claims);
    
    console.log('\n✅ Custom claims updated successfully!');
    console.log('\nNext steps:');
    console.log('1. Sign out of your application');
    console.log('2. Sign back in');
    console.log('3. Try accessing a project again');
    console.log('\nOr just hard refresh your browser (Ctrl+Shift+R)');
    
  } catch (error) {
    console.error('Error refreshing user token:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Please provide an email address:');
  console.error('  ts-node scripts/refresh-user-token.ts your@email.com');
  process.exit(1);
}

refreshUserToken(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
