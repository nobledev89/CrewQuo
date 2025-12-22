import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {getUserClaims, refreshUserClaims, buildUserClaims, setCustomUserClaims} from './auth';
import {RateResolver, PriceCalculator, ShiftType} from './rates';
import {
  CreateTimeLogSchema,
  ProjectSummarySchema,
} from './validators';
import {
  sendSubcontractorInviteEmail,
  sendRegistrationConfirmationEmail,
  sendInviteAcceptedNotificationEmail,
} from './email';

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
      currency: 'GBP',
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

    // Send registration confirmation email (non-blocking)
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    sendRegistrationConfirmationEmail(email, firstName, companyName, trialEndsAt)
      .then((result) => {
        if (result.success) {
          console.log(`Registration email sent to ${email}`);
        } else {
          console.error(`Failed to send registration email: ${result.error}`);
        }
      })
      .catch((error) => {
        console.error('Error sending registration email:', error);
      });

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

  // Parse date once for use throughout
  const date = new Date(input.date);

  // CRITICAL FIX: Look up assigned rate cards from SubcontractorRateAssignment
  // instead of trying to resolve them by targetType and targetId
  const rateAssignmentSnap = await db
    .collection('subcontractorRateAssignments')
    .where('companyId', '==', claims.companyId)
    .where('subcontractorId', '==', input.subcontractorId)
    .where('clientId', '==', project.clientId)
    .limit(1)
    .get();

  if (rateAssignmentSnap.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No rate card assignment found for this subcontractor and client. Please assign rate cards first.'
    );
  }

  const rateAssignment = rateAssignmentSnap.docs[0].data();
  const payRateCardId = rateAssignment.payRateCardId || rateAssignment.rateCardId;
  const billRateCardId = rateAssignment.billRateCardId;

  if (!payRateCardId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Pay rate card not assigned for this subcontractor and client'
    );
  }

  // Load the actual rate card documents
  const payCardDoc = await db.collection('rateCards').doc(payRateCardId).get();
  const billCardDoc = billRateCardId
    ? await db.collection('rateCards').doc(billRateCardId).get()
    : payCardDoc; // Fallback to pay card if no bill card

  if (!payCardDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Pay rate card not found');
  }

  if (billRateCardId && !billCardDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bill rate card not found');
  }

  // Create resolved rates from the actual rate cards
  const payCardData = payCardDoc.data()!;
  const billCardData = billCardDoc.data()!;

  // Helper function to extract rate from a rate card based on its rateMode
  const extractBaseRate = (card: any): number => {
    const rateMode = card.rateMode || 'HOURLY';
    console.log(`[extractBaseRate] Card rateMode: ${rateMode}, Card data:`, {
      hourlyRate: card.hourlyRate,
      shiftRate: card.shiftRate,
      dailyRate: card.dailyRate,
      baseRate: card.baseRate,
      rate: card.rate,
    });
    
    // Extract based on rateMode
    switch (rateMode) {
      case 'SHIFT':
        return card.shiftRate || card.baseRate || card.rate || 0;
      case 'DAILY':
        return card.dailyRate || card.baseRate || card.rate || 0;
      case 'HOURLY':
      default:
        return card.hourlyRate || card.baseRate || card.rate || 0;
    }
  };

  const extractOTRate = (card: any, baseRate: number): number => {
    const rateMode = card.rateMode || 'HOURLY';
    
    // Only hourly rates have OT
    if (rateMode !== 'HOURLY') {
      return 0;
    }
    
    return card.otHourlyRate || card.otRate || baseRate * 1.5 || 0;
  };

  const payBaseRate = extractBaseRate(payCardData);
  const payOTRate = extractOTRate(payCardData, payBaseRate);
  
  const billBaseRate = extractBaseRate(billCardData);
  const billOTRate = extractOTRate(billCardData, billBaseRate);

  // Log for debugging
  console.log(`[createTimeLog] Pay Card ID: ${payRateCardId}, RateMode: ${payCardData.rateMode}, Base: ${payBaseRate}, OT: ${payOTRate}`);
  console.log(`[createTimeLog] Bill Card ID: ${billRateCardId || payRateCardId}, RateMode: ${billCardData.rateMode}, Base: ${billBaseRate}, OT: ${billOTRate}`);
  console.log(`[createTimeLog] Full pay card:`, JSON.stringify(payCardData, null, 2));
  console.log(`[createTimeLog] Full bill card:`, JSON.stringify(billCardData, null, 2));

  const subRate: any = {
    rateLabel: payCardData.rateLabel || 'Custom',
    baseRate: payBaseRate,
    otRate: payOTRate,
    currency: payCardData.currency || 'GBP',
    rateCardId: payRateCardId,
  };

  const clientRate: any = {
    rateLabel: billCardData.rateLabel || 'Custom',
    baseRate: billBaseRate,
    otRate: billOTRate,
    currency: billCardData.currency || 'GBP',
    rateCardId: billRateCardId || payRateCardId,
  };

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
    payRateCardId: subRate.rateCardId,
    billRateCardId: clientRate.rateCardId,
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

