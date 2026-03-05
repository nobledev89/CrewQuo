/**
 * Script to manually refresh custom claims for all CLIENT users
 * This ensures existing CLIENT users get their contractorCompanyIds in custom claims
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../service-account-key.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function refreshAllClientUserClaims() {
  console.log('Starting to refresh CLIENT user claims...\n');

  try {
    // Get all users with role CLIENT
    const usersSnap = await db
      .collection('users')
      .where('role', '==', 'CLIENT')
      .get();

    console.log(`Found ${usersSnap.size} CLIENT users\n`);

    if (usersSnap.empty) {
      console.log('No CLIENT users found');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`Processing CLIENT user: ${userId} (${userData.email})`);

      try {
        // Get clientUsers document for this user
        const clientUsersSnap = await db
          .collection('clientUsers')
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (clientUsersSnap.empty) {
          console.log(`  ⚠️  No clientUsers document found for ${userId}`);
          errorCount++;
          continue;
        }

        const clientUserData = clientUsersSnap.docs[0].data();

        // Build and set custom claims
        const claims = {
          role: 'CLIENT' as const,
          clientOrgId: clientUserData.clientOrgId,
          contractorCompanyIds: clientUserData.contractorCompanyIds || [],
        };

        await admin.auth().setCustomUserClaims(userId, claims);

        console.log(`  ✅ Claims refreshed:`, {
          clientOrgId: claims.clientOrgId,
          contractorCount: claims.contractorCompanyIds.length,
        });

        successCount++;
      } catch (error) {
        console.error(`  ❌ Error refreshing claims for ${userId}:`, error);
        errorCount++;
      }

      console.log(''); // Empty line for readability
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total CLIENT users: ${usersSnap.size}`);
    console.log(`Successfully refreshed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\n✨ Done! CLIENT users should now be able to access their projects.');
    console.log('📝 Note: Users may need to sign out and sign back in for claims to take effect.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
refreshAllClientUserClaims()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
