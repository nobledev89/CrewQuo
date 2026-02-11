# Gumroad Integration Setup Guide

Complete guide to integrate Gumroad payments with CrewQuo for subscription management.

---

## Overview

CrewQuo uses Gumroad for payment processing and subscription management. This integration automatically:
- Activates subscriptions when users purchase
- Updates subscription status in real-time
- Handles cancellations, refunds, and renewals
- Maps Gumroad tiers to CrewQuo plans

---

## Prerequisites

- [x] Gumroad account with product set up
- [x] Firebase project with deployed Cloud Functions
- [ ] Webhook endpoint configured in Gumroad
- [ ] Environment variables configured

---

## Step 1: Gumroad Product Setup

### 1.1 Create Your Product (If Not Already Done)

1. Go to https://gumroad.com/products
2. Click **"New Product"**
3. Configure your product:
   - **Product Type**: Choose "Membership" or "Subscription"
   - **Product Name**: "CrewQuo Subscription"
   - **Product Permalink**: `zxjxzj` (already configured in your app)

### 1.2 Configure Pricing Tiers

Create variants/tiers that match your CrewQuo plans:

| Tier Name | Price | CrewQuo Plan | Features |
|-----------|-------|--------------|----------|
| Personal | £99/month | `starter` | 10 clients, 5 subcontractors |
| Business Starter | £199/month | `professional` | Unlimited clients, 25 subcontractors |
| Business Pro | £349/month | `enterprise` | Unlimited everything |

**Important:** The tier/variant names MUST include these keywords for automatic plan detection:
- "Personal" → Maps to `starter`
- "Business Starter" → Maps to `professional`
- "Business Pro" → Maps to `enterprise`

### 1.3 Add Custom Field for User ID

In Gumroad product settings:
1. Go to **"Customize Form"**
2. Add a custom field:
   - **Field Name**: `user_id`
   - **Field Type**: Hidden or Text
   - **Required**: Yes
   - **Description**: "Your CrewQuo User ID (auto-filled)"

This field will be populated automatically from your app when users click the purchase link.

---

## Step 2: Configure Webhook in Gumroad

### 2.1 Get Your Webhook URL

Your webhook URL will be:
```
https://YOUR-REGION-YOUR-PROJECT-ID.cloudfunctions.net/gumroadWebhook
```

To find your exact URL:
1. Deploy your Firebase Functions (if not already):
   ```bash
   cd functions
   npm run build
   cd ..
   firebase deploy --only functions
   ```

2. After deployment, Firebase will show your function URLs. Look for:
   ```
   ✔  functions[gumroadWebhook(us-central1)]: https://us-central1-YOUR-PROJECT.cloudfunctions.net/gumroadWebhook
   ```

3. Copy this URL.

### 2.2 Add Webhook to Gumroad

1. Go to https://app.gumroad.com/settings/advanced
2. Scroll to **"Advanced" → "Ping URL"** section
3. Enter your webhook URL: 
   ```
   https://us-central1-YOUR-PROJECT.cloudfunctions.net/gumroadWebhook
   ```
4. Click **"Save"**

### 2.3 Test the Webhook

Gumroad provides a "Send test ping" button:
1. In the Ping URL section, click **"Send test ping"**
2. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only gumroadWebhook
   ```
3. You should see: `"Received Gumroad webhook: {...}"`

---

## Step 3: Configure Environment Variables

### 3.1 Get Your Gumroad Seller ID

1. Go to https://app.gumroad.com/settings
2. Your Seller ID is in the URL: `https://app.gumroad.com/YOUR-SELLER-ID/...`
3. Or find it in your Gumroad account settings

### 3.2 Add to Firebase Functions Config

Add the seller ID for webhook validation:

```bash
firebase functions:config:set gumroad.seller_id="YOUR_SELLER_ID"
```

### 3.3 Redeploy Functions

After setting config:
```bash
firebase deploy --only functions
```

### 3.4 Verify Configuration

```bash
firebase functions:config:get
```

You should see:
```json
{
  "gumroad": {
    "seller_id": "YOUR_SELLER_ID"
  }
}
```