/**
 * Validate Subcontractor Invite Token
 * Callable function that validates an invite token without requiring authentication
 * This bypasses Firestore security rules by using Admin SDK
 */
export const validateInviteToken = functions.https.onCall(async (data, context) => {
  const { token } = data;

  if (!token || typeof token !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Token is required');
  }

  try {
    // Query for subcontractor with this invite token
    const subcontractorsSnap = await db
      .collection('subcontractors')
      .where('inviteToken', '==', token)
      .where('inviteStatus', '==', 'pending')
      .limit(1)
      .get();

    if (subcontractorsSnap.empty) {
      return {
        valid: false,
        error: 'This invite link is invalid or has already been used',
      };
    }

    const subcontractorDoc = subcontractorsSnap.docs[0];
    const subcontractor = subcontractorDoc.data();

    // Return the subcontractor data needed for signup
    return {
      valid: true,
      subcontractor: {
        id: subcontractorDoc.id,
        name: subcontractor.name,
        email: subcontractor.email,
        companyId: subcontractor.companyId,
      },
    };
  } catch (error: any) {
    console.error('Error validating invite token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to validate invite token');
  }
});

/**
 * Send Subcontractor Invite Email
 * Callable function to send invite email to a subcontractor
 */
export const sendSubcontractorInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { subcontractorId } = data;

  if (!subcontractorId) {
    throw new functions.https.HttpsError('invalid-argument', 'subcontractorId is required');
  }

  try {
    // Get subcontractor details
    const subcontractorDoc = await db.collection('subcontractors').doc(subcontractorId).get();
    
    if (!subcontractorDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Subcontractor not found');
    }

    const subcontractor = subcontractorDoc.data()!;

    // Verify user has access to this subcontractor's company
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.companyId !== subcontractor.companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    // Check if subcontractor already has invite pending or accepted
    if (!subcontractor.inviteToken || subcontractor.inviteStatus !== 'pending') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Subcontractor does not have a pending invite'
      );
    }

    // Get company details
    const companyDoc = await db.collection('companies').doc(subcontractor.companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data()!.name : 'Company';

    // Send the email
    const inviterName = `${userData.firstName} ${userData.lastName}`;
    const result = await sendSubcontractorInviteEmail(
      subcontractor.email,
      subcontractor.name,
      companyName,
      subcontractor.inviteToken,
      inviterName
    );

    if (!result.success) {
      throw new functions.https.HttpsError('internal', result.error || 'Failed to send email');
    }

    // Update subcontractor with email sent timestamp
    await db.collection('subcontractors').doc(subcontractorId).update({
      inviteSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Invite email sent successfully' };
  } catch (error: any) {
    console.error('Error sending invite email:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Failed to send invite email');
  }
});

/**
 * Firestore Trigger: Send email when subcontractor invite is created
 */
