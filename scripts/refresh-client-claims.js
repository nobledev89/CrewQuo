/**
 * Script to manually refresh custom claims for all CLIENT users
 * This ensures existing CLIENT users get their contractorCompanyIds in custom claims
 * Usage: node scripts/refresh-client-claims.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

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
          role: 'CLIENT',
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
        console.error(`  ❌ Error refreshing claims for ${userId}:`, error.message);
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
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