---

## Step 4: Update Purchase Links in Your App

### 4.1 Generate Purchase Links with User ID

In your frontend, when users click "Upgrade" or "Subscribe", construct the Gumroad link with their user ID:

```typescript
const gumroadLink = `https://dpthrill.gumroad.com/l/zxjxzj?wanted=true&user_id=${auth.currentUser?.uid}`;
```

**Current Configuration:**
- Product permalink: `zxjxzj` (from `.env.local.example`)
- Base URL: `https://dpthrill.gumroad.com/l/`

### 4.2 Verify Link Format

Your purchase links should look like:
```
https://dpthrill.gumroad.com/l/zxjxzj?wanted=true&user_id=abc123xyz
                                       ^^^^^^         ^^^^^^^^^^^^^^^
                                       Product        User ID (Firebase UID)
                                       Permalink
```

### 4.3 Check Existing Implementation

I'll verify your current implementation is passing the user_id correctly.

---

## Step 5: Test the Complete Flow

### 5.1 Test Purchase Flow (Sandbox Mode)

Gumroad provides test mode for safe testing:

1. Enable test mode in Gumroad:
   - Go to https://app.gumroad.com/settings/advanced
   - Enable **"Test mode"**

2. Make a test purchase:
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC

3. Verify in Firebase:
   ```bash
   firebase functions:log --only gumroadWebhook
   ```

4. Check Firestore:
   - User document should have `subscriptionStatus: 'active'`
   - User document should have correct `subscriptionPlan`
   - Company document should have Gumroad details

### 5.2 Test Cancellation Flow

1. In Gumroad dashboard, cancel the test subscription
2. Verify webhook receives cancellation event
3. Check Firestore updates to `subscriptionStatus: 'cancelled'`

### 5.3 Test Refund Flow

1. In Gumroad dashboard, issue a refund
2. Verify webhook processes refund
3. Check Firestore updates to `subscriptionStatus: 'refunded'`

---

## Step 6: Webhook Event Handling

### Supported Events

Your webhook handler supports these Gumroad events:

| Event | Trigger | Action |
|-------|---------|--------|
| `sale` | One-time purchase | Activate subscription |
| `subscription_id` | Recurring subscription | Activate subscription, store subscription ID |
| `cancelled` | User cancels | Set status to 'cancelled' |
| `ended` | Subscription expires | Set status to 'expired' |
| `refunded` | Payment refunded | Set status to 'refunded' |

### Data Stored in Firestore

After successful purchase, these fields are stored:

**User Document:**
```typescript
{
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded',
  subscriptionPlan: 'starter' | 'professional' | 'enterprise',
  updatedAt: Timestamp
}
```

**Company Document:**
```typescript
{
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded',
  subscriptionPlan: 'starter' | 'professional' | 'enterprise',
  gumroadSubscriptionId: 'string',  // For recurring subscriptions
  gumroadSaleId: 'string',
  gumroadPurchaserEmail: 'string',
  gumroadProductPermalink: 'string',
  gumroadTierName: 'string',
  lastPaymentAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Step 7: Display Subscription Status in App

### 7.1 Check Subscription Status

Users can view their subscription in the app:
- **Settings Page**: `/dashboard/settings`
- **Super Admin Panel**: `/super-admin` (for admins)

### 7.2 Implement Subscription Guards

Protect features based on subscription plan:

```typescript
import { SUBSCRIPTION_LIMITS } from '@/lib/types';

function canCreateClient(user: User, currentCount: number): boolean {
  const limits = SUBSCRIPTION_LIMITS[user.subscriptionPlan];
  return limits.clients === -1 || currentCount < limits.clients;
}
```

---

## Troubleshooting

### Issue: Webhook Not Receiving Events

**Check:**
1. Webhook URL is correct in Gumroad settings
2. Firebase Functions are deployed: `firebase deploy --only functions`
3. No firewall blocking requests
4. Check Firebase Functions logs: `firebase functions:log`

**Solution:**
```bash
# Redeploy functions
firebase deploy --only functions

