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

// Collection names to clean up
const COLLECTIONS = [
  'users',
  'companies',
  'roleCatalog',
  'clients',
  'subcontractors',
  'projects',
  'projectAssignments',
  'rateCards',
  'rateCardTemplates',
  'timeLogs',
  'expenses',
  'invoices',
  'notifications',
  'auditLogs',
];

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  const batchSize = 500;
  let totalDeleted = 0;

  async function deleteQueryBatch(): Promise<number> {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  let deletedInBatch = 0;
  do {
    deletedInBatch = await deleteQueryBatch();
    totalDeleted += deletedInBatch;
  } while (deletedInBatch > 0);

  return totalDeleted;
}

async function deleteAllAuthUsers(): Promise<number> {
  let totalDeleted = 0;
  const maxResults = 1000;

  async function deleteUserBatch(nextPageToken?: string): Promise<string | undefined> {
    const listUsersResult = await auth.listUsers(maxResults, nextPageToken);
    
    if (listUsersResult.users.length === 0) {
      return undefined;
    }

    // Delete users in batches
    const deletePromises = listUsersResult.users.map((user) => 
      auth.deleteUser(user.uid)
        .then(() => {
          totalDeleted++;
          console.log(`   Deleted user: ${user.email || user.uid}`);
        })
        .catch((error) => {
          console.error(`   Failed to delete user ${user.email || user.uid}:`, error.message);
        })
    );

    await Promise.all(deletePromises);

    return listUsersResult.pageToken;
  }

  let pageToken: string | undefined;
  do {
    pageToken = await deleteUserBatch(pageToken);
  } while (pageToken);

  return totalDeleted;
}

async function cleanup() {
  console.log('🧹 Starting database cleanup...');
  console.log('⚠️  This will delete ALL data from Firestore and Authentication!');
  console.log('');

  try {
    // Step 1: Delete all Firestore collections
    console.log('📦 Deleting Firestore collections...');
    for (const collection of COLLECTIONS) {
      const count = await deleteCollection(collection);
      if (count > 0) {
        console.log(`   ✅ Deleted ${count} documents from '${collection}'`);
      } else {
        console.log(`   ⚪ No documents in '${collection}'`);
      }
    }
    console.log('');

    // Step 2: Delete all Authentication users
    console.log('👤 Deleting Authentication users...');
    const deletedUsers = await deleteAllAuthUsers();
    if (deletedUsers > 0) {
      console.log(`   ✅ Deleted ${deletedUsers} auth user(s)`);
    } else {
      console.log(`   ⚪ No auth users to delete`);
    }
    console.log('');

    console.log('🎉 Cleanup completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Firestore collections cleaned: ${COLLECTIONS.length}`);
    console.log(`  - Auth users deleted: ${deletedUsers}`);
    console.log('');
    console.log('✨ Database is now clean and ready for new data!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
