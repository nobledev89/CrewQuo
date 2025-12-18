# Gumroad Integration Setup Guide

This guide will walk you through setting up Gumroad as your payment processor for CrewQuo.

## Table of Contents
1. [Create Gumroad Account](#1-create-gumroad-account)
2. [Create Products](#2-create-products)
3. [Configure Products](#3-configure-products)
4. [Get Product Permalinks](#4-get-product-permalinks)
5. [Set Up Webhooks](#5-set-up-webhooks)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Deploy Firebase Functions](#7-deploy-firebase-functions)
8. [Testing](#8-testing)

---

## 1. Create Gumroad Account

1. Go to [gumroad.com](https://gumroad.com)
2. Click **"Start Selling"** or **"Sign Up"**
3. Complete the registration process
4. Verify your email address

---

## 2. Create Products

You need to create three products for the different subscription tiers:

### Product 1: Starter Plan

1. Log in to your Gumroad dashboard
2. Click **"Products"** in the left sidebar
3. Click **"New Product"**
4. Choose product type:
   - For **one-time payment**: Select "Digital Product"
   - For **subscription**: Select "Membership" or "Recurring Payment"
5. Fill in the details:
   - **Name**: Starter Plan
   - **Price**: $29/month (or your preferred pricing)
   - **Description**: Perfect for small teams - Up to 10 projects, Up to 5 team members, Basic reporting, Email support
6. Click **"Save"** or **"Publish"**

### Product 2: Professional Plan

1. Click **"New Product"** again
2. Choose the same product type as above
3. Fill in the details:
   - **Name**: Professional Plan
   - **Price**: $79/month
   - **Description**: For growing businesses - Unlimited projects, Up to 25 team members, Advanced reporting, Priority support, Custom roles
4. Click **"Save"** or **"Publish"**

### Product 3: Enterprise Plan

1. Click **"New Product"** again
2. Choose the same product type as above
3. Fill in the details:
   - **Name**: Enterprise Plan
   - **Price**: $199/month
   - **Description**: For large organizations - Unlimited everything, Unlimited team members, Custom integrations, Dedicated support, SLA guarantee, Custom contract
4. Click **"Save"** or **"Publish"**

---

## 3. Configure Products

For each product, you need to add a custom field to capture the user ID:

1. Go to your product page
2. Click on the product to edit it
3. Scroll down to **"Advanced"** section
4. Find **"Custom Fields"** or **"Checkout Fields"**
5. Add a custom field:
   - **Field Name**: `user_id`
   - **Field Type**: Hidden or Text (Hidden is preferred)
   - **Required**: Yes
6. Save the product

**Note**: The `user_id` field will be automatically populated when users are redirected from your app using the checkout URL.

---

## 4. Get Product Permalinks

For each product, you need to get its permalink:

1. Go to **"Products"** in your Gumroad dashboard
2. Click on a product
3. Look for the **"Share"** section or **"Product URL"**
4. Copy the permalink (it looks like: `your-product-name` or the slug after `gumroad.com/l/`)
   - Example: If the full URL is `https://yourusername.gumroad.com/l/starter-plan`, the permalink is `starter-plan`
   
5. Repeat for all three products

**Save these permalinks** - you'll need them for the environment variables.

---

## 5. Set Up Webhooks

Webhooks allow Gumroad to notify your app when purchases occur.

### 5.1 Deploy Your Firebase Function First

Before setting up webhooks, you need to deploy your Firebase function to get the webhook URL.

```bash
# Build and deploy functions
npm run functions:build
firebase deploy --only functions
```

After deployment, you'll see output like:
```
✔  functions[gumroadWebhook(us-central1)]: Successful create operation.
Function URL (gumroadWebhook(us-central1)): https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/gumroadWebhook
```

**Copy this URL** - you'll need it for the webhook setup.

### 5.2 Configure Webhook in Gumroad

1. Log in to your Gumroad dashboard
2. Click on your profile picture (top right)
3. Go to **"Settings"** → **"Advanced"** → **"Webhooks"**
   - Or directly go to: `https://app.gumroad.com/settings/advanced#webhooks-form`
4. Click **"Create a webhook"** or **"Add webhook"**
5. Fill in the webhook details:
   - **Ping URL**: Paste your Firebase function URL
     - Example: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/gumroadWebhook`
   - **Events to send** (select all that apply):
     - ✅ `sale` - When a purchase is made
     - ✅ `refund` - When a refund is issued
     - ✅ `cancellation` - When a subscription is cancelled
     - ✅ `subscription_updated` - When subscription is updated
     - ✅ `subscription_ended` - When subscription ends
     - ✅ `subscription_restarted` - When subscription restarts
6. Click **"Create webhook"** or **"Save"**

### 5.3 Test Webhook

1. After creating the webhook, Gumroad will send a test ping
2. Check your Firebase function logs:
   ```bash
   firebase functions:log --only gumroadWebhook
   ```
3. You should see a log entry showing the test webhook was received

---

## 6. Configure Environment Variables

### 6.1 Local Development (.env.local)

Update your `.env.local` file with the Gumroad configuration:

```bash
# Gumroad Configuration
NEXT_PUBLIC_GUMROAD_STARTER_PERMALINK=starter-plan
NEXT_PUBLIC_GUMROAD_PRO_PERMALINK=professional-plan
NEXT_PUBLIC_GUMROAD_ENTERPRISE_PERMALINK=enterprise-plan

# Optional: Seller ID for webhook verification
GUMROAD_SELLER_ID=your-seller-id
```

**To get your Seller ID**:
1. Go to Gumroad Settings → Advanced
2. Look for "Seller ID" or "Account ID"
3. Copy the ID (it's usually a long string)

### 6.2 Firebase Environment Variables

For production, set these as Firebase environment variables:

```bash
# Set environment variables for Firebase Functions
firebase functions:config:set \
  gumroad.seller_id="your-seller-id"

# Verify configuration
firebase functions:config:get
```

### 6.3 Next.js Environment Variables (Production)

If deploying to Vercel, Netlify, or other hosting:

1. Go to your hosting dashboard
2. Navigate to **Environment Variables** or **Settings**
3. Add these variables:
   - `NEXT_PUBLIC_GUMROAD_STARTER_PERMALINK`
   - `NEXT_PUBLIC_GUMROAD_PRO_PERMALINK`
   - `NEXT_PUBLIC_GUMROAD_ENTERPRISE_PERMALINK`
   - `GUMROAD_SELLER_ID`

---

## 7. Deploy Firebase Functions

Deploy your updated Firebase functions:

```bash
# Build functions
npm run functions:build

# Deploy only functions
firebase deploy --only functions

# Or deploy everything
npm run deploy
```

Verify the deployment:
```bash
# Check function logs
firebase functions:log --only gumroadWebhook

# Or view in Firebase Console
# https://console.firebase.google.com → Functions → gumroadWebhook
```

---

## 8. Testing

### 8.1 Test Checkout Flow

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to your pricing page** (create one if needed)

3. **Test the checkout URL generation**:
   ```typescript
   import { generateGumroadCheckoutUrl, GUMROAD_CONFIG } from '@/lib/gumroad';
   
   // Example usage in a component
   const handleCheckout = () => {
     const checkoutUrl = generateGumroadCheckoutUrl(
       GUMROAD_CONFIG.plans.starter.permalink,
       userId,  // Pass the authenticated user's ID
       userEmail // Optional: prefill email
     );
     
     // Redirect to Gumroad checkout
     window.location.href = checkoutUrl;
   };
   ```

4. **Complete a test purchase**:
   - Click the checkout button
   - You'll be redirected to Gumroad
   - Complete the purchase (use Gumroad's test mode if available)

### 8.2 Verify Webhook Processing

After a test purchase:

1. **Check Firebase Function logs**:
   ```bash
   firebase functions:log --only gumroadWebhook
   ```

2. **Check Firestore**:
   - Go to Firebase Console → Firestore
   - Check the `companies` collection
   - Verify the user's company document was updated with:
     - `subscriptionStatus: 'active'`
     - `gumroadSaleId`
     - `gumroadPurchaserEmail`
     - `gumroadProductPermalink`

3. **Check user document**:
   - Look in the `users` collection
   - Verify `subscriptionPlan` and `subscriptionStatus` are updated

### 8.3 Test Subscription Events

Test different scenarios:

1. **Cancellation**:
   - Cancel a subscription in Gumroad
   - Verify webhook updates `subscriptionStatus` to `'cancelled'`

2. **Refund**:
   - Issue a refund in Gumroad
   - Verify webhook updates `subscriptionStatus` to `'refunded'`

3. **Subscription End**:
   - Let a subscription expire
   - Verify webhook updates `subscriptionStatus` to `'expired'`

---

## 9. Going Live

### 9.1 Enable Live Mode in Gumroad

1. Go to Gumroad Settings
2. Ensure your account is fully verified
3. Switch from test mode to live mode (if applicable)

### 9.2 Update Webhook URL

If your Firebase project changes or you use a custom domain:

1. Update the webhook URL in Gumroad Settings
2. Test with a real purchase

### 9.3 Monitor

- Check Firebase function logs regularly
- Monitor Firestore for proper updates
- Set up alerts for failed webhook processing

---

## Troubleshooting

### Webhook Not Receiving Data

1. **Check Firebase function logs**:
   ```bash
   firebase functions:log --only gumroadWebhook
   ```

2. **Verify webhook URL** in Gumroad settings

3. **Check Firebase function is deployed**:
   ```bash
   firebase functions:list
   ```

4. **Test webhook manually** using curl:
   ```bash
   curl -X POST https://YOUR-FUNCTION-URL/gumroadWebhook \
     -H "Content-Type: application/json" \
     -d '{"sale_id":"test123","user_id":"testUserId","email":"test@example.com"}'
   ```

### User ID Not Being Passed

1. Verify the custom field `user_id` is added to all products
2. Check the checkout URL includes the user_id parameter
3. Review the `generateGumroadCheckoutUrl` function usage

### Subscription Status Not Updating

1. Check if webhook events are enabled in Gumroad
2. Verify the `seller_id` matches (if using verification)
3. Check Firestore security rules allow updates to company documents
4. Review function logs for errors

---

## Comparison: Gumroad vs Lemon Squeezy

### Advantages of Gumroad:
- ✅ Simple setup, no complex API
- ✅ Lower fees for creators
- ✅ Built-in creator community
- ✅ Easy to manage products
- ✅ Good for digital products

### Things to Note:
- ⚠️ Less API functionality than Lemon Squeezy
- ⚠️ Webhook-only integration (no real-time API)
- ⚠️ Custom checkout redirects required
- ⚠️ Limited subscription management features

---

## Additional Resources

- [Gumroad Documentation](https://help.gumroad.com/)
- [Gumroad API Reference](https://help.gumroad.com/article/280-gumroad-api)
- [Gumroad Webhooks Guide](https://help.gumroad.com/article/269-webhooks)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)

---

## Support

If you encounter issues:

1. Check Firebase function logs
2. Review Gumroad webhook history
3. Test with curl/Postman
4. Contact Gumroad support for webhook issues
5. Check Firebase community forums for function issues

---

**Last Updated**: December 2025
