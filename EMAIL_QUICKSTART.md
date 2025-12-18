# Email System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Sign up for Resend (Free)
Visit [https://resend.com](https://resend.com) and create an account.

### 2. Get Your API Key
1. Go to **API Keys** in Resend dashboard
2. Click **Create API Key**
3. Copy the key (starts with `re_`)

### 3. Add to Environment Variables

**For Production (Firebase Functions):**
```bash
firebase functions:config:set resend.api_key="re_your_key_here"
firebase functions:config:set app.url="https://crewquo.com"
```

**For Local Development:**
Add to your `.env.local`:
```env
RESEND_API_KEY=re_your_key_here
APP_URL=http://localhost:3000
```

### 4. Configure Domain (Required for production)

1. In Resend dashboard → **Domains** → **Add Domain**
2. Enter: `crewquo.com`
3. Add the DNS records provided to your domain registrar
4. Wait for verification (up to 48 hours)

### 5. Deploy

```bash
npm run functions:build
firebase deploy --only functions
```

## ✅ What Works Now

### Automatic Emails

1. **Subcontractor Invites** 
   - Sent automatically when you create a subcontractor with "Generate invite link" checked
   - Beautiful branded email with secure invite link
   - From: support@crewquo.com

2. **Registration Confirmation**
   - Sent automatically when new users sign up
   - Includes trial information and getting started guide
   - From: support@crewquo.com

3. **Invite Acceptance Notification**
   - Sent to company owner when subcontractor accepts invite
   - Confirms team member joined
   - From: support@crewquo.com

## 📧 Email Templates

All emails feature:
- ✨ Professional design with CrewQuo branding
- 📱 Mobile-responsive layout
- 🎨 Gradient header with blue/indigo theme
- 🔘 Clear call-to-action buttons
- 🔗 Secure HTTPS links

## 🧪 Testing

### Test Locally (Development)

1. Start emulators:
   ```bash
   npm run emu
   ```

2. Create a test subcontractor with your email address

3. Check console logs for email sending confirmation

### Test in Production

1. Add a subcontractor with a real email
2. Check your inbox
3. Monitor in Resend dashboard

## 📊 Free Tier Limits

Resend Free Tier includes:
- ✅ 100 emails per day
- ✅ 1 verified domain
- ✅ All features included

Perfect for most use cases! Upgrade only if you need more.

## 🆘 Quick Troubleshooting

**Emails not sending?**
- Check API key is set correctly
- Verify domain in Resend dashboard
- Check Firebase Functions logs: `firebase functions:log`

**Emails in spam?**
- Ensure domain is verified
- Add all DNS records (SPF, DKIM, DMARC)
- Ask recipients to whitelist support@crewquo.com

**Need help?**
- See full documentation: `EMAIL_SETUP.md`
- Resend docs: [https://resend.com/docs](https://resend.com/docs)

## 🎯 Next Steps

1. ✅ Set up Resend account
2. ✅ Add API key to environment
3. ✅ Deploy functions
4. ✅ Configure domain
5. ✅ Test with real email
6. 🎉 Start inviting subcontractors!

---

For detailed setup instructions, see [EMAIL_SETUP.md](./EMAIL_SETUP.md)
