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

const auth = admin.auth();
const db = admin.firestore();

async function debugUserClaims(email: string) {
  try {
    console.log(`\n=== Debugging user: ${email} ===\n`);
    
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log('User UID:', user.uid);
    console.log('Email:', user.email);
    console.log('Email Verified:', user.emailVerified);
    
    // Get custom claims
    const userRecord = await auth.getUser(user.uid);
    console.log('\n--- Custom Claims ---');
    console.log(JSON.stringify(userRecord.customClaims, null, 2));
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      console.log('\n--- User Document ---');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    }
    
    // Check if they have a company
    const claims = userRecord.customClaims || {};
    if (claims.ownCompanyId) {
      const companyDoc = await db.collection('companies').doc(claims.ownCompanyId as string).get();
      if (companyDoc.exists) {
        console.log('\n--- Company Document ---');
        console.log(JSON.stringify(companyDoc.data(), null, 2));
      }
    }
    
    // Check for project assignments with this company
    if (claims.ownCompanyId) {
      const assignmentsQuery = await db.collection('projectAssignments')
        .where('companyId', '==', claims.ownCompanyId)
        .limit(5)
        .get();
      
      console.log(`\n--- Sample Project Assignments (${assignmentsQuery.size} found) ---`);
      assignmentsQuery.forEach(doc => {
        console.log(`Assignment ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
      });
    }
    
    console.log('\n=== Analysis ===');
    console.log('Expected token claims for projectAssignments access:');
    console.log('- activeCompanyId: should match companyId in projectAssignments');
    console.log('- ownCompanyId: should match companyId in projectAssignments');
    console.log('- role: should be ADMIN or MANAGER');
    console.log('\nActual values:');
    console.log('- activeCompanyId:', claims.activeCompanyId || 'MISSING');
    console.log('- ownCompanyId:', claims.ownCompanyId || 'MISSING');
    console.log('- companyId:', claims.companyId || 'MISSING');
    console.log('- role:', claims.role || 'MISSING');
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Run the debug
const email = process.argv[2] || 'dan@corporatespec.com';
debugUserClaims(email).then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
});
