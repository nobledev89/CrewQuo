import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {getUserClaims, refreshUserClaims, buildUserClaims, setCustomUserClaims} from './auth';
import {RateResolver, PriceCalculator, ShiftType} from './rates';
import {
  CreateTimeLogSchema,
  ProjectSummarySchema,
} from './validators';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * Automatically set custom claims when a new user document is created
 * This ensures users have the proper claims for Firestore security rules
 */
export const onUserCreated = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const userData = snap.data();
    
    try {
      const claims = buildUserClaims(userData, userId);
      await setCustomUserClaims(userId, claims);
      
      console.log(`Custom claims set for new user: ${userId}`, claims);
    } catch (error) {
      console.error(`Error setting claims for user ${userId}:`, error);
      throw error;
    }
  });

/**
 * Complete user signup - creates company and user documents with proper setup
 * This bypasses security rules by using Admin SDK
 */
export const completeSignup = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  const allowedOrigins = ['https://www.crewquo.com', 'https://crewquo.com', 'http://localhost:3000'];
  const origin = req.headers.origin || '';
  
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify Firebase authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { companyName, firstName, lastName, email } = req.body.data || req.body;

    if (!companyName || !firstName || !lastName || !email) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Create company document
    const companyRef = db.collection('companies').doc(userId);
    await companyRef.set({
      name: companyName,
      ownerId: userId,
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trial',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create user document
    const userRef = db.collection('users').doc(userId);
    await userRef.set({
      email,
      firstName,
      lastName,
      companyId: userId,
      ownCompanyId: userId,
      activeCompanyId: userId,
      role: 'ADMIN',
      subcontractorRoles: {},
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trial',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Set custom claims
    await setCustomUserClaims(userId, {
      companyId: userId,
      ownCompanyId: userId,
      activeCompanyId: userId,
      role: 'ADMIN',
    });

    console.log(`Signup completed for user: ${userId}`);

    res.status(200).json({ result: { success: true, userId } });
  } catch (error) {
    console.error('Error completing signup:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
});

/**
 * Create Time Log with rate resolution and optional inline expenses
 */
export const createTimeLog = functions.https.onCall(async (data, context) => {
  const request = { data, auth: context.auth };
  const claims = getUserClaims(request);
  const input = CreateTimeLogSchema.parse(data);

  // Verify project assignment exists
  const assignmentSnap = await db
    .collection('projectAssignments')
    .where('companyId', '==', claims.companyId)
    .where('projectId', '==', input.projectId)
    .where('subcontractorId', '==', input.subcontractorId)
    .limit(1)
    .get();

  if (assignmentSnap.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'Subcontractor not assigned to project');
  }

  // Get project to find clientId
  const projectDoc = await db.collection('projects').doc(input.projectId).get();
  if (!projectDoc.exists || projectDoc.data()?.companyId !== claims.companyId) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }
  const project = projectDoc.data()!;

  // Resolve rates
  const resolver = new RateResolver(db);
  const date = new Date(input.date);

  const subRate = await resolver.resolveRate(
    claims.companyId,
    'SUBCONTRACTOR',
    input.subcontractorId,
    input.roleId,
    input.shiftType as ShiftType,
    date
  );

  const clientRate = await resolver.resolveRate(
    claims.companyId,
    'CLIENT',
    project.clientId,
    input.roleId,
    input.shiftType as ShiftType,
    date
  );

  if (!subRate || !clientRate) {
    throw new functions.https.HttpsError('failed-precondition', 'Rate cards not found for this combination');
  }

  // Calculate pricing
  const pricing = PriceCalculator.calculate(
    subRate,
    clientRate,
    input.shiftType as ShiftType,
    input.hoursRegular,
    input.hoursOT
  );

  // Create time log
  const timeLogData = {
    companyId: claims.companyId,
    projectId: input.projectId,
    subcontractorId: input.subcontractorId,
    roleId: input.roleId,
    date: Timestamp.fromDate(date),
    shiftType: input.shiftType,
    hoursRegular: input.hoursRegular,
    hoursOT: input.hoursOT,
    notes: input.notes || '',
    ...pricing,
    status: 'DRAFT',
    createdByUserId: context.auth!.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const timeLogRef = await db.collection('timeLogs').add(timeLogData);

  // Create inline expenses if provided
  const expenseIds: string[] = [];
  if (input.expenses && input.expenses.length > 0) {
    for (const exp of input.expenses) {
      const expenseData = {
        companyId: claims.companyId,
        projectId: input.projectId,
        timeLogId: timeLogRef.id,
        date: Timestamp.fromDate(new Date(exp.date)),
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        currency: pricing.currency,
        status: 'DRAFT',
        createdByUserId: context.auth!.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const expenseRef = await db.collection('expenses').add(expenseData);
      expenseIds.push(expenseRef.id);
    }
  }

  return {
    timeLogId: timeLogRef.id,
    expenseIds,
    pricing,
  };
});

/**
 * Get Project Summary - aggregates time logs and expenses
 */
export const getProjectSummary = functions.https.onCall(async (data, context) => {
  const request = { data, auth: context.auth };
  const claims = getUserClaims(request);
  const input = ProjectSummarySchema.parse(data);

  // Verify project access
  const projectDoc = await db.collection('projects').doc(input.projectId).get();
  if (!projectDoc.exists || projectDoc.data()?.companyId !== claims.companyId) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }

  // Query time logs
  let timeLogsQuery = db
    .collection('timeLogs')
    .where('companyId', '==', claims.companyId)
    .where('projectId', '==', input.projectId);

  if (!input.includeSubmitted) {
    timeLogsQuery = timeLogsQuery.where('status', '==', 'APPROVED');
  } else {
    timeLogsQuery = timeLogsQuery.where('status', 'in', ['SUBMITTED', 'APPROVED']);
  }

  const timeLogsSnap = await timeLogsQuery.get();

  let totalSubCost = 0;
  let totalClientBill = 0;

  timeLogsSnap.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    const log = doc.data();
    totalSubCost += log.subCost || 0;
    totalClientBill += log.clientBill || 0;
  });

  // Query expenses
  let expensesQuery = db
    .collection('expenses')
    .where('companyId', '==', claims.companyId)
    .where('projectId', '==', input.projectId);

  if (!input.includeSubmitted) {
    expensesQuery = expensesQuery.where('status', '==', 'APPROVED');
  } else {
    expensesQuery = expensesQuery.where('status', 'in', ['SUBMITTED', 'APPROVED']);
  }

  const expensesSnap = await expensesQuery.get();

  let totalExpenses = 0;

  expensesSnap.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    const exp = doc.data();
    totalExpenses += exp.amount || 0;
  });

  const totalCost = totalSubCost + totalExpenses;
  const marginValue = totalClientBill - totalCost;
  const marginPct = totalClientBill > 0 ? (marginValue / totalClientBill) * 100 : 0;

  return {
    projectId: input.projectId,
    totalSubCost: Math.round(totalSubCost * 100) / 100,
    totalClientBill: Math.round(totalClientBill * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    marginValue: Math.round(marginValue * 100) / 100,
    marginPct: Math.round(marginPct * 100) / 100,
    timeLogCount: timeLogsSnap.size,
    expenseCount: expensesSnap.size,
  };
});

