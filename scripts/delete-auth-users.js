const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Option 1: Using environment variables
// Option 2: Using service account key file (serviceAccountKey.json)
// Option 3: Using Application Default Credentials

let initialized = false;

try {
  // Try with environment variables first
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized with environment variables');
  }
} catch (error) {
  console.log('⚠️  Could not initialize with environment variables');
}

// Try with service account key file
if (!initialized) {
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized with service account key file');
  } catch (error) {
    console.log('⚠️  Could not initialize with service account key file');
  }
}

// Try with Application Default Credentials (gcloud)
if (!initialized) {
  try {
    admin.initializeApp({
      projectId: 'projects-corporatespec',
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized with Application Default Credentials');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

async function deleteAllAuthUsers() {
  console.log('');
  console.log('🧹 Starting Authentication user cleanup...');
  console.log('⚠️  This will delete ALL authentication users!');
  console.log('');

  let totalDeleted = 0;
  const maxResults = 1000;

  try {
    async function deleteUserBatch(nextPageToken) {
      const listUsersResult = await admin.auth().listUsers(maxResults, nextPageToken);
      
      if (listUsersResult.users.length === 0) {
        return null;
      }

      console.log(`📦 Found ${listUsersResult.users.length} users to delete...`);

      // Delete users one by one with error handling
      for (const user of listUsersResult.users) {
        try {
          await admin.auth().deleteUser(user.uid);
          totalDeleted++;
          console.log(`   ✅ Deleted: ${user.email || user.uid}`);
        } catch (error) {
          console.error(`   ❌ Failed to delete ${user.email || user.uid}:`, error.message);
        }
      }

      return listUsersResult.pageToken;
    }

    let pageToken = undefined;
    do {
      pageToken = await deleteUserBatch(pageToken);
    } while (pageToken);

    console.log('');
    console.log('🎉 Authentication cleanup completed!');
    console.log(`📊 Total users deleted: ${totalDeleted}`);
    console.log('');
    console.log('✨ You can now create new accounts without email conflicts!');
  } catch (error) {
    console.error('');
    console.error('❌ Error during cleanup:', error.message);
    console.error('');
    console.error('💡 Please ensure you have proper permissions to delete users.');
    console.error('   You may need to:');
    console.error('   1. Check your Firebase project permissions');
    console.error('   2. Ensure gcloud is authenticated: gcloud auth application-default login');
    console.error('   3. Or provide a service account key file');
    process.exit(1);
  }
}

deleteAllAuthUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
