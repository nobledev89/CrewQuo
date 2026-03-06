/**
 * Diagnostic script to identify company ID mismatch
 * Run with: node scripts/diagnose-company-mismatch.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function diagnoseMismatch() {
  console.log('🔍 Starting Company ID Mismatch Diagnosis...\n');

  try {
    // Step 1: Get all users with ADMIN or MANAGER role
    console.log('📋 Step 1: Fetching admin/manager users...');
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['ADMIN', 'MANAGER'])
      .get();

    console.log(`Found ${usersSnapshot.size} admin/manager users\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`\n👤 User: ${userData.email || userId}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   companyId: ${userData.companyId || 'NOT SET'}`);
      console.log(`   ownCompanyId: ${userData.ownCompanyId || 'NOT SET'}`);
      console.log(`   activeCompanyId: ${userData.activeCompanyId || 'NOT SET'}`);
      
      const userCompanyId = userData.activeCompanyId || userData.companyId;
      
      if (!userCompanyId) {
        console.log('   ⚠️  WARNING: No company ID found for this user!');
        continue;
      }

      // Step 2: Get all clients for this user's company
      console.log(`\n   🔍 Checking clients for company: ${userCompanyId}`);
      const clientsSnapshot = await db.collection('clients')
        .where('companyId', '==', userCompanyId)
        .get();
      
      console.log(`   Found ${clientsSnapshot.size} clients`);

      // Step 3: For each client, check projects
      for (const clientDoc of clientsSnapshot.docs) {
        const clientData = clientDoc.data();
        const clientId = clientDoc.id;
        
        console.log(`\n   📁 Client: ${clientData.name} (${clientId})`);
        
        // Check projects for this client
        const projectsSnapshot = await db.collection('projects')
          .where('clientId', '==', clientId)
          .get();
        
        console.log(`      Total projects with this clientId: ${projectsSnapshot.size}`);
        
        if (projectsSnapshot.size > 0) {
          let matchingCompanyCount = 0;
          let mismatchedProjects = [];
          
          projectsSnapshot.docs.forEach(projectDoc => {
            const projectData = projectDoc.data();
            if (projectData.companyId === userCompanyId) {
              matchingCompanyCount++;
            } else {
              mismatchedProjects.push({
                id: projectDoc.id,
                name: projectData.name || projectData.projectCode,
                companyId: projectData.companyId,
                clientId: projectData.clientId,
              });
            }
          });
          
          console.log(`      Projects matching user's companyId (${userCompanyId}): ${matchingCompanyCount}`);
          
          if (mismatchedProjects.length > 0) {
            console.log(`      ⚠️  MISMATCHED PROJECTS: ${mismatchedProjects.length}`);
            mismatchedProjects.forEach(p => {
              console.log(`         - ${p.name} (${p.id})`);
              console.log(`           Project companyId: ${p.companyId}`);
              console.log(`           User companyId: ${userCompanyId}`);
            });
          }
        }

        // Check client project access
        if (clientData.clientOrgId) {
          const accessSnapshot = await db.collection('clientProjectAccess')
            .where('clientOrgId', '==', clientData.clientOrgId)
            .get();
          
          if (accessSnapshot.size > 0) {
            console.log(`      ✅ Client has ${accessSnapshot.size} projects granted access via clientProjectAccess`);
          }
        }
      }
    }

    console.log('\n\n📊 SUMMARY');
    console.log('=====================================');
    console.log('If you see MISMATCHED PROJECTS above, this is the issue.');
    console.log('The projects have a different companyId than the user\'s account.');
    console.log('\n💡 Next step: Run fix-company-mismatch.js to correct the data.');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Run the diagnosis
diagnoseMismatch()
  .then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });
