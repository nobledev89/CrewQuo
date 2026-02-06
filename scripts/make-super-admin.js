/**
 * Script to grant super admin privileges to a user
 * Usage: node scripts/make-super-admin.js <command> <email>
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

async function makeSuperAdmin(email) {
  try {
    console.log(`\n🔐 Granting super admin privileges to: ${email}\n`);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}`);

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      isSuperAdmin: true,
      role: 'SUPER_ADMIN',
      ownCompanyId: userRecord.uid, // Super admins don't need a real company
      activeCompanyId: userRecord.uid
    });
    console.log(`✅ Custom claims set`);

    // Update user document in Firestore
    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      await userRef.update({
        role: 'SUPER_ADMIN',
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log(`✅ User document updated in Firestore`);
    } else {
      console.log(`⚠️  User document not found in Firestore`);
    }

    // Verify the claims
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    const claims = updatedUser.customClaims;
    
    console.log(`\n✅ Super admin privileges granted successfully!`);
    console.log(`\nCustom Claims:`);
    console.log(JSON.stringify(claims, null, 2));
    console.log(`\n⚠️  User must log out and log back in for changes to take effect.\n`);

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
}

async function revokeSuperAdmin(email) {
  try {
    console.log(`\n🔓 Revoking super admin privileges from: ${email}\n`);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}`);

    // Get user's original company info
    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User document not found in Firestore');
    }

    const userData = userDoc.data();
    const originalRole = userData?.role === 'SUPER_ADMIN' ? 'ADMIN' : userData?.role;
    const ownCompanyId = userData?.ownCompanyId;
    const activeCompanyId = userData?.activeCompanyId;

    // Remove super admin claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      isSuperAdmin: false,
      role: originalRole,
      ownCompanyId: ownCompanyId,
      activeCompanyId: activeCompanyId
    });
    console.log(`✅ Custom claims updated`);

    // Update user document
    await userRef.update({
      role: originalRole,
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log(`✅ User document updated`);

    console.log(`\n✅ Super admin privileges revoked successfully!`);
    console.log(`⚠️  User must log out and log back in for changes to take effect.\n`);

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const email = args[1];

if (!command || !email) {
  console.log(`
Usage:
  Grant super admin:  node scripts/make-super-admin.js grant <email>
  Revoke super admin: node scripts/make-super-admin.js revoke <email>

Examples:
  node scripts/make-super-admin.js grant admin@example.com
  node scripts/make-super-admin.js revoke admin@example.com
  `);
  process.exit(1);
}

if (command === 'grant') {
  makeSuperAdmin(email).then(() => process.exit(0));
} else if (command === 'revoke') {
  revokeSuperAdmin(email).then(() => process.exit(0));
} else {
  console.error(`❌ Invalid command: ${command}. Use 'grant' or 'revoke'`);
  process.exit(1);
}
