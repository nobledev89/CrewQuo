import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-crewquo',
  });
}

async function setClaims() {
  const email = process.argv[2];
  const role = process.argv[3] as 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';
  const companyId = process.argv[4] || 'corporate-spec';

  if (!email || !role) {
    console.error('Usage: npm run set-claims <email> <role> [companyId]');
    console.error('Roles: ADMIN, MANAGER, SUBCONTRACTOR');
    process.exit(1);
  }

  if (!['ADMIN', 'MANAGER', 'SUBCONTRACTOR'].includes(role)) {
    console.error('Invalid role. Must be: ADMIN, MANAGER, or SUBCONTRACTOR');
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    
    await admin.auth().setCustomUserClaims(user.uid, {
      companyId,
      role,
    });

    console.log(`✅ Successfully set claims for ${email}:`);
    console.log(`   - companyId: ${companyId}`);
    console.log(`   - role: ${role}`);
    console.log(`   - uid: ${user.uid}`);
    console.log('');
    console.log('⚠️  User needs to sign out and sign in again for claims to take effect.');

  } catch (error: any) {
    console.error('❌ Error setting claims:', error.message);
    process.exit(1);
  }
}

setClaims()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
