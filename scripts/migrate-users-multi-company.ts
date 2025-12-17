/**
 * Migration Script: Add Multi-Company Support to Existing Users
 * 
 * This script updates existing user documents with new fields:
 * - ownCompanyId: Their primary company
 * - activeCompanyId: Currently viewing company
 * - subcontractorRoles: Empty object (will be populated when accepting invites)
 * - subscriptionPlan: Default to 'free' if not set
 * - subscriptionStatus: Default to 'inactive' if not set
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function migrateUsers() {
  console.log('🚀 Starting user migration for multi-company support...\n');

  try {
    // Fetch all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users found to migrate.');
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} users to migrate.\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        // Check if already migrated
        if (userData.ownCompanyId && userData.activeCompanyId) {
          console.log(`⏭️  Skipping ${userData.email} - already migrated`);
          skipCount++;
          continue;
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Set ownCompanyId (use existing companyId)
        if (!userData.ownCompanyId && userData.companyId) {
          updateData.ownCompanyId = userData.companyId;
        }

        // Set activeCompanyId (default to their own company)
        if (!userData.activeCompanyId) {
          updateData.activeCompanyId = userData.companyId || userId;
        }

        // Initialize subcontractorRoles if not present
        if (!userData.subcontractorRoles) {
          updateData.subcontractorRoles = {};
        }

        // Set default subscription plan if not present
        if (!userData.subscriptionPlan) {
          updateData.subscriptionPlan = 'free';
        }

        // Set default subscription status if not present
        if (!userData.subscriptionStatus) {
          updateData.subscriptionStatus = 'inactive';
        }

        // Update the user document
        await db.collection('users').doc(userId).update(updateData);

        console.log(`✅ Migrated ${userData.email}`);
        console.log(`   - ownCompanyId: ${updateData.ownCompanyId || userData.ownCompanyId}`);
        console.log(`   - activeCompanyId: ${updateData.activeCompanyId || userData.activeCompanyId}`);
        console.log(`   - subscriptionPlan: ${updateData.subscriptionPlan || userData.subscriptionPlan}`);
        console.log('');

        successCount++;

        // Update custom claims
        try {
          const customClaims = {
            companyId: userData.companyId,
            ownCompanyId: updateData.ownCompanyId || userData.ownCompanyId,
            activeCompanyId: updateData.activeCompanyId || userData.activeCompanyId,
            role: userData.role,
            subcontractorRoles: {},
          };

          await admin.auth().setCustomUserClaims(userId, customClaims);
          console.log(`   🔐 Updated custom claims for ${userData.email}`);
        } catch (claimError) {
          console.log(`   ⚠️  Could not update claims for ${userData.email}:`, claimError);
        }

      } catch (error) {
        console.error(`❌ Error migrating ${userData.email}:`, error);
        errorCount++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already migrated): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${usersSnapshot.size}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
