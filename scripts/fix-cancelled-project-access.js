/**
 * Fix: Revoke access to cancelled projects
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixCancelledProjectAccess() {
  console.log('🔧 FIXING CANCELLED PROJECT ACCESS\n');
  console.log('=' .repeat(80));

  try {
    // Get all clientProjectAccess records
    const accessSnap = await db.collection('clientProjectAccess')
      .where('active', '==', true)
      .get();
    
    console.log(`\nFound ${accessSnap.size} active access records\n`);
    console.log('Checking project statuses...\n');

    let revokedCount = 0;
    const revokedProjects = [];

    for (const accessDoc of accessSnap.docs) {
      const accessData = accessDoc.data();
      const projectId = accessData.projectId;
      
      // Get project details
      const projectDoc = await db.collection('projects').doc(projectId).get();
      
      if (projectDoc.exists) {
        const projectData = projectDoc.data();
        
        // Check if project is CANCELLED
        if (projectData.status === 'CANCELLED') {
          console.log(`⚠️  Found CANCELLED project with active access:`);
          console.log(`   Project: ${projectData.name}`);
          console.log(`   Code: ${projectData.projectCode}`);
          console.log(`   Access ID: ${accessDoc.id}`);
          console.log(`   Revoking access...`);
          
          // Revoke access
          await db.collection('clientProjectAccess').doc(accessDoc.id).update({
            active: false,
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            revokedReason: 'Project cancelled',
            autoRevoked: true
          });
          
          console.log(`   ✅ Access revoked\n`);
          revokedCount++;
          revokedProjects.push({
            name: projectData.name,
            code: projectData.projectCode,
            accessId: accessDoc.id
          });
        }
      }
    }

    // Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SUMMARY:\n');
    console.log(`Total access records checked: ${accessSnap.size}`);
    console.log(`Access records revoked: ${revokedCount}`);
    
    if (revokedCount > 0) {
      console.log('\n✅ Fixed Projects:');
      revokedProjects.forEach(p => {
        console.log(`   - ${p.name} (${p.code})`);
      });
    } else {
      console.log('\n✅ No cancelled projects with access found');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCancelledProjectAccess()
  .then(() => {
    console.log('\n✅ Fix complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
