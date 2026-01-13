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
    console.log('✅ Firebase Admin initialized\n');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const auth = admin.auth();

async function listAllUsers() {
  try {
    console.log('=== All Firebase Authentication Users ===\n');
    
    const listUsersResult = await auth.listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      console.log('⚠️  No users found in Firebase Authentication!');
      return;
    }
    
    console.log(`Found ${listUsersResult.users.length} user(s):\n`);
    
    listUsersResult.users.forEach((userRecord, index) => {
      console.log(`${index + 1}. Email: ${userRecord.email || 'NO EMAIL'}`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email Verified: ${userRecord.emailVerified}`);
      console.log(`   Created: ${userRecord.metadata.creationTime}`);
      console.log(`   Last Sign In: ${userRecord.metadata.lastSignInTime || 'Never'}`);
      
      if (userRecord.customClaims && Object.keys(userRecord.customClaims).length > 0) {
        console.log(`   Custom Claims: ${JSON.stringify(userRecord.customClaims, null, 2)}`);
      } else {
        console.log(`   Custom Claims: None`);
      }
      console.log('');
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

listAllUsers().then(() => {
  console.log('✅ Complete');
  process.exit(0);
});