/**
 * Switch Company Context
 * Allows users to switch between their own company and companies where they work as subcontractors
 */
export const switchCompanyContext = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { targetCompanyId } = data;

  if (!targetCompanyId || typeof targetCompanyId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetCompanyId is required');
  }

  const userId = context.auth.uid;

  // Get user document
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User document not found');
  }

  const userData = userDoc.data()!;

  // Verify user has access to target company
  const hasAccess = 
    userData.ownCompanyId === targetCompanyId || 
    (userData.subcontractorRoles && userData.subcontractorRoles[targetCompanyId]);

  if (!hasAccess) {
    throw new functions.https.HttpsError(
      'permission-denied', 
      'User does not have access to this company'
    );
  }

  // Update activeCompanyId in user document
  await db.collection('users').doc(userId).update({
    activeCompanyId: targetCompanyId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Refresh custom claims
  await refreshUserClaims(userId);

  // Get company name for response
  const companyDoc = await db.collection('companies').doc(targetCompanyId).get();
  const companyName = companyDoc.exists ? companyDoc.data()?.name : 'Unknown';

  return {
    success: true,
    activeCompanyId: targetCompanyId,
    companyName,
  };
});

/**
 * Refresh User Claims
 * Manually trigger a refresh of user custom claims from Firestore
 */
export const refreshClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    await refreshUserClaims(userId);
    return { success: true };
  } catch (error) {
    console.error('Error refreshing claims:', error);
    throw new functions.https.HttpsError('internal', 'Failed to refresh claims');
  }
});

/**
 * Gumroad Webhook Handler
 * Handles purchase and subscription events from Gumroad
 */