# Send test ping from Gumroad dashboard
# Check logs immediately
firebase functions:log --only gumroadWebhook --limit 50
```

### Issue: Plan Not Detected Correctly

**Check:**
1. Tier/variant names in Gumroad match keywords ("Personal", "Business Starter", "Business Pro")
2. Webhook payload includes tier information
3. Price fallback logic may activate

**Solution:**
Review webhook payload in logs and ensure tier names are correct.

### Issue: User ID Not Passed to Gumroad

**Check:**
1. Purchase link includes `user_id` parameter
2. Custom field configured in Gumroad product
3. Field is being populated correctly

**Solution:**
Verify purchase link format:
```typescript
const link = `https://dpthrill.gumroad.com/l/zxjxzj?user_id=${userId}`;
```

### Issue: Webhook Validation Fails

**Check:**
1. `GUMROAD_SELLER_ID` is set in Firebase config
2. Seller ID matches your Gumroad account

**Solution:**
```bash
# Update seller ID
firebase functions:config:set gumroad.seller_id="CORRECT_SELLER_ID"
firebase deploy --only functions
```

---

## Security Considerations

### ✅ Implemented

- [x] Webhook validates seller ID (optional but recommended)
- [x] User ID required for all transactions
- [x] Subscription status stored in secure Firestore
- [x] Cloud Functions run with admin privileges

### 🔒 Recommended Additions

- [ ] Add webhook signature verification (Gumroad doesn't provide this, but validate seller_id strictly)
- [ ] Rate limiting on webhook endpoint
- [ ] Monitor for unusual webhook patterns
- [ ] Log all webhook events for audit trail

---

## Monitoring & Maintenance

### Daily Checks

```bash
# Check recent webhook events
firebase functions:log --only gumroadWebhook --limit 20

# Check for errors
firebase functions:log --only gumroadWebhook --limit 20 | grep ERROR
```

### Monthly Tasks

1. Review subscription statuses in Firestore
2. Reconcile with Gumroad dashboard
3. Check for failed webhook deliveries
4. Update plan pricing if needed

---

## Testing Checklist

Before going live:

- [ ] Test purchase flow with Gumroad test mode
- [ ] Verify webhook receives and processes events
- [ ] Confirm Firestore updates correctly
- [ ] Test plan tier detection (all 3 tiers)
- [ ] Test cancellation flow
- [ ] Test refund flow
- [ ] Verify subscription limits enforce correctly
- [ ] Test with multiple users simultaneously
- [ ] Check subscription status displays correctly in app
- [ ] Verify trial → paid transition works

---

## Production Launch

### Go-Live Checklist

1. **Disable Gumroad test mode**
2. **Verify production webhook URL** is configured
3. **Test with real (low-value) purchase** 
4. **Monitor logs closely** for first 24 hours
5. **Have support email ready** for payment issues

### Post-Launch Monitoring

- Monitor webhook delivery rate (should be 100%)
- Track failed payments
- Watch for unusual subscription patterns
- Gather user feedback on payment flow

---

## Support Resources

- **Gumroad Documentation**: https://help.gumroad.com/article/76-api-webhooks
- **Firebase Functions Logs**: `firebase functions:log`
- **Firestore Console**: https://console.firebase.google.com/

---

## Quick Reference

### Important URLs

- **Gumroad Dashboard**: https://app.gumroad.com
- **Webhook Settings**: https://app.gumroad.com/settings/advanced
- **Firebase Console**: https://console.firebase.google.com
- **Your Product**: https://dpthrill.gumroad.com/l/zxjxzj

### Important Commands

```bash
# Deploy functions
firebase deploy --only functions

# View logs
firebase functions:log --only gumroadWebhook

# Set config
firebase functions:config:set gumroad.seller_id="YOUR_ID"

# Get config
firebase functions:config:get
```

---

## Next Steps

1. ✅ Review this guide
2. 🔲 Configure webhook URL in Gumroad
3. 🔲 Set seller ID in Firebase config
4. 🔲 Test webhook with test ping
5. 🔲 Make test purchase in sandbox mode
6. 🔲 Verify complete flow end-to-end
7. 🔲 Go live! 🚀
