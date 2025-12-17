import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-crewquo',
  });
}

// Connect to emulator if environment variable is set
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`🔥 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log(`🔥 Using Auth Emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
}

async function createAdminUser() {
  console.log('👤 Creating admin user...');

  const email = 'admin@corporatespec.com';
  const password = 'Password12345';
  const companyId = 'corporate-spec';

  try {
    // Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      console.log(`⚠️  User ${email} already exists with UID: ${existingUser.uid}`);
      console.log('Setting custom claims...');
      
      await admin.auth().setCustomUserClaims(existingUser.uid, {
        companyId,
        role: 'ADMIN',
      });

      console.log('✅ Custom claims set successfully!');
      console.log('');
      console.log('📊 User Details:');
      console.log(`  - Email: ${email}`);
      console.log(`  - Password: ${password}`);
      console.log(`  - UID: ${existingUser.uid}`);
      console.log(`  - Company ID: ${companyId}`);
      console.log(`  - Role: ADMIN`);
      return;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      displayName: 'Corporate Spec Admin',
    });

    console.log(`✅ Created user: ${email} with UID: ${userRecord.uid}`);

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      companyId,
      role: 'ADMIN',
    });

    console.log('✅ Custom claims set successfully!');

    // Create user document in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      companyId,
      email,
      name: 'Corporate Spec Admin',
      role: 'ADMIN',
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log('✅ User document created in Firestore');
    console.log('');
    console.log('🎉 Admin user created successfully!');
    console.log('');
    console.log('📊 Login Credentials:');
    console.log(`  - Email: ${email}`);
    console.log(`  - Password: ${password}`);
    console.log(`  - UID: ${userRecord.uid}`);
    console.log(`  - Company ID: ${companyId}`);
    console.log(`  - Role: ADMIN`);
    console.log('');
    console.log('✨ You can now login with these credentials!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