export const onSubcontractorInviteCreated = functions.firestore
  .document('subcontractors/{subcontractorId}')
  .onCreate(async (snap, context) => {
    const subcontractor = snap.data();
    
    // Only send email if invite status is pending and has token
    if (subcontractor.inviteStatus !== 'pending' || !subcontractor.inviteToken) {
      console.log('Subcontractor created without invite, skipping email');
      return;
    }

    try {
      // Get company details
      const companyDoc = await db.collection('companies').doc(subcontractor.companyId).get();
      const companyName = companyDoc.exists ? companyDoc.data()!.name : 'Company';

      // Send the email
      const result = await sendSubcontractorInviteEmail(
        subcontractor.email,
        subcontractor.name,
        companyName,
        subcontractor.inviteToken
      );

      if (result.success) {
        console.log(`Invite email sent to ${subcontractor.email}`);
        
        // Update with email sent timestamp
        await snap.ref.update({
          inviteSentAt: FieldValue.serverTimestamp(),
        });
      } else {
        console.error(`Failed to send invite email: ${result.error}`);
      }
    } catch (error) {
      console.error('Error in onSubcontractorInviteCreated:', error);
    }
  });

/**
 * Firestore Trigger: Send notification when subcontractor accepts invite
 */
export const onSubcontractorInviteAccepted = functions.firestore
  .document('subcontractors/{subcontractorId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if invite status changed to accepted
    if (before.inviteStatus !== 'accepted' && after.inviteStatus === 'accepted') {
      try {
        // Get company details and owner email
        const companyDoc = await db.collection('companies').doc(after.companyId).get();
        
        if (!companyDoc.exists) {
          console.error('Company not found');
          return;
        }
        
        const companyData = companyDoc.data()!;
        const ownerId = companyData.ownerId;
        
        // Get owner email
        const ownerDoc = await db.collection('users').doc(ownerId).get();
        
        if (!ownerDoc.exists) {
          console.error('Owner not found');
          return;
        }
        
        const ownerEmail = ownerDoc.data()!.email;
        
        // Send notification email to company owner
        const result = await sendInviteAcceptedNotificationEmail(
          ownerEmail,
          companyData.name,
          after.name,
          after.email
        );

        if (result.success) {
          console.log(`Notification email sent to ${ownerEmail}`);
        } else {
          console.error(`Failed to send notification email: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in onSubcontractorInviteAccepted:', error);
      }
    }
  });

/**
 * Create Project Submission
 * Callable function to submit all time logs and expenses for a project
 * Creates a projectSubmission document that groups all entries for approval
 */
export const createProjectSubmission = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { projectId, companyId, subcontractorId } = data;

  if (!projectId || !companyId || !subcontractorId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'projectId, companyId, and subcontractorId are required'
    );
  }

  try {
    // Verify user has access to this company
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const hasAccess =
      userData.ownCompanyId === companyId ||
      (userData.subcontractorRoles && userData.subcontractorRoles[companyId]);

    if (!hasAccess) {
      throw new functions.https.HttpsError('permission-denied', 'No access to this company');
    }

    // Get all time logs for this project
    const timeLogsSnap = await db
      .collection('timeLogs')
      .where('projectId', '==', projectId)
      .where('companyId', '==', companyId)
      .where('subcontractorId', '==', subcontractorId)
      .where('createdByUserId', '==', context.auth.uid)
      .get();

    // Get all expenses for this project
    const expensesSnap = await db
      .collection('expenses')
      .where('projectId', '==', projectId)
      .where('companyId', '==', companyId)
      .where('subcontractorId', '==', subcontractorId)
      .where('createdByUserId', '==', context.auth.uid)
      .get();

    if (timeLogsSnap.empty && expensesSnap.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No time logs or expenses to submit'
      );
    }

    // Calculate totals
    let totalHours = 0;
    let totalCost = 0;
    const timeLogIds: string[] = [];

    timeLogsSnap.forEach((doc) => {
      const log = doc.data();
      totalHours += (log.hoursRegular || 0) + (log.hoursOT || 0);
      totalCost += log.subCost || 0;
      timeLogIds.push(doc.id);
    });

    let totalExpenses = 0;
    const expenseIds: string[] = [];

    expensesSnap.forEach((doc) => {
      const exp = doc.data();
      totalExpenses += exp.amount || 0;
      expenseIds.push(doc.id);
    });

    // Create project submission document
    const submissionData = {
      companyId,
      projectId,
      subcontractorId,
      createdByUserId: context.auth.uid,
      timeLogIds,
      expenseIds,
      status: 'DRAFT',
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const submissionRef = await db.collection('projectSubmissions').add(submissionData);

    console.log(`Project submission created: ${submissionRef.id}`);

    return {
      success: true,
      submissionId: submissionRef.id,
      totalHours: submissionData.totalHours,
      totalCost: submissionData.totalCost,
      totalExpenses: submissionData.totalExpenses,
    };
  } catch (error: any) {
    console.error('Error creating project submission:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to create submission');
  }
});

/**
 * Submit Project Submission for Approval
 * Callable function to submit a project submission (change status from DRAFT to SUBMITTED)
 */
export const submitProjectSubmission = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { submissionId } = data;

  if (!submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  try {
    // Get submission document
    const submissionDoc = await db.collection('projectSubmissions').doc(submissionId).get();

    if (!submissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    const submission = submissionDoc.data()!;

    // Verify user created this submission
    if (submission.createdByUserId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to submit this');
    }

    // Verify submission is in DRAFT status
    if (submission.status !== 'DRAFT') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Submission is not in DRAFT status'
      );
    }

    // Update submission status to SUBMITTED
    await db.collection('projectSubmissions').doc(submissionId).update({
      status: 'SUBMITTED',
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Project submission submitted: ${submissionId}`);

    return {
      success: true,
      submissionId,
      status: 'SUBMITTED',
    };
  } catch (error: any) {
    console.error('Error submitting project submission:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to submit');
  }
});

/**
 * Approve Project Submission
 * Callable function for managers/admins to approve a project submission
 */
export const approveProjectSubmission = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { submissionId } = data;

  if (!submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  try {
    // Get submission document
    const submissionDoc = await db.collection('projectSubmissions').doc(submissionId).get();

    if (!submissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    const submission = submissionDoc.data()!;

    // Verify user is admin/manager in the company
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.ownCompanyId !== submission.companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to approve');
    }

    if (!['ADMIN', 'MANAGER'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins/managers can approve');
    }

    // Verify submission is in SUBMITTED status
    if (submission.status !== 'SUBMITTED') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Submission is not in SUBMITTED status'
      );
    }

    // Update submission status to APPROVED
    await db.collection('projectSubmissions').doc(submissionId).update({
      status: 'APPROVED',
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: context.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Project submission approved: ${submissionId}`);

    return {
      success: true,
      submissionId,
      status: 'APPROVED',
    };
  } catch (error: any) {
    console.error('Error approving project submission:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to approve');
  }
});

/**
 * Reject Project Submission
 * Callable function for managers/admins to reject a project submission
 */
export const rejectProjectSubmission = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { submissionId, rejectionReason } = data;

  if (!submissionId) {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  try {
    // Get submission document
    const submissionDoc = await db.collection('projectSubmissions').doc(submissionId).get();

    if (!submissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    const submission = submissionDoc.data()!;

    // Verify user is admin/manager in the company
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.ownCompanyId !== submission.companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to reject');
    }

    if (!['ADMIN', 'MANAGER'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins/managers can reject');
    }

    // Verify submission is in SUBMITTED status
    if (submission.status !== 'SUBMITTED') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Submission is not in SUBMITTED status'
      );
    }

    // Update submission status to REJECTED
    await db.collection('projectSubmissions').doc(submissionId).update({
      status: 'REJECTED',
      rejectionReason: rejectionReason || '',
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Project submission rejected: ${submissionId}`);

    return {
      success: true,
      submissionId,
      status: 'REJECTED',
    };
  } catch (error: any) {
    console.error('Error rejecting project submission:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to reject');
  }
});
