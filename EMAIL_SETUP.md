# Email System Setup - CrewQuo

This document explains how to set up and configure the email system for CrewQuo using Resend.

## Overview

CrewQuo uses **Resend** as the email service provider to send:
- **Subcontractor Invite Emails** - When you invite a subcontractor to join your team
- **Registration Confirmation Emails** - When a new user signs up
- **Invite Acceptance Notifications** - When a subcontractor accepts an invitation

All emails are sent from: **support@crewquo.com**

## Quick Setup

### 1. Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Create a free account
3. Verify your email address

### 2. Get Your API Key

1. Log in to your Resend dashboard
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Give it a name (e.g., "CrewQuo Production")
5. Copy the API key (it starts with `re_`)

### 3. Configure Domain (Important!)

For emails to be sent from `support@crewquo.com`, you need to verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter `crewquo.com`
4. Follow the DNS configuration instructions:
   - Add the provided DNS records to your domain registrar
   - Wait for DNS propagation (can take up to 48 hours)
   - Resend will automatically verify once DNS is configured

**DNS Records You'll Need to Add:**
- SPF Record (TXT)
- DKIM Record (TXT)
- DMARC Record (TXT) - optional but recommended

### 4. Configure Environment Variables

#### For Firebase Functions:

Add the following to your Firebase Functions configuration:

```bash
# Using Firebase CLI
firebase functions:config:set resend.api_key="re_your_actual_api_key"
firebase functions:config:set app.url="https://crewquo.com"
```

Or set them as environment variables in `.env` file in the `functions` directory:

```env
RESEND_API_KEY=re_your_actual_api_key
APP_URL=https://crewquo.com
```

#### For Local Development:

Create/update your `.env.local` file:

```env
RESEND_API_KEY=re_your_actual_api_key
APP_URL=http://localhost:3000
```

### 5. Deploy Functions

```bash
# Build the functions
npm run functions:build

# Deploy to Firebase
firebase deploy --only functions
```

## Email Features

### 1. Subcontractor Invite Emails

**Trigger:** Automatically sent when a subcontractor is created with `inviteStatus: 'pending'`

**Features:**
- Beautiful branded email template
- Personalized greeting with subcontractor name
- Clear call-to-action button
- Unique invite link that expires after use
- Company name and inviter information
- Mobile-responsive design