export const gumroadWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Gumroad sends data as URL-encoded form data
    const data = req.body;
    
    console.log('Received Gumroad webhook:', data);

    // Extract user_id from multiple possible sources
    // 1. Custom fields (if configured in Gumroad)
    // 2. Direct field (from query parameter)
    // 3. Referrer field (fallback)
    const userId = data.custom_fields?.user_id || data.user_id || data.referrer;

    if (!userId) {
      console.error('No user_id in webhook data', { 
        custom_fields: data.custom_fields,
        user_id: data.user_id,
        referrer: data.referrer 
      });
      res.status(400).json({ error: 'No user_id provided' });
      return;
    }

    // Gumroad webhook events are identified by different fields
    // sale: When a purchase is made
    // refund: When a refund is issued
    // dispute: When a dispute is filed
    // dispute_won: When a dispute is won
    // cancellation: When a subscription is cancelled
    // subscription_updated: When subscription is updated
    // subscription_ended: When subscription ends
    // subscription_restarted: When subscription restarts

    const saleId = data.sale_id;
    const sellerId = data.seller_id;
    const isSubscription = data.subscription_id ? true : false;
    const subscriptionId = data.subscription_id;
    const cancelled = data.cancelled === 'true' || data.cancelled === true;
    const ended = data.ended === 'true' || data.ended === true;
    const isRefund = data.refunded === 'true' || data.refunded === true;

    // Verify this is from your Gumroad account (optional but recommended)
    const expectedSellerId = functions.config().gumroad?.seller_id || process.env.GUMROAD_SELLER_ID;
    if (expectedSellerId && sellerId !== expectedSellerId) {
      console.error('Invalid seller ID');
      res.status(401).json({ error: 'Invalid seller ID' });
      return;
    }

    // Handle different scenarios
    if (isRefund) {
      await handleGumroadRefund(data, userId);
    } else if (cancelled) {
      await handleGumroadCancellation(data, userId);
    } else if (ended) {
      await handleGumroadSubscriptionEnded(data, userId);
    } else if (isSubscription && subscriptionId) {
      await handleGumroadSubscription(data, userId);
    } else if (saleId) {
      await handleGumroadPurchase(data, userId);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Gumroad webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Gumroad webhook event handlers
async function handleGumroadPurchase(data: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'active',
    gumroadSaleId: data.sale_id,
    gumroadPurchaserEmail: data.email,
    gumroadProductPermalink: data.product_permalink,
    lastPaymentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Determine subscription plan from tier
  const subscriptionPlan = determineSubscriptionPlan(data);
  
  // Also update user document
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
    subscriptionPlan: subscriptionPlan,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Gumroad purchase completed for user ${userId}, plan: ${subscriptionPlan}`);
}

async function handleGumroadSubscription(data: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  // Determine subscription plan from tier
  const subscriptionPlan = determineSubscriptionPlan(data);
  
  await companyRef.update({
    subscriptionStatus: 'active',
    subscriptionPlan: subscriptionPlan,
    gumroadSubscriptionId: data.subscription_id,
    gumroadSaleId: data.sale_id,
    gumroadPurchaserEmail: data.email,
    gumroadProductPermalink: data.product_permalink,
    gumroadTierName: data.variant_name || data.tier_name || '',
    lastPaymentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Also update user document
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
    subscriptionPlan: subscriptionPlan,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Gumroad subscription active for user ${userId}`);
}

async function handleGumroadCancellation(data: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'cancelled',
    subscriptionCancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Also update user document
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'cancelled',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Gumroad subscription cancelled for user ${userId}`);
}

async function handleGumroadSubscriptionEnded(data: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'expired',
    subscriptionExpiredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Also update user document
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'expired',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Gumroad subscription ended for user ${userId}`);
}

async function handleGumroadRefund(data: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'refunded',
    refundedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Also update user document
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'refunded',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Gumroad refund processed for user ${userId}`);
}

// Helper function to determine subscription plan from Gumroad tier/variant name
function determineSubscriptionPlan(data: any): string {
  // Gumroad sends tier/variant information in different fields depending on product type
  const variantName = data.variant_name || data.variants || '';
  const tierName = data.tier_name || data.offer_code || '';
  const productName = data.product_name || '';
  
  // Combine all possible fields to find the tier
  const searchString = `${variantName} ${tierName} ${productName}`.toLowerCase();
  
  console.log('Determining plan from:', { variantName, tierName, productName, searchString });
  
  // Match against tier names
  if (searchString.includes('personal')) {
    return 'starter';
  } else if (searchString.includes('business starter')) {
    return 'professional';
  } else if (searchString.includes('business pro')) {
    return 'enterprise';
  }
  
  // Fallback: try to determine from price if tier name not found
  const price = parseInt(data.price) || 0;
  if (price >= 30000) { // £349 = 34900 pence
    return 'enterprise';
  } else if (price >= 15000) { // £199 = 19900 pence
    return 'professional';
  } else if (price >= 5000) { // £99 = 9900 pence
    return 'starter';
  }
  
  console.warn('Could not determine plan from data, defaulting to starter');
  return 'starter'; // Default fallback
}
