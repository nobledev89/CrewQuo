# Gumroad Integration Testing Checklist

Complete testing checklist to verify your Gumroad integration is working correctly before launch.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Deploy Firebase Functions
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions:gumroadWebhook
```

**Expected Output:**
```
✔  functions[gumroadWebhook(us-central1)]: https://us-central1-YOUR-PROJECT.cloudfunctions.net/gumroadWebhook
```

**Copy this URL** - you'll need it for Gumroad.

---

### Step 2: Configure Gumroad Webhook

1. Go to: https://app.gumroad.com/settings/advanced
2. Find **"Ping URL"** section
3. Paste your function URL from Step 1
4. Click **"Save"**
5. Click **"Send test ping"**

**Verify:**
```bash
firebase functions:log --only gumroadWebhook --limit 5
```

You should see:
```
Received Gumroad webhook: {...}
```

✅ If you see this, webhook is working!

---

### Step 3: Set Seller ID (Optional but Recommended)

Get your Seller ID:
- Look at URL when logged into Gumroad: `https://app.gumroad.com/YOUR-SELLER-ID/...`
- Or find it in Settings

Set in Firebase:
```bash
firebase functions:config:set gumroad.seller_id="YOUR_SELLER_ID"
firebase deploy --only functions
```

---

### Step 4: Test Purchase Flow

**Enable Gumroad Test Mode:**
1. Go to: https://app.gumroad.com/settings/advanced
2. Enable **"Test mode"**
3. ✅ Test card: `4242 4242 4242 4242`

**Make Test Purchase:**
1. Log into your CrewQuo app
2. Go to: http://localhost:3000/pricing (or your domain)
3. Click **"Start Free Trial"** on any plan
4. You'll be redirected to Gumroad
5. Complete purchase with test card

**Verify in Firebase:**
```bash
# Check webhook received purchase
firebase functions:log --only gumroadWebhook --limit 10

# Check Firestore was updated
# Go to Firebase Console → Firestore
# Find your user document
# Verify: subscriptionStatus = 'active'
# Verify: subscriptionPlan = 'starter' | 'professional' | 'enterprise'
```

✅ If subscription status updated, integration is working!

---

## 📋 Complete Testing Checklist

### Prerequisites
- [ ] Firebase Functions deployed
- [ ] Gumroad webhook configured and tested
- [ ] Seller ID set in Firebase config
- [ ] Test mode enabled in Gumroad
- [ ] Product has tiers/variants configured

---

### Test 1: Unauthenticated User Flow
**Steps:**
1. Logout of CrewQuo (or use incognito)
2. Go to `/pricing`
3. Click "Start Free Trial"

**Expected:**
- [ ] Redirected to `/signup` page
- [ ] Can see pricing without logging in

**Status:** ___________

---

### Test 2: Authenticated User Purchase - Starter Plan
**Steps:**
1. Login to CrewQuo
2. Go to `/pricing`
3. Click "Start Free Trial" on **Personal** plan
4. Complete purchase with test card: `4242 4242 4242 4242`

**Expected:**
- [ ] Redirected to Gumroad with `user_id` in URL
- [ ] Purchase completes successfully
- [ ] Webhook receives event (check logs)
- [ ] User document updates: `subscriptionStatus: 'active'`
- [ ] User document updates: `subscriptionPlan: 'starter'`
- [ ] Company document updates with Gumroad details

**Verify in Firestore:**
```javascript
// User document should have:
{
  subscriptionStatus: 'active',
  subscriptionPlan: 'starter',
  updatedAt: [recent timestamp]
}

// Company document should have:
{
  subscriptionStatus: 'active',
  subscriptionPlan: 'starter',
  gumroadSaleId: 'xxx',
  gumroadSubscriptionId: 'xxx', // if subscription
  gumroadPurchaserEmail: 'user@example.com',
  lastPaymentAt: [recent timestamp]
}
```

**Status:** ___________

---

### Test 3: Authenticated User Purchase - Professional Plan
**Steps:**
1. Login to CrewQuo
2. Go to `/pricing`
3. Click "Start Free Trial" on **Business Starter** plan
4. Complete purchase with test card

**Expected:**
- [ ] Same as Test 2, but `subscriptionPlan: 'professional'`

**Status:** ___________

---

### Test 4: Authenticated User Purchase - Enterprise Plan
**Steps:**
1. Login to CrewQuo
2. Go to `/pricing`
3. Click "Start Free Trial" on **Business Pro** plan
4. Complete purchase with test card

**Expected:**
- [ ] Same as Test 2, but `subscriptionPlan: 'enterprise'`

**Status:** ___________

---

