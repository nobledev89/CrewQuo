import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Check if we have service account credentials
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    // Check if GOOGLE_APPLICATION_CREDENTIALS is set (points to JSON key file)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Using GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else if (projectId && clientEmail && privateKey) {
      console.log('Using environment variable credentials');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      console.error('❌ Missing Firebase Admin credentials!');
      console.error('');
      console.error('Please set one of the following:');
      console.error('');
      console.error('Option 1: Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON file path');
      console.error('  Example: set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json');
      console.error('');
      console.error('Option 2: Add these to your .env.local file:');
      console.error('  FIREBASE_ADMIN_PROJECT_ID=your_project_id');
      console.error('  FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com');
      console.error('  FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
      console.error('');
      console.error('Current values:');
      console.error('  FIREBASE_ADMIN_PROJECT_ID:', projectId ? '✓ set' : '✗ missing');
      console.error('  FIREBASE_ADMIN_CLIENT_EMAIL:', clientEmail ? '✓ set' : '✗ missing');
      console.error('  FIREBASE_ADMIN_PRIVATE_KEY:', privateKey ? '✓ set' : '✗ missing');
      process.exit(1);
    }
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const auth = admin.auth();
const db = admin.firestore();

// Plan mapping
const PLAN_MAP: Record<string, string> = {
  'personal': 'starter',
  'starter': 'starter',
  'business-starter': 'professional',
  'professional': 'professional',
  'business-pro': 'enterprise',
  'enterprise': 'enterprise',
};

async function fixSubscription(email: string, plan: string) {
  try {
    console.log(`\n=== Fixing subscription for: ${email} ===\n`);
    
    // Normalize plan name
    const normalizedPlan = PLAN_MAP[plan.toLowerCase()] || plan;
    console.log(`Plan: ${plan} -> ${normalizedPlan}`);
    
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log('User UID:', user.uid);
    console.log('Email:', user.email);
    
    // Get current user document
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('\n--- Current User Subscription ---');
      console.log('subscriptionStatus:', userData?.subscriptionStatus);
      console.log('subscriptionPlan:', userData?.subscriptionPlan);
    }
    
    // Get current company document
    const companyDoc = await db.collection('companies').doc(user.uid).get();
    if (companyDoc.exists) {
      const companyData = companyDoc.data();
      console.log('\n--- Current Company Subscription ---');
      console.log('subscriptionStatus:', companyData?.subscriptionStatus);
      console.log('subscriptionPlan:', companyData?.subscriptionPlan);
      console.log('trialEndsAt:', companyData?.trialEndsAt?.toDate?.() || companyData?.trialEndsAt);
    }
    
    // Update user document
    console.log('\n--- Updating User Document ---');
    await db.collection('users').doc(user.uid).update({
      subscriptionStatus: 'active',
      subscriptionPlan: normalizedPlan,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ User document updated');
    
    // Update company document
    console.log('\n--- Updating Company Document ---');
    await db.collection('companies').doc(user.uid).update({
      subscriptionStatus: 'active',
      subscriptionPlan: normalizedPlan,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Company document updated');
    
    // Verify the updates
    console.log('\n--- Verifying Updates ---');
    const updatedUserDoc = await db.collection('users').doc(user.uid).get();
    const updatedCompanyDoc = await db.collection('companies').doc(user.uid).get();
    
    console.log('\nUser:');
    console.log('  subscriptionStatus:', updatedUserDoc.data()?.subscriptionStatus);
    console.log('  subscriptionPlan:', updatedUserDoc.data()?.subscriptionPlan);
    
    console.log('\nCompany:');
    console.log('  subscriptionStatus:', updatedCompanyDoc.data()?.subscriptionStatus);
    console.log('  subscriptionPlan:', updatedCompanyDoc.data()?.subscriptionPlan);
    
    console.log('\n✅ Subscription fixed successfully!');
    console.log('⚠️  Customer may need to refresh their browser or log out and back in to see the changes.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get arguments
const email = process.argv[2];
const plan = process.argv[3];

if (!email || !plan) {
  console.error('Usage: npx ts-node scripts/fix-subscription.ts <email> <plan>');
  console.error('');
  console.error('Plans:');
  console.error('  personal / starter      -> starter');
  console.error('  business-starter        -> professional');
  console.error('  business-pro / enterprise -> enterprise');
  console.error('');
  console.error('Example:');
  console.error('  npx ts-node scripts/fix-subscription.ts dan@corporatespec.com professional');
  process.exit(1);
}

fixSubscription(email, plan).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