**Manual Trigger (Optional):**
You can manually trigger an invite email using the callable function:

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const sendInvite = httpsCallable(functions, 'sendSubcontractorInvite');
await sendInvite({ subcontractorId: 'subcontractor_id' });
```

### 2. Registration Confirmation Emails

**Trigger:** Automatically sent when a new user completes signup

**Features:**
- Welcome message with company name
- Trial period information and expiry date
- Quick start guide with 3 steps
- Links to helpful resources
- Dashboard access button
- Mobile-responsive design

### 3. Invite Acceptance Notifications

**Trigger:** Automatically sent to company owner when a subcontractor accepts an invite

**Features:**
- Confirmation that subcontractor joined
- Subcontractor details (name, email)
- Link to subcontractors management page

## Email Templates

All email templates are located in `functions/src/email.ts` and feature:

- **Professional Design:** Gradient header, clean layout
- **Brand Colors:** Blue/indigo theme matching CrewQuo branding
- **Mobile Responsive:** Works perfectly on all devices
- **Accessible:** Proper HTML structure and alt text
- **Clear CTAs:** Prominent buttons for actions

### Customizing Templates

To customize the email templates:

1. Open `functions/src/email.ts`
2. Modify the HTML in the respective function:
   - `sendSubcontractorInviteEmail()` - Invite emails
   - `sendRegistrationConfirmationEmail()` - Welcome emails
   - `sendInviteAcceptedNotificationEmail()` - Notification emails
3. Test locally with Firebase Emulators
4. Deploy changes with `firebase deploy --only functions`

## Testing

### Local Testing with Firebase Emulators

1. Start the emulators:
```bash
npm run emu
```

2. Create a test subcontractor with invite:
```bash
npm run seed
```

3. Check the Firebase console logs to see email sending attempts

### Production Testing

1. Create a subcontractor with a real email address
2. Check Resend dashboard for delivery status
3. Verify email receipt and appearance

## Monitoring

### Resend Dashboard

Monitor your emails in the Resend dashboard:
- **Emails:** View all sent emails and their status
- **Logs:** Check delivery logs and errors
- **Analytics:** See open rates and click rates
- **Webhooks:** Set up webhooks for delivery events (optional)

### Firebase Logs

Check Firebase Functions logs:
```bash
firebase functions:log
```

Look for:
- `Invite email sent to [email]` - Success
- `Failed to send invite email: [error]` - Error

## Troubleshooting

### Emails Not Sending

**Problem:** Emails not being sent

**Solutions:**
1. Check API key is correctly set in Firebase Functions config
2. Verify domain is properly configured in Resend
3. Check Firebase Functions logs for errors
4. Ensure you're not on Resend's free tier limits (100 emails/day)

### Emails Going to Spam

**Problem:** Emails landing in spam folder

**Solutions:**
1. Ensure SPF, DKIM records are properly configured
2. Add DMARC record for better deliverability
3. Warm up your domain by sending gradually increasing volumes
4. Ask recipients to whitelist support@crewquo.com

### Domain Verification Issues

**Problem:** Domain not verifying in Resend

**Solutions:**
1. Double-check DNS records are exactly as provided
2. Wait 24-48 hours for DNS propagation
3. Use a DNS checker tool to verify records are live
4. Contact Resend support if issues persist

### Wrong Sender Email

**Problem:** Emails showing wrong "from" address

**Solutions:**
1. Verify domain is fully verified in Resend
2. Update `FROM_EMAIL` constant in `functions/src/email.ts`
3. Redeploy functions after making changes

## Resend Pricing

### Free Tier
- 100 emails per day
- 1 domain
- All features included
- Perfect for development/testing

### Paid Plans
- From $20/month for 10,000 emails/month
- Additional emails at $1 per 1,000
- Multiple domains
- Priority support
- See [Resend Pricing](https://resend.com/pricing) for details

## Security Best Practices

1. **API Key Security:**
   - Never commit API keys to git
   - Use Firebase Functions config or environment variables
   - Rotate keys periodically

2. **Email Content:**
   - Don't include sensitive information in emails
   - Use secure HTTPS links only
   - Implement rate limiting to prevent abuse

3. **Invite Token Security:**
   - Tokens are single-use only
   - Tokens are validated server-side
   - Expired invites cannot be used

## Advanced Configuration

### Custom Email Templates

To use your own HTML email templates:

1. Create a new file: `functions/src/email-templates/`
2. Export template functions
3. Import and use in `email.ts`

### Email Scheduling

To schedule emails for later:

```typescript
// Add to Firestore with scheduled time
await db.collection('scheduledEmails').add({
  type: 'invite',
  recipientEmail: email,
  data: { ... },
  scheduledFor: futureTimestamp,
  status: 'pending'
});

// Create a scheduled function to process queue
export const processScheduledEmails = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    // Process scheduled emails
  });
```

### Email Analytics

Track email opens and clicks:

1. Set up Resend webhooks in your dashboard
2. Create a webhook endpoint in Firebase Functions
3. Store events in Firestore for analytics

## Support

### Resend Support
- Documentation: [https://resend.com/docs](https://resend.com/docs)
- Discord: [https://resend.com/discord](https://resend.com/discord)
- Email: support@resend.com

### CrewQuo Email System
- For issues with the email system implementation
- Check Firebase Functions logs first
- Review this documentation for troubleshooting steps

## Changelog

### v1.0.0 (December 2024)
- Initial implementation with Resend
- Subcontractor invite emails
- Registration confirmation emails
- Invite acceptance notifications
- Automatic email triggers via Firestore
- Manual email sending via callable functions

## Future Enhancements

Planned improvements:
- [ ] Email preferences for users
- [ ] Weekly digest emails
- [ ] Project status update emails
- [ ] Payment reminder emails
- [ ] Time log approval notifications
- [ ] Custom email templates per company
- [ ] Email tracking and analytics dashboard