### Test 5: Subscription Cancellation
**Steps:**
1. Complete a test purchase (Test 2-4)
2. Go to Gumroad dashboard: https://app.gumroad.com/subscriptions
3. Find the test subscription
4. Click **"Cancel subscription"**
5. Wait 10-30 seconds

**Expected:**
- [ ] Webhook receives cancellation event
- [ ] User document updates: `subscriptionStatus: 'cancelled'`
- [ ] Company document updates: `subscriptionStatus: 'cancelled'`
- [ ] `subscriptionCancelledAt` timestamp added

**Verify:**
```bash
firebase functions:log --only gumroadWebhook | grep "cancelled"
```

**Status:** ___________

---

### Test 6: Refund Processing
**Steps:**
1. Complete a test purchase
2. Go to Gumroad dashboard: https://app.gumroad.com/sales
3. Find the sale
4. Issue a refund

**Expected:**
- [ ] Webhook receives refund event
- [ ] User document updates: `subscriptionStatus: 'refunded'`
- [ ] Company document updates: `subscriptionStatus: 'refunded'`
- [ ] `refundedAt` timestamp added

**Status:** ___________

---

### Test 7: Multiple Users Purchase
**Steps:**
1. Create 3 test user accounts
2. Have each purchase a different plan
3. Verify each gets correct plan

**Expected:**
- [ ] User 1: Starter plan active
- [ ] User 2: Professional plan active
- [ ] User 3: Enterprise plan active
- [ ] No cross-contamination of data

**Status:** ___________

---

### Test 8: Super Admin View
**Steps:**
1. Login as super admin
2. Go to `/super-admin`
3. Check subscription statistics

**Expected:**
- [ ] Can see all users and their subscription status
- [ ] Subscription counts are accurate
- [ ] Can filter by plan and status
- [ ] Gumroad details visible for purchased accounts

**Status:** ___________

---

### Test 9: Settings Page Display
**Steps:**
1. Login as user with active subscription
2. Go to `/dashboard/settings`

**Expected:**
- [ ] Current plan displayed correctly
- [ ] Subscription status shown
- [ ] "Upgrade Plan" link visible
- [ ] Billing information accurate

**Status:** ___________

---

### Test 10: Trial Period Behavior
**Steps:**
1. Create new account (should start with trial)
2. Verify trial status
3. Check trial expiration logic

**Expected:**
- [ ] New user starts with `subscriptionStatus: 'trial'`
- [ ] `trialEndsAt` set to 7 days from creation
- [ ] Trial banner appears in dashboard
- [ ] Days remaining shown correctly

**Status:** ___________

---

## 🐛 Troubleshooting Guide

### Issue: Webhook Not Receiving Events

**Symptoms:**
- Gumroad webhook sends ping but nothing in Firebase logs
- Purchases complete but subscription not activated

**Checks:**
```bash
# 1. Verify function is deployed
firebase functions:list | grep gumroad

# 2. Check function logs for errors
firebase functions:log --only gumroadWebhook --limit 50

# 3. Test webhook URL directly
curl -X POST https://YOUR-FUNCTION-URL \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "seller_id=test&user_id=test&sale_id=test"
```

**Solutions:**
- Redeploy functions: `firebase deploy --only functions`
- Verify webhook URL in Gumroad settings
- Check for CORS or network issues
- Ensure Firebase project has billing enabled

---

### Issue: Plan Not Detected Correctly

**Symptoms:**
- Purchase completes but wrong plan assigned
- Always defaults to `starter` plan

**Checks:**
```bash
# Check webhook payload in logs
firebase functions:log --only gumroadWebhook | grep "Determining plan"
```

**Look for:**
```json
{
  "variant_name": "Personal" | "Business Starter" | "Business Pro",
  "tier_name": "Personal" | "Business Starter" | "Business Pro"
}
```

**Solutions:**
1. Verify Gumroad tier names EXACTLY match:
   - "Personal" → Starter
   - "Business Starter" → Professional
   - "Business Pro" → Enterprise
2. Check `determineSubscriptionPlan()` function in `functions/src/index.ts`
3. Ensure tier names in Gumroad product match config

---

### Issue: User ID Not Passed to Gumroad

**Symptoms:**
- Webhook error: "No user_id in webhook data"
- Purchase completes but subscription not assigned to user

**Checks:**
1. Check purchase URL in browser:
   ```
   https://dunehunter.gumroad.com/l/zxjxzj?wanted=true&user_id=XXXXX
   ```
2. Verify `user_id` parameter is present
3. Check Gumroad product has `user_id` custom field

**Solutions:**
1. Add custom field in Gumroad:
   - Field name: `user_id`
   - Required: Yes
   - Type: Hidden or Text
