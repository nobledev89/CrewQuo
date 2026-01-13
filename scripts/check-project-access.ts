import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin using the service account file
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'firebase-service-account.json'), 'utf8')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized\n');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const auth = admin.auth();
const db = admin.firestore();

async function checkProjectAccess(userEmail: string, projectId: string) {
  try {
    console.log(`=== Checking Project Access ===\n`);
    console.log(`User: ${userEmail}`);
    console.log(`Project ID: ${projectId}\n`);
    
    // Get user
    const user = await auth.getUserByEmail(userEmail);
    const userRecord = await auth.getUser(user.uid);
    const claims = userRecord.customClaims || {};
    
    console.log('--- User Custom Claims ---');
    console.log(`ownCompanyId: ${claims.ownCompanyId || 'NOT SET'}`);
    console.log(`activeCompanyId: ${claims.activeCompanyId || 'NOT SET'}`);
    console.log(`subcontractorRoles:`, JSON.stringify(claims.subcontractorRoles || {}, null, 2));
    
    // Get project
    console.log('\n--- Project Details ---');
    const projectDoc = await db.collection('projects').doc(projectId).get();
    
    if (!projectDoc.exists) {
      console.log('❌ PROJECT NOT FOUND!');
      console.log('\nLet me list all projects instead...\n');
      
      const allProjects = await db.collection('projects').limit(20).get();
      console.log(`Found ${allProjects.size} projects:\n`);
      allProjects.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Company ID: ${data.companyId}`);
        console.log(`  Client ID: ${data.clientId || 'None'}`);
        console.log('');
      });
      return;
    }
    
    const projectData = projectDoc.data();
    console.log(`Project Name: ${projectData?.name || 'Unnamed'}`);
    console.log(`Company ID: ${projectData?.companyId || 'NOT SET'}`);
    console.log(`Client ID: ${projectData?.clientId || 'NOT SET'}`);
    console.log(`Status: ${projectData?.status || 'N/A'}`);
    
    // Check access rules
    console.log('\n--- Access Check ---');
    
    const projectCompanyId = projectData?.companyId;
    const userOwnCompanyId = claims.ownCompanyId;
    const subcontractorRoles = claims.subcontractorRoles || {};
    
    const ownsProject = projectCompanyId === userOwnCompanyId;
    const hasSubcontractorAccess = projectCompanyId in subcontractorRoles;
    
    console.log(`Does user own the project company? ${ownsProject ? '✅ YES' : '❌ NO'}`);
    console.log(`Does user have subcontractor access? ${hasSubcontractorAccess ? '✅ YES' : '❌ NO'}`);
    
    if (ownsProject || hasSubcontractorAccess) {
      console.log('\n✅ USER SHOULD HAVE ACCESS to this project!');
      
      // Check for project assignment
      console.log('\n--- Project Assignments ---');
      const subId = hasSubcontractorAccess ? subcontractorRoles[projectCompanyId].subcontractorId : null;
      
      if (subId) {
        const assignmentQuery = await db.collection('projectAssignments')
          .where('projectId', '==', projectId)
          .where('subcontractorId', '==', subId)
          .get();
        
        if (assignmentQuery.empty) {
          console.log('⚠️  WARNING: No projectAssignment record found!');
          console.log(`   Subcontractor ${subId} is not assigned to this project.`);
          console.log('   This may cause issues viewing project details.');
        } else {
          console.log('✅ Project assignment exists');
          assignmentQuery.forEach(doc => {
            console.log(`   Assignment ID: ${doc.id}`);
          });
        }
      }
      
      // Check for rate assignments
      console.log('\n--- Rate Assignments ---');
      const rateQuery = await db.collection('subcontractorRateAssignments')
        .where('subcontractorId', '==', subId)
        .where('clientId', '==', projectData.clientId)
        .get();
      
      if (rateQuery.empty) {
        console.log('⚠️  WARNING: No rate assignment found!');
        console.log('   User may not be able to log time without a rate card.');
      } else {
        console.log('✅ Rate assignment exists');
        rateQuery.forEach(doc => {
          const data = doc.data();
          console.log(`   Pay Rate Card: ${data.payRateCardId || data.rateCardId}`);
          console.log(`   Bill Rate Card: ${data.billRateCardId || 'None'}`);
        });
      }
      
    } else {
      console.log('\n❌ USER DOES NOT HAVE ACCESS to this project!');
      console.log('\nPossible reasons:');
      console.log('1. The project belongs to a different company');
      console.log('2. The user is not set up as a subcontractor for that company');
      console.log('3. The custom claims need to be refreshed');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Get command line arguments
const userEmail = process.argv[2];
const projectId = process.argv[3];

if (!userEmail || !projectId) {
  console.log('Usage: npx tsx scripts/check-project-access.ts <email> <projectId>');
  console.log('Example: npx tsx scripts/check-project-access.ts user@example.com abc123');
  process.exit(1);
}

checkProjectAccess(userEmail, projectId).then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
});
