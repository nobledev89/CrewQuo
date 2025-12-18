# Gumroad Payment Integration

Complete guide for Gumroad payment integration in CrewQuo.

---

## Overview

CrewQuo uses **Gumroad** for subscription payments with a single product containing three membership tiers:
- **Personal** (£99/month)
- **Business Starter** (£199/month)
- **Business Pro** (£349/month)

**Product URL**: https://dunehunter.gumroad.com/l/zxjxzj

---

## How It Works

### 1. User Flow
1. User signs up and creates an account
2. User navigates to `/pricing` page
3. User clicks "Start Free Trial" on their chosen tier
4. User is redirected to Gumroad with their `user_id` pre-filled
5. User completes payment on Gumroad
6. Gumroad sends webhook to Firebase Cloud Function
7. Function updates user's subscription status in Firestore
8. User gains access to features based on their tier

### 2. Technical Flow
```
User → Pricing Page → Gumroad Checkout → Webhook → Firebase → Firestore Update
```

---

## Configuration

### Environment Variables

Add to `.env.local` and Vercel:
```env
NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK=zxjxzj
```

### Gumroad Settings

**Product Configuration**:
- Product Type: Membership with tiers
- Permalink: `zxjxzj`
- Tiers:
  - Personal (£99/month)
  - Business Starter (£199/month)
  - Business Pro (£349/month)

**Webhook Configuration**:
1. Go to Gumroad Settings → Advanced → Webhooks
2. Set webhook URL: `https://us-central1-projects-corporatespec.cloudfunctions.net/gumroadWebhook`
3. Enable events: `sale`, `refund`, `subscription_updated`, `subscription_cancelled`, `subscription_ended`

---

## User ID Passing

The system passes `user_id` via URL parameter to ensure Gumroad includes it in the webhook:

```typescript
// lib/gumroad.ts
export function generateGumroadCheckoutUrl(
  tierName: string,
  userId: string,
  email?: string
): string {
  const baseUrl = `https://dunehunter.gumroad.com/l/zxjxzj`;
  const params = new URLSearchParams({
    wanted: 'true',
    user_id: userId,  // Passed as query parameter
  });
  
  if (email) {
    params.append('email', email);
  }
  
  return `${baseUrl}?${params.toString()}`;
}
```

### Webhook Extraction

The webhook handler extracts `user_id` from multiple sources:

```typescript
// functions/src/index.ts
const userId = data.custom_fields?.user_id || data.user_id || data.referrer;
```

This ensures maximum reliability in production.

---

## Testing

### Local Testing (Development)
```bash
# 1. Start development server
npm run dev

# 2. Navigate to pricing page
http://localhost:3000/pricing

# 3. Click any tier to test Gumroad redirect
# Note: User must be logged in

# 4. Monitor webhook logs
firebase functions:log --only gumroadWebhook
```

### Production Testing
1. Deploy to Vercel: `git push origin main`
2. Visit: https://crewquo.com/pricing
3. Complete a test purchase
4. Check Firebase Functions logs
5. Verify user subscription in Firestore

---

## Subscription Plans

### Plan Mapping

Gumroad tier names are mapped to internal plan names:

```typescript
Personal → starter
Business Starter → professional
Business Pro → enterprise
```

### Plan Limits

**Personal (starter)**:
- 2 clients
- 4 subcontractors
- Unlimited projects

**Business Starter (professional)**:
- 4 clients
- 10 subcontractors
- Unlimited projects

**Business Pro (enterprise)**:
- 10 clients
- Unlimited subcontractors
- Unlimited projects

---

## Webhook Events

### Sale/Subscription
Updates user to `active` status:
```typescript
{
  subscriptionStatus: 'active',
  subscriptionPlan: 'starter|professional|enterprise',
  gumroadSubscriptionId: '...',
  lastPaymentAt: timestamp
}
```

### Cancellation
Updates user to `cancelled` status:
```typescript
{
  subscriptionStatus: 'cancelled',
  subscriptionCancelledAt: timestamp
}
```

### Subscription Ended
Updates user to `expired` status:
```typescript
{
  subscriptionStatus: 'expired',
  subscriptionExpiredAt: timestamp
}
```

### Refund
Updates user to `refunded` status:
```typescript
{
  subscriptionStatus: 'refunded',
  refundedAt: timestamp
}
```

---

## Troubleshooting

### "No user_id in webhook data"

**Solution**: User ID is now passed via URL parameter. Ensure:
1. Users come from the pricing page (not direct Gumroad link)
2. Users are logged in before clicking "Start Free Trial"
3. Webhook URL is correct in Gumroad settings

### Subscription not activating

**Check**:
1. Firebase Functions logs: `firebase functions:log`
2. Webhook is being received
3. User document exists in Firestore
4. Tier name matches expected values

### Wrong plan assigned

**Verify**:
1. Gumroad tier names match exactly:
   - "Personal" (not "personal")
   - "Business Starter" (not "Business starter")
   - "Business Pro" (not "Business pro")
2. Check webhook payload in logs
3. Review `determineSubscriptionPlan()` function logic

---

## Deployment Checklist

- [ ] Environment variable set in Vercel: `NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK`
- [ ] Webhook URL configured in Gumroad
- [ ] Firebase Functions deployed: `firebase deploy --only functions`
- [ ] Test purchase completed successfully
- [ ] Webhook logs show successful processing
- [ ] User subscription status updated in Firestore
- [ ] User can access tier-appropriate features

---

## Security

- ✅ Webhook validation (seller ID check)
- ✅ Server-side processing (Firebase Functions)
- ✅ No API keys exposed to client
- ✅ Firestore security rules enforce subscription limits
- ✅ User ID validation before processing

---

## Support

For Gumroad-specific issues:
- Gumroad Dashboard: https://app.gumroad.com
- Gumroad Support: https://help.gumroad.com

For implementation issues:
- Check Firebase Functions logs
- Review webhook payload structure
- Verify user document in Firestore