2. Verify `generateGumroadCheckoutUrl()` in `lib/gumroad.ts`
3. Check authentication state when clicking "Subscribe"

---

### Issue: Webhook Validation Fails

**Symptoms:**
- Log shows: "Invalid seller ID"
- Webhook rejected

**Solution:**
```bash
# Verify seller ID is set correctly
firebase functions:config:get

# Should show:
# {
#   "gumroad": {
#     "seller_id": "YOUR_SELLER_ID"
#   }
# }

# If missing or wrong, update:
firebase functions:config:set gumroad.seller_id="CORRECT_SELLER_ID"
firebase deploy --only functions
```

---

### Issue: Firestore Not Updating

**Symptoms:**
- Webhook receives event (in logs)
- But Firestore documents don't update

**Checks:**
1. Check Firestore rules allow function to write
2. Verify user/company documents exist
3. Check for errors in function logs

**Solution:**
```bash
# Check for detailed errors
firebase functions:log --only gumroadWebhook | grep "Error"

# Verify Firestore rules
# Company and User collections should allow:
# - Cloud Functions (admin) to write
```

---

## 📊 Monitoring Commands

### View Recent Webhook Events
```bash
firebase functions:log --only gumroadWebhook --limit 20
```

### Check for Errors
```bash
firebase functions:log --only gumroadWebhook | grep -i error
```

### Watch Logs in Real-Time
```bash
firebase functions:log --only gumroadWebhook --limit 100
# Keep this running while testing
```

### Check Function Status
```bash
firebase functions:list
```

### View Firestore Documents
```bash
# Go to: https://console.firebase.google.com/project/YOUR-PROJECT/firestore
```

---

## ✅ Pre-Production Checklist

Before disabling test mode and going live:

### Configuration
- [ ] Webhook URL configured in Gumroad (production)
- [ ] Seller ID set in Firebase config
- [ ] Functions deployed to production
- [ ] Environment variables set in Vercel

### Testing
- [ ] All 10 tests above passed
- [ ] Tested with multiple users
- [ ] Tested all 3 plans
- [ ] Tested cancellation flow
- [ ] Tested refund flow
- [ ] Verified data in Firestore

### Gumroad Setup
- [ ] Product tiers named correctly
- [ ] Custom field `user_id` configured
- [ ] Pricing set correctly
- [ ] Trial period configured (if applicable)
- [ ] Test mode DISABLED for production

### Monitoring
- [ ] Can access Firebase logs
- [ ] Can view Gumroad dashboard
- [ ] Error alerting configured (optional)
- [ ] Support email ready for payment issues

### Documentation
- [ ] Team knows how to check subscription status
- [ ] Team knows how to handle refund requests
- [ ] Team knows webhook troubleshooting steps

---

## 🎯 Go-Live Steps

1. **Disable Gumroad Test Mode**
   ```
   Settings → Advanced → Test Mode → OFF
   ```

2. **Test with Real (Low-Value) Purchase**
   - Create test account
   - Purchase lowest tier
   - Verify everything works
   - Issue refund if needed

3. **Monitor Closely for 24 Hours**
   ```bash
   firebase functions:log --only gumroadWebhook
   ```

4. **Announce to Beta Users**
   - Provide purchase links
   - Explain 7-day trial
   - Set up support channel

5. **Track Key Metrics**
   - Purchases per day
   - Webhook delivery rate
   - Failed payments
   - Support tickets

---

## 📞 Support Resources

- **Gumroad Help**: https://help.gumroad.com/
- **Gumroad API Docs**: https://help.gumroad.com/article/76-api-webhooks
- **Firebase Functions Docs**: https://firebase.google.com/docs/functions
- **Your Gumroad Dashboard**: https://app.gumroad.com
- **Your Firebase Console**: https://console.firebase.google.com

---

## 🐛 Common Error Codes

### Gumroad Errors
- `404 Not Found` - Webhook URL incorrect
- `500 Server Error` - Function crashed (check logs)
- `401 Unauthorized` - Seller ID validation failed

### Firebase Errors
- `permission-denied` - Firestore rules blocking write
- `not-found` - User/company document missing
- `invalid-argument` - Missing user_id in webhook

---

## ✨ Success Criteria

Your Gumroad integration is ready for production when:

✅ Test purchases complete successfully (all 3 plans)  
✅ Webhook receives all events (100% delivery)  
✅ Firestore updates correctly every time  
✅ Cancellations and refunds process correctly  
✅ Multiple users can purchase simultaneously  
✅ No errors in Firebase logs  
✅ Subscription status displays correctly in app  
✅ Super admin can see all subscriptions  

---

**Ready to launch? Good luck! 🚀**
