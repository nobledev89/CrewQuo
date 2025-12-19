import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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

interface Assignment {
  id: string;
  projectId: string;
  subcontractorId: string;
  companyId: string;
  assignedAt: admin.firestore.Timestamp;
  [key: string]: any;
}

async function cleanupDuplicateAssignments() {
  console.log('\n🧹 Starting cleanup of duplicate project assignments...\n');

  try {
    // Get all project assignments
    const assignmentsSnapshot = await db.collection('projectAssignments').get();
    console.log(`📊 Found ${assignmentsSnapshot.size} total assignments\n`);

    // Group by projectId + subcontractorId
    const assignmentGroups = new Map<string, Assignment[]>();

    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data() as Assignment;
      const key = `${data.projectId}_${data.subcontractorId}`;
      
      if (!assignmentGroups.has(key)) {
        assignmentGroups.set(key, []);
      }
      
      assignmentGroups.get(key)!.push({
        id: doc.id,
        ...data,
      });
    });

    // Find duplicates
    let totalDuplicates = 0;
    let totalDeleted = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const [key, assignments] of assignmentGroups.entries()) {
      if (assignments.length > 1) {
        totalDuplicates += assignments.length - 1;
        
        // Sort by assignedAt (keep the oldest one)
        assignments.sort((a, b) => {
          const aTime = a.assignedAt ? a.assignedAt.toMillis() : 0;
          const bTime = b.assignedAt ? b.assignedAt.toMillis() : 0;
          return aTime - bTime;
        });

        const [keep, ...duplicates] = assignments;
        
        console.log(`\n🔍 Found ${duplicates.length} duplicate(s) for ${key}`);
        console.log(`   ✅ Keeping: ${keep.id} (assigned at: ${keep.assignedAt?.toDate().toISOString() || 'unknown'})`);
        
        // Check if the kept assignment has the correct deterministic ID
        const correctId = key;
        if (keep.id !== correctId) {
          console.log(`   🔄 Migrating to deterministic ID: ${correctId}`);
          // Create new document with correct ID
          batch.set(db.collection('projectAssignments').doc(correctId), {
            projectId: keep.projectId,
            subcontractorId: keep.subcontractorId,
            companyId: keep.companyId,
            assignedAt: keep.assignedAt,
            assignedBy: keep.assignedBy || keep.userId,
            userId: keep.userId,
          });
          batchCount++;
          
          // Delete old document
          batch.delete(db.collection('projectAssignments').doc(keep.id));
          batchCount++;
          totalDeleted++;
        }

        // Delete duplicates
        for (const dup of duplicates) {
          console.log(`   ❌ Deleting: ${dup.id}`);
          batch.delete(db.collection('projectAssignments').doc(dup.id));
          batchCount++;
          totalDeleted++;
        }

        // Commit batch if it reaches 500 operations
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`\n💾 Committed batch of ${batchCount} operations`);
          batchCount = 0;
        }
      }
    }

    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} operations`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Cleanup completed successfully!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Total assignments processed: ${assignmentsSnapshot.size}`);
    console.log(`   - Unique assignments: ${assignmentGroups.size}`);
    console.log(`   - Duplicates found: ${totalDuplicates}`);
    console.log(`   - Documents deleted: ${totalDeleted}`);
    console.log(`   - Final count: ${assignmentGroups.size}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicateAssignments()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
