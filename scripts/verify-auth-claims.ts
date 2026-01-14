require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

console.log('ENV Check:');
console.log('  FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING');
console.log('  FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING');
console.log('  FIREBASE_ADMIN_PRIVATE_KEY:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? 'SET' : 'MISSING');
console.log();

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  console.error('❌ ERROR: .env.local file not found or FIREBASE_ADMIN_PROJECT_ID not set!');
  console.log('Please ensure .env.local exists with Firebase Admin credentials.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function verifyUserClaims() {
  const userId = 'MWNFsacjB9YdeF3pNkLe4iP9WD3'; // hanmorelltd@gmail.com
  
  console.log('='.repeat(60));
  console.log('CHECKING FIREBASE AUTH CUSTOM CLAIMS');
  console.log('='.repeat(60));
  
  try {
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUser(userId);
    
    console.log('\n📧 User Email:', userRecord.email);
    console.log('🆔 User ID:', userRecord.uid);
    
    console.log('\n🔐 Custom Claims:');
    console.log(JSON.stringify(userRecord.customClaims, null, 2));
    
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    console.log('\n📄 Firestore User Document:');
    console.log('  - companyId:', userData?.companyId);
    console.log('  - ownCompanyId:', userData?.ownCompanyId);
    console.log('  - activeCompanyId:', userData?.activeCompanyId);
    console.log('  - role:', userData?.role);
    console.log('  - subcontractorRoles:', JSON.stringify(userData?.subcontractorRoles, null, 2));
    
    // Compare
    console.log('\n⚠️  COMPARISON:');
    console.log('Auth Claims activeCompanyId:', userRecord.customClaims?.activeCompanyId);
    console.log('Firestore activeCompanyId:', userData?.activeCompanyId);
    console.log('Match:', userRecord.customClaims?.activeCompanyId === userData?.activeCompanyId ? '✅' : '❌');
    
    console.log('\nAuth Claims subcontractorRoles:', userRecord.customClaims?.subcontractorRoles);
    console.log('Firestore subcontractorRoles:', userData?.subcontractorRoles);
    
    // Check if claims need to be refreshed
    if (!userRecord.customClaims?.subcontractorRoles) {
      console.log('\n❌ PROBLEM FOUND: Custom claims do NOT have subcontractorRoles!');
      console.log('🔧 Need to set custom claims from Firestore data...');
      
      const claims = {
        companyId: userData?.companyId,
        ownCompanyId: userData?.ownCompanyId,
        activeCompanyId: userData?.activeCompanyId,
        role: userData?.role,
        subcontractorRoles: userData?.subcontractorRoles,
      };
      
      await admin.auth().setCustomUserClaims(userId, claims);
      console.log('✅ Custom claims updated!');
      console.log('New claims:', JSON.stringify(claims, null, 2));
    } else {
      console.log('\n✅ Custom claims appear to have subcontractorRoles');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

verifyUserClaims();
