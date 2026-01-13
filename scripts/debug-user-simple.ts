import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin using the service account file
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'firebase-service-account.json'), 'utf8')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
    console.log('✅ User found!');
    console.log('User UID:', user.uid);
    console.log('Email:', user.email);
    console.log('Email Verified:', user.emailVerified);
    
    // Get custom claims
    const userRecord = await auth.getUser(user.uid);
    console.log('\n--- Custom Claims (in Firebase Auth token) ---');
    if (!userRecord.customClaims || Object.keys(userRecord.customClaims).length === 0) {
      console.log('⚠️  NO CUSTOM CLAIMS SET - This is the problem!');
    } else {
      console.log(JSON.stringify(userRecord.customClaims, null, 2));
    }
    
    // Get user document from Firestore
    console.log('\n--- User Document (in Firestore) ---');
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('ownCompanyId:', userData?.ownCompanyId || 'NOT SET');
      console.log('activeCompanyId:', userData?.activeCompanyId || 'NOT SET');
      console.log('companyId:', userData?.companyId || 'NOT SET');
      console.log('role:', userData?.role || 'NOT SET');
      console.log('subcontractorRoles:', JSON.stringify(userData?.subcontractorRoles || {}, null, 2));
    } else {
      console.log('⚠️  User document does not exist in Firestore!');
    }
    
    // Check for subcontractor records
    console.log('\n--- Subcontractor Records ---');
    const subcontractorsQuery = await db.collection('subcontractors')
      .where('userId', '==', user.uid)
      .get();
    
    if (subcontractorsQuery.empty) {
      console.log('⚠️  No subcontractor records found for this user');
    } else {
      subcontractorsQuery.forEach(doc => {
        const data = doc.data();
        console.log(`\nSubcontractor ${doc.id}:`);
        console.log('  Company ID:', data.companyId);
        console.log('  Status:', data.inviteStatus);
        console.log('  User ID:', data.userId);
      });
    }
    
    // Check for project assignments
    const claims = userRecord.customClaims || {};
    if (claims.ownCompanyId) {
      console.log(`\n--- Project Assignments (for company ${claims.ownCompanyId}) ---`);
      const assignmentsQuery = await db.collection('projectAssignments')
        .where('companyId', '==', claims.ownCompanyId)
        .limit(5)
        .get();
      
      console.log(`Found ${assignmentsQuery.size} project assignments`);
      assignmentsQuery.forEach(doc => {
        const data = doc.data();
        console.log(`  - Project: ${data.projectId}, Subcontractor: ${data.subcontractorId}`);
      });
    }
    
    console.log('\n=== DIAGNOSIS ===');
    
    const hasCustomClaims = userRecord.customClaims && Object.keys(userRecord.customClaims).length > 0;
    const hasUserDoc = userDoc.exists;
    const hasSubcontractorRecord = !subcontractorsQuery.empty;
    
    if (!hasCustomClaims) {
      console.log('❌ PROBLEM: No custom claims set on Firebase Auth user');
      console.log('   SOLUTION: Run the set-claims script or refreshClaims function');
    } else if (!hasUserDoc) {
      console.log('❌ PROBLEM: User document missing from Firestore');
      console.log('   SOLUTION: User needs to complete signup process');
    } else if (!hasSubcontractorRecord) {
      console.log('⚠️  WARNING: No subcontractor records found');
      console.log('   This user may be a company owner, not a subcontractor');
      console.log('   Check if they should have access to the project they\'re trying to view');
    } else {
      console.log('✅ Custom claims are set');
      console.log('✅ User document exists');
      console.log('✅ Subcontractor record exists');
      console.log('\nIf the error persists, check:');
      console.log('1. Does the user have access to the specific project?');
      console.log('2. Is the projectAssignment record created?');
      console.log('3. Does the activeCompanyId match the project\'s companyId?');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.log('\n⚠️  User not found in Firebase Auth. Check the email address.');
    }
  }
}

// Run the debug
const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/debug-user-simple.ts <email>');
  process.exit(1);
}

debugUserClaims(email).then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
});
