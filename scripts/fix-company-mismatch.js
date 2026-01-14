require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try multiple initialization methods
let initialized = false;

// Method 1: Try service account key file
try {
  const serviceAccountPath = path.join(__dirname, '..', 'service-account-key.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Initialized with service-account-key.json');
    initialized = true;
  }
} catch (e) {
  console.log('⚠️  Could not init with service-account-key.json:', e.message);
}

// Method 2: Try application default credentials
if (!initialized) {
  try {
    admin.initializeApp();
    console.log('✅ Initialized with application default credentials');
    initialized = true;
  } catch (e) {
    console.log('⚠️  Could not init with default credentials:', e.message);
  }
}

if (!initialized) {
  console.error('\n❌ ERROR: Could not initialize Firebase Admin!');
  console.error('Please ensure one of the following:');
  console.error('1. service-account-key.json exists in project root');
  console.error('2. GOOGLE_APPLICATION_CREDENTIALS environment variable is set');
  console.error('3. Running in a Firebase/GCP environment');
  process.exit(1);
}

const userId = 'MWNFsacjB9YdeF3pNkLe4iP9WD3'; // hanmorelltd@gmail.com
const projectId = 'hGG4rcX7Me2TzcOIUHci';

async function fixCompanyMismatch() {
  console.log('='.repeat(70));
  console.log('FIXING COMPANY ID MISMATCH');
  console.log('='.repeat(70));
  
  const db = admin.firestore();
  const auth = admin.auth();
  
  try {
    // Get user document
    console.log('\n1️⃣ Fetching user document...');
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    console.log('   User activeCompanyId:', userData?.activeCompanyId);
    console.log('   User subcontractorRoles:', JSON.stringify(userData?.subcontractorRoles, null, 2));
    
    // Get project document
    console.log('\n2️⃣ Fetching project document...');
    const projectDoc = await db.collection('projects').doc(projectId).get();
    const projectData = projectDoc.data();
    
    console.log('   Project companyId:', projectData?.companyId);
    console.log('   Project name:', projectData?.name);
    
    // Check both company IDs
    const userCompanyId = userData?.activeCompanyId;
    const projectCompanyId = projectData?.companyId;
    
    console.log('\n3️⃣ Checking which company ID is valid...');
    
    // Check if user's company exists
    let userCompanyExists = false;
    try {
      const userCompanyDoc = await db.collection('companies').doc(userCompanyId).get();
      userCompanyExists = userCompanyDoc.exists();
      console.log(`   User company (${userCompanyId}): ${userCompanyExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
      if (userCompanyExists) {
        console.log('     Company name:', userCompanyDoc.data()?.name);
      }
    } catch (e) {
      console.log(`   User company: ❌ ERROR checking - ${e.message}`);
    }
    
    // Check if project's company exists
    let projectCompanyExists = false;
    try {
      const projectCompanyDoc = await db.collection('companies').doc(projectCompanyId).get();
      projectCompanyExists = projectCompanyDoc.exists();
      console.log(`   Project company (${projectCompanyId}): ${projectCompanyExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
      if (projectCompanyExists) {
        console.log('     Company name:', projectCompanyDoc.data()?.name);
      }
    } catch (e) {
      console.log(`   Project company: ❌ ERROR checking - ${e.message}`);
    }
    
    // Determine the correct company ID
    let correctCompanyId;
    if (projectCompanyExists && !userCompanyExists) {
      correctCompanyId = projectCompanyId;
      console.log('\n✅ Project company ID is correct. Will update user assignment.');
    } else if (userCompanyExists && !projectCompanyExists) {
      correctCompanyId = userCompanyId;
      console.log('\n✅ User company ID is correct. Will update project.');
    } else if (projectCompanyExists && userCompanyExists) {
      correctCompanyId = projectCompanyId; // Prioritize project's company
      console.log('\n⚠️  Both companies exist! Will align user to project company:', correctCompanyId);
    } else {
      console.log('\n❌ ERROR: Neither company exists! Cannot determine correct ID.');
      process.exit(1);
    }
    
    // FIX: Update user's subcontractorRoles to include the correct company
    console.log('\n4️⃣ Updating user assignment...');
    
    const currentSubRoles = userData?.subcontractorRoles || {};
    const subRoleForCorrectCompany = currentSubRoles[correctCompanyId];
    
    if (!subRoleForCorrectCompany) {
      // Need to find the subcontractor info - check if they have a role in another company
      const existingRoleKeys = Object.keys(currentSubRoles);
      if (existingRoleKeys.length > 0) {
        const existingRole = currentSubRoles[existingRoleKeys[0]];
        
        console.log(`   Adding subcontractor role for company: ${correctCompanyId}`);
        console.log(`   Using subcontractor ID: ${existingRole.subcontractorId}`);
        
        // Add the new company to subcontractorRoles
        currentSubRoles[correctCompanyId] = {
          subcontractorId: existingRole.subcontractorId,
          role: existingRole.role || 'SUBCONTRACTOR',
          companyName: projectCompanyExists ? (await db.collection('companies').doc(correctCompanyId).get()).data()?.name : 'Unknown'
        };
        
        // Update Firestore
        await db.collection('users').doc(userId).update({
          subcontractorRoles: currentSubRoles,
          activeCompanyId: correctCompanyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('   ✅ User document updated in Firestore');
        
        // Update Auth custom claims
        console.log('\n5️⃣ Updating Firebase Auth custom claims...');
        await auth.setCustomUserClaims(userId, {
          companyId: userData?.companyId,
          ownCompanyId: userData?.ownCompanyId,
          activeCompanyId: correctCompanyId,
          role: userData?.role,
          subcontractorRoles: currentSubRoles
        });
        
        console.log('   ✅ Auth custom claims updated');
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ FIX COMPLETED!');
        console.log('='.repeat(70));
        console.log('\nThe user should now:');
        console.log('1. Sign out completely');
        console.log('2. Sign back in');
        console.log('3. Try accessing the project again');
        console.log('\nOr click the "Refresh Permissions" button on the error page.');
        
      } else {
        console.log('   ❌ ERROR: No existing subcontractor roles found to copy from');
      }
    } else {
      console.log('   ℹ️  User already has subcontractor role for correct company');
      
      // Just update activeCompanyId if needed
      if (userData?.activeCompanyId !== correctCompanyId) {
        await db.collection('users').doc(userId).update({
          activeCompanyId: correctCompanyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await auth.setCustomUserClaims(userId, {
          companyId: userData?.companyId,
          ownCompanyId: userData?.ownCompanyId,
          activeCompanyId: correctCompanyId,
          role: userData?.role,
          subcontractorRoles: currentSubRoles
        });
        
        console.log('   ✅ Updated activeCompanyId to:', correctCompanyId);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  }
  
  process.exit(0);
}

fixCompanyMismatch();
