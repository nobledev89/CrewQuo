import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixProjectClientNames() {
  try {
    console.log('🔧 Fixing missing clientName fields in projects...\n');

    // Get all projects
    const projectsSnapshot = await db.collection('projects').get();
    
    console.log(`📋 Found ${projectsSnapshot.size} total projects\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const projectData = projectDoc.data();
      const projectId = projectDoc.id;

      // Check if clientName is missing or is 'Unknown'
      if (!projectData.clientName || projectData.clientName === 'Unknown') {
        try {
          // Fetch the client document
          const clientDoc = await db.collection('clients').doc(projectData.clientId).get();
          
          if (clientDoc.exists) {
            const clientData = clientDoc.data();
            
            // Update project with correct clientName
            await db.collection('projects').doc(projectId).update({
              clientName: clientData?.name || 'Unknown',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ Fixed: ${projectData.name || projectId}`);
            console.log(`   Client: ${clientData?.name || 'Unknown'}\n`);
            fixedCount++;
          } else {
            console.log(`⚠️  Skipped: ${projectData.name || projectId} - Client not found (${projectData.clientId})\n`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error fixing ${projectData.name || projectId}:`, error);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total projects: ${projectsSnapshot.size}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixProjectClientNames();
