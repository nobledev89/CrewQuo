import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {getUserClaims, refreshUserClaims} from './auth';
import {RateResolver, PriceCalculator, ShiftType} from './rates';
import {
  CreateTimeLogSchema,
  ProjectSummarySchema,
} from './validators';
import * as crypto from 'crypto';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

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
 * Lemon Squeezy Webhook Handler
 * Handles subscription and payment events from Lemon Squeezy
 */
export const lemonsqueezyWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-signature'] as string;
    const webhookSecret = functions.config().lemonsqueezy?.webhook_secret || process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    // Verify signature
    if (!signature || !verifyLemonSqueezySignature(body, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.body;
    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data;
    const userId = customData?.user_id;

    console.log('Received Lemon Squeezy webhook:', eventName, userId);

    if (!userId) {
      console.error('No user_id in webhook data');
      res.status(400).json({ error: 'No user_id provided' });
      return;
    }

    // Handle different webhook events
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(event, userId);
        break;
      case 'subscription_created':
        await handleSubscriptionCreated(event, userId);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(event, userId);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event, userId);
        break;
      case 'subscription_expired':
        await handleSubscriptionExpired(event, userId);
        break;
      case 'subscription_payment_success':
        await handlePaymentSuccess(event, userId);
        break;
      case 'subscription_payment_failed':
        await handlePaymentFailed(event, userId);
        break;
      default:
        console.log('Unhandled webhook event:', eventName);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Helper function to verify Lemon Squeezy webhook signature
function verifyLemonSqueezySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    return false;
  }
}

// Webhook event handlers
async function handleOrderCreated(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'active',
    lemonsqueezyOrderId: event.data.id,
    lemonsqueezyCustomerId: event.data.attributes.customer_id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Order created for user ${userId}`);
}

async function handleSubscriptionCreated(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'active',
    lemonsqueezySubscriptionId: event.data.id,
    lemonsqueezyCustomerId: event.data.attributes.customer_id,
    subscriptionRenewsAt: event.data.attributes.renews_at ? Timestamp.fromDate(new Date(event.data.attributes.renews_at)) : null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdated(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  const status = event.data.attributes.status;
  let subscriptionStatus = 'active';
  
  if (status === 'cancelled' || status === 'expired') {
    subscriptionStatus = 'cancelled';
  } else if (status === 'past_due') {
    subscriptionStatus = 'past_due';
  } else if (status === 'on_trial') {
    subscriptionStatus = 'trial';
  }
  
  await companyRef.update({
    subscriptionStatus,
    subscriptionRenewsAt: event.data.attributes.renews_at ? Timestamp.fromDate(new Date(event.data.attributes.renews_at)) : null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Subscription updated for user ${userId}: ${subscriptionStatus}`);
}

async function handleSubscriptionCancelled(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'cancelled',
    subscriptionCancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Subscription cancelled for user ${userId}`);
}

async function handleSubscriptionExpired(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'expired',
    subscriptionExpiredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Subscription expired for user ${userId}`);
}

async function handlePaymentSuccess(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'active',
    lastPaymentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Payment success for user ${userId}`);
}

async function handlePaymentFailed(event: any, userId: string) {
  const companyRef = db.collection('companies').doc(userId);
  
  await companyRef.update({
    subscriptionStatus: 'past_due',
    lastPaymentFailedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Payment failed for user ${userId}`);
}
