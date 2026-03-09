/**
 * Diagnose why "Pashe Jobs February 2026" is visible to client
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

async function diagnose() {
  console.log('🔍 DIAGNOSING CLIENT ACCESS ISSUE\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Find PricewaterhouseCoopers client organization
    console.log('\n📋 Step 1: Finding PricewaterhouseCoopers client organization...\n');
    
    const clientOrgsSnap = await db.collection('clientOrganizations')
      .where('name', '==', 'PricewaterhouseCoopers')
      .get();
    
    if (clientOrgsSnap.empty) {
      console.log('❌ No client organization found with name "PricewaterhouseCoopers"');
      return;
    }

    const clientOrg = clientOrgsSnap.docs[0];
    const clientOrgId = clientOrg.id;
    const clientOrgData = clientOrg.data();
    
    console.log(`✅ Found: ${clientOrgData.name}`);
    console.log(`   ID: ${clientOrgId}`);
    console.log(`   Created: ${clientOrgData.createdAt?.toDate()}`);

    // Step 2: Get all active project access records for this client org
    console.log('\n📋 Step 2: Querying all active clientProjectAccess records...\n');
    
    const accessSnap = await db.collection('clientProjectAccess')
      .where('clientOrgId', '==', clientOrgId)
      .where('active', '==', true)
      .get();
    
    console.log(`Found ${accessSnap.size} active access records:\n`);

    // Step 3: For each access record, get the actual project details
    const projectDetails = [];
    
    for (const accessDoc of accessSnap.docs) {
      const accessData = accessDoc.data();
      const projectId = accessData.projectId;
      
      // Get project details
      const projectDoc = await db.collection('projects').doc(projectId).get();
      
      if (projectDoc.exists) {
        const projectData = projectDoc.data();
        projectDetails.push({
          accessId: accessDoc.id,
          projectId: projectId,
          projectCode: projectData.projectCode,
          projectName: projectData.name,
          projectStatus: projectData.status,
          location: projectData.location,
          contractorCompanyId: accessData.contractorCompanyId,
          grantedBy: accessData.grantedBy,
          grantedAt: accessData.grantedAt?.toDate(),
        });
      } else {
        projectDetails.push({
          accessId: accessDoc.id,
          projectId: projectId,
          projectCode: 'N/A',
          projectName: '⚠️ PROJECT NOT FOUND',
          projectStatus: 'DELETED',
          location: 'N/A',
          contractorCompanyId: accessData.contractorCompanyId,
          grantedBy: accessData.grantedBy,
          grantedAt: accessData.grantedAt?.toDate(),
        });
      }
    }

    // Sort by project name
    projectDetails.sort((a, b) => a.projectName.localeCompare(b.projectName));

    // Display results
    console.log('PROJECT ACCESS DETAILS:');
    console.log('=' .repeat(80));
    
    projectDetails.forEach((project, index) => {
      console.log(`\n${index + 1}. ${project.projectName}`);
      console.log(`   Code: ${project.projectCode}`);
      console.log(`   Status: ${project.projectStatus}`);
      console.log(`   Location: ${project.location}`);
      console.log(`   Project ID: ${project.projectId}`);
      console.log(`   Access ID: ${project.accessId}`);
      console.log(`   Granted: ${project.grantedAt}`);
      
      // Flag issues
      if (project.projectStatus === 'CANCELLED') {
        console.log(`   ⚠️  WARNING: Project is CANCELLED but still has active access!`);
      }
      if (project.projectStatus === 'DELETED') {
        console.log(`   ❌ ERROR: Project doesn't exist but access record remains!`);
      }
    });

    // Step 4: Specifically check for "Pashe Jobs February 2026"
    console.log('\n\n📋 Step 4: Checking specifically for "Pashe Jobs February 2026"...\n');
    
    const pasheProjects = await db.collection('projects')
      .where('name', '==', 'Pashe Jobs February 2026')
      .get();
    
    if (!pasheProjects.empty) {
      pasheProjects.forEach(doc => {
        const data = doc.data();
        console.log(`Found project: ${data.name}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Code: ${data.projectCode}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Company ID: ${data.companyId}`);
        console.log(`   Client ID: ${data.clientId}`);
        
        // Check if access exists
        const expectedAccessId = `${clientOrgId}_${doc.id}`;
        console.log(`   Expected Access ID: ${expectedAccessId}`);
        
        const hasAccess = projectDetails.some(p => p.projectId === doc.id);
        console.log(`   Has Active Access: ${hasAccess ? '✅ YES' : '❌ NO'}`);
      });
    } else {
      console.log('❌ No project found with name "Pashe Jobs February 2026"');
    }

    // Step 5: Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`Total active access records: ${projectDetails.length}`);
    console.log(`Active projects: ${projectDetails.filter(p => p.projectStatus === 'ACTIVE').length}`);
    console.log(`Completed projects: ${projectDetails.filter(p => p.projectStatus === 'COMPLETED').length}`);
    console.log(`Cancelled projects with access: ${projectDetails.filter(p => p.projectStatus === 'CANCELLED').length}`);
    console.log(`Deleted projects with access: ${projectDetails.filter(p => p.projectStatus === 'DELETED').length}`);

    // Issues found
    const cancelledWithAccess = projectDetails.filter(p => p.projectStatus === 'CANCELLED');
    const deletedWithAccess = projectDetails.filter(p => p.projectStatus === 'DELETED');
    
    if (cancelledWithAccess.length > 0 || deletedWithAccess.length > 0) {
      console.log('\n\n⚠️  ISSUES FOUND:');
      console.log('=' .repeat(80));
      
      if (cancelledWithAccess.length > 0) {
        console.log(`\n${cancelledWithAccess.length} CANCELLED project(s) still have active access:`);
        cancelledWithAccess.forEach(p => {
          console.log(`   - ${p.projectName} (${p.projectCode})`);
          console.log(`     Access ID: ${p.accessId}`);
        });
      }
      
      if (deletedWithAccess.length > 0) {
        console.log(`\n${deletedWithAccess.length} DELETED project(s) still have active access:`);
        deletedWithAccess.forEach(p => {
          console.log(`   - ${p.projectName}`);
          console.log(`     Access ID: ${p.accessId}`);
        });
      }
    } else {
      console.log('\n✅ No issues found - all access records point to valid active/completed projects');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

diagnose()
  .then(() => {
    console.log('\n✅ Diagnosis complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
