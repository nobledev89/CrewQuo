# Gumroad Migration Summary

This document summarizes the changes made to migrate from Lemon Squeezy to Gumroad as the payment processor.

## Changes Made

### 1. New Files Created

#### `lib/gumroad.ts`
- New Gumroad configuration file
- Contains product plan definitions (Starter, Professional, Enterprise)
- `generateGumroadCheckoutUrl()` - Generates checkout URLs with user ID
- `verifyGumroadLicense()` - Verifies license keys (optional feature)

#### `GUMROAD_SETUP.md`
- Comprehensive step-by-step setup guide
- Covers account creation, product setup, webhooks, and testing
- Troubleshooting section for common issues

### 2. Files Modified

#### `functions/src/index.ts`
- **Removed**: `lemonsqueezyWebhook` function and all Lemon Squeezy handlers
- **Added**: `gumroadWebhook` function with event handlers:
  - `handleGumroadPurchase()` - Processes one-time purchases
  - `handleGumroadSubscription()` - Processes subscription activations
  - `handleGumroadCancellation()` - Handles subscription cancellations
  - `handleGumroadSubscriptionEnded()` - Handles subscription expiry
  - `handleGumroadRefund()` - Processes refunds
  - `determineSubscriptionPlan()` - Maps product permalinks to plan names

#### `package.json`
- **Removed**: `@lemonsqueezy/lemonsqueezy.js` dependency
- No new dependencies needed (Gumroad uses webhook-only integration)

#### `.env.local.example`
- **Removed**: All Lemon Squeezy environment variables
  - `LEMONSQUEEZY_API_KEY`
  - `NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID`
  - `NEXT_PUBLIC_LEMONSQUEEZY_*_VARIANT_ID`
  - `LEMONSQUEEZY_WEBHOOK_SECRET`
- **Added**: Gumroad environment variables
  - `NEXT_PUBLIC_GUMROAD_STARTER_PERMALINK`
  - `NEXT_PUBLIC_GUMROAD_PRO_PERMALINK`
  - `NEXT_PUBLIC_GUMROAD_ENTERPRISE_PERMALINK`
  - `GUMROAD_SELLER_ID` (optional, for webhook verification)

### 3. Files to Keep (for reference)

#### `lib/lemonsqueezy.ts`
- Keep for now in case you need to reference the old integration
- Can be deleted once migration is complete and tested

## Key Differences: Lemon Squeezy vs Gumroad

### Integration Approach
- **Lemon Squeezy**: API-based with SDK, webhook signatures required
- **Gumroad**: Webhook-only, simpler integration, optional seller ID verification

### Checkout Flow
- **Lemon Squeezy**: Embedded checkout via SDK
- **Gumroad**: Redirect to Gumroad checkout page with custom fields

### Webhook Events
- **Lemon Squeezy**: Complex event system with signatures
- **Gumroad**: Simple POST requests with form data

### Data Storage
- Both store similar data in Firestore `companies` collection:
  - Subscription status
  - Sale/Order IDs
  - Customer email
  - Product information

## Next Steps

### 1. Update Your Environment Variables

Update your `.env.local` file:

```bash
# Remove old Lemon Squeezy variables
# Add new Gumroad variables
NEXT_PUBLIC_GUMROAD_STARTER_PERMALINK=your-starter-permalink
NEXT_PUBLIC_GUMROAD_PRO_PERMALINK=your-pro-permalink
NEXT_PUBLIC_GUMROAD_ENTERPRISE_PERMALINK=your-enterprise-permalink
GUMROAD_SELLER_ID=your-seller-id
```

### 2. Remove Lemon Squeezy Package

```bash
npm uninstall @lemonsqueezy/lemonsqueezy.js
```

### 3. Set Up Gumroad

Follow the detailed instructions in `GUMROAD_SETUP.md`:
1. Create Gumroad account
2. Create three products (Starter, Pro, Enterprise)
3. Add custom `user_id` field to each product
4. Get product permalinks
5. Deploy Firebase function
6. Configure webhook in Gumroad

### 4. Update Your Frontend Code

Replace Lemon Squeezy checkout calls with Gumroad:

**Before (Lemon Squeezy):**
```typescript
import { LEMONSQUEEZY_CONFIG } from '@/lib/lemonsqueezy';
// Complex checkout creation via API
```

**After (Gumroad):**
```typescript
import { generateGumroadCheckoutUrl, GUMROAD_CONFIG } from '@/lib/gumroad';

const handleCheckout = () => {
  const checkoutUrl = generateGumroadCheckoutUrl(
    GUMROAD_CONFIG.plans.starter.permalink,
    userId,
    userEmail
  );
  window.location.href = checkoutUrl;
};
```

### 5. Deploy Changes

```bash
# Build and deploy functions
npm run functions:build
firebase deploy --only functions

# Deploy full app
npm run deploy
```

### 6. Configure Webhook in Gumroad Dashboard

After deployment, copy your Firebase function URL and add it to Gumroad:
- URL: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/gumroadWebhook`
- Events: sale, refund, cancellation, subscription_updated, subscription_ended, subscription_restarted

### 7. Test Everything

1. Test checkout flow
2. Complete a test purchase
3. Verify webhook processing in Firebase logs
4. Check Firestore updates
5. Test cancellation and refund flows

### 8. Clean Up (Optional)

Once migration is complete and tested:
```bash
# Remove Lemon Squeezy integration file
rm lib/lemonsqueezy.ts

# Update any documentation that references Lemon Squeezy
```

## Firestore Schema Updates

The webhook handlers update these fields in Firestore:

### Companies Collection
```typescript
{
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded',
  gumroadSaleId: string,
  gumroadSubscriptionId?: string,
  gumroadPurchaserEmail: string,
  gumroadProductPermalink: string,
  lastPaymentAt: Timestamp,
  subscriptionCancelledAt?: Timestamp,
  subscriptionExpiredAt?: Timestamp,
  refundedAt?: Timestamp,
  updatedAt: Timestamp
}
```

### Users Collection
```typescript
{
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded',
  subscriptionPlan: 'starter' | 'professional' | 'enterprise',
  updatedAt: Timestamp
}
```

## Rollback Plan

If you need to rollback to Lemon Squeezy:

1. Restore `package.json` to include `@lemonsqueezy/lemonsqueezy.js`
2. Run `npm install`
3. Restore `functions/src/index.ts` from git history
4. Restore `.env.local` with Lemon Squeezy variables
5. Deploy functions: `firebase deploy --only functions`
6. Update webhook URL in Lemon Squeezy dashboard

## Support

- **Gumroad Setup**: See `GUMROAD_SETUP.md`
- **Webhook Issues**: Check Firebase function logs
- **Testing**: See testing section in `GUMROAD_SETUP.md`

---

**Migration Date**: December 2025
**Status**: Ready for testing
