/**
 * Fix script to correct company ID mismatches in projects
 * Run with: npx ts-node scripts/fix-company-mismatch.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  console.error('Please download it from Firebase Console and place it in the project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function fixCompanyMismatch() {
  console.log('🔧 Company ID Mismatch Fix Script\n');
  console.log('This script will update projects to match their owner\'s company ID.\n');

  try {
    // Step 1: Identify the issue
    console.log('📋 Step 1: Identifying mismatched projects...\n');
    
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['ADMIN', 'MANAGER'])
      .get();

    let totalMismatches = 0;
    const fixes: Array<{ projectId: string; projectName: string; oldCompanyId: string; newCompanyId: string }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userCompanyId = userData.activeCompanyId || userData.companyId;
      
      if (!userCompanyId) continue;

      const clientsSnapshot = await db.collection('clients')
        .where('companyId', '==', userCompanyId)
        .get();

      for (const clientDoc of clientsSnapshot.docs) {
        const clientId = clientDoc.id;
        const clientData = clientDoc.data();
        
        const projectsSnapshot = await db.collection('projects')
          .where('clientId', '==', clientId)
          .get();

        projectsSnapshot.docs.forEach(projectDoc => {
          const projectData = projectDoc.data();
          if (projectData.companyId !== userCompanyId) {
            totalMismatches++;
            fixes.push({
              projectId: projectDoc.id,
              projectName: projectData.name || projectData.projectCode,
              oldCompanyId: projectData.companyId,
              newCompanyId: userCompanyId,
            });
            
            console.log(`Found mismatch: ${projectData.name || projectData.projectCode}`);
            console.log(`  Client: ${clientData.name}`);
            console.log(`  Current companyId: ${projectData.companyId}`);
            console.log(`  Should be: ${userCompanyId}\n`);
          }
        });
      }
    }

    if (totalMismatches === 0) {
      console.log('✅ No mismatches found! All projects have correct company IDs.');
      rl.close();
      return;
    }

    console.log(`\n📊 Found ${totalMismatches} mismatched projects\n`);

    // Step 2: Ask for confirmation
    const answer = await question(`Do you want to fix these ${totalMismatches} projects? (yes/no): `);
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Fix cancelled by user.');
      rl.close();
      return;
    }

    // Step 3: Apply fixes
    console.log('\n🔧 Applying fixes...\n');
    
    const batch = db.batch();
    let batchCount = 0;
    const batchLimit = 500; // Firestore batch limit
    
    for (const fix of fixes) {
      const projectRef = db.collection('projects').doc(fix.projectId);
      batch.update(projectRef, {
        companyId: fix.newCompanyId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      batchCount++;
      
      // Commit batch if we hit the limit
      if (batchCount >= batchLimit) {
        await batch.commit();
        console.log(`✅ Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
      
      console.log(`✅ Updated: ${fix.projectName} (${fix.projectId})`);
    }
    
    // Commit remaining items
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }

    console.log(`\n✅ Successfully fixed ${totalMismatches} projects!`);
    console.log('\n📋 Summary:');
    fixes.forEach(fix => {
      console.log(`   - ${fix.projectName}: ${fix.oldCompanyId} → ${fix.newCompanyId}`);
    });

  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  } finally {
    rl.close();
  }
}

// Run the fix
fixCompanyMismatch()
  .then(() => {
    console.log('\n✅ Fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
