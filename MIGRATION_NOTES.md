# Migration to Static Export + Firebase Functions

## What Changed

We've migrated your app from Next.js API routes to a static export with Firebase Functions, making it ready for deployment to your custom domain.

### Changes Made:

1. **✅ Created Firebase Function for Webhook**
   - Migrated `/app/api/webhooks/lemonsqueezy/route.ts` to Firebase Function
   - New function: `lemonsqueezyWebhook` in `functions/src/index.ts`
   - URL will change from `/api/webhooks/lemonsqueezy` to Firebase Function endpoint

2. **✅ Updated next.config.js**
   - Added `output: 'export'` to generate static files
   - This creates an `out` directory with all static HTML/JS/CSS

3. **✅ Updated firebase.json**
   - Added `cleanUrls: true` for better URL structure
   - Hosting configuration already pointed to `out` directory

4. **✅ Removed API Routes Directory**
   - Deleted `/app/api` directory since it's no longer compatible with static export
   - All API logic now handled by Firebase Functions

---

## Important: Update Webhook URL

After deploying, you **MUST** update your Lemon Squeezy webhook URL:

### Old URL (won't work anymore):
```
https://your-domain.com/api/webhooks/lemonsqueezy
```

### New URL (Firebase Function):
```
https://us-central1-projects-corporatespec.cloudfunctions.net/lemonsqueezyWebhook
```

**Or with custom domain after Firebase hosting is connected:**
```
https://your-domain.com/__/functions/lemonsqueezyWebhook
```

### Steps to Update Webhook:
1. Go to [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com/)
2. Navigate to Settings → Webhooks
3. Edit your existing webhook
4. Update the URL to the new Firebase Function endpoint
5. Keep the same webhook secret
6. Save changes

---

## Environment Variables Setup

Before deploying, ensure your Firebase Functions have the webhook secret configured:

### Method 1: Using Firebase CLI (Recommended)
```bash
firebase functions:config:set lemonsqueezy.webhook_secret="YOUR_WEBHOOK_SECRET_HERE"
```

### Method 2: Using Environment Variables (Alternative)
Add to your Firebase Functions environment:
- Go to Firebase Console → Functions → Configuration
- Add: `LEMONSQUEEZY_WEBHOOK_SECRET`
- Value: Your webhook secret from Lemon Squeezy

---

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
cd functions
npm install
cd ..
```

### 2. Build Functions
```bash
cd functions
npm run build
cd ..
```

### 3. Build Next.js App
```bash
npm run build
```

This will create the `out` directory with your static site.

### 4. Deploy Everything
```bash
# Deploy hosting and functions together
npm run deploy

# Or deploy separately
firebase deploy --only functions
firebase deploy --only hosting
```

### 5. Test the Webhook Function
```bash
# Get the function URL
firebase functions:list

# Or check in Firebase Console
# Functions → lemonsqueezyWebhook → URL
```

---

## Testing Locally

Before deploying to production, you can test locally:

### 1. Start Emulators
```bash
npm run emu
```

This starts:
- Firebase Hosting (port 5000)
- Firebase Functions (port 5001)
- Firestore (port 8080)
- Auth (port 9099)
- Functions UI (port 4000)

### 2. Test Webhook Locally
```bash
# The webhook endpoint will be available at:
http://localhost:5001/projects-corporatespec/us-central1/lemonsqueezyWebhook
```

### 3. Build Static Site
```bash
npm run build
```

Then serve from `out` directory through emulator at `http://localhost:5000`

---

## Verification Checklist

After deployment:

- [ ] Build completes successfully (`npm run build`)
- [ ] `out` directory is created with static files
- [ ] Functions deploy successfully
- [ ] Hosting deploys successfully
- [ ] Can access site at Firebase hosting URL
- [ ] Webhook function is accessible
- [ ] Updated Lemon Squeezy webhook URL
- [ ] Test webhook with a test event
- [ ] Custom domain configured in Firebase
- [ ] DNS configured in Cloudflare
- [ ] SSL certificate provisioned
- [ ] Site accessible via custom domain

---

## Rollback Plan

If something goes wrong, you can rollback:

```bash
# Rollback hosting to previous deployment
firebase hosting:rollback

# Rollback functions to previous deployment
firebase functions:rollback
```

Or restore from git:
```bash
git checkout HEAD~1 next.config.js
git checkout HEAD~1 firebase.json
git restore app/api
git checkout HEAD~1 functions/src/index.ts
```

---

## Known Limitations

With static export, these Next.js features are NOT available:

- ❌ API Routes (we migrated to Firebase Functions)
- ❌ Server-side Rendering (SSR)
- ❌ Incremental Static Regeneration (ISR)
- ❌ Dynamic routes with `getServerSideProps`
- ❌ Image Optimization API (already using `unoptimized: true`)
- ❌ Internationalized Routing
- ❌ Middleware

Your app now works as:
- ✅ Static HTML/JS/CSS served by Firebase Hosting
- ✅ Client-side Firebase SDK for auth/firestore/storage
- ✅ Firebase Functions for backend logic (webhooks, etc.)
- ✅ All user interactions happen client-side
- ✅ Firebase Functions handle server-side operations

---

## Monitoring

After deployment, monitor your app:

### Firebase Console
- **Hosting**: Check deploy status and traffic
- **Functions**: Monitor invocations, errors, and logs
- **Firestore**: Database operations
- **Authentication**: User sign-ins

### Function Logs
```bash
# View real-time logs
firebase functions:log

# View specific function logs
firebase functions:log --only lemonsqueezyWebhook

# View logs in Firebase Console
# Functions → lemonsqueezyWebhook → Logs
```

### Cloudflare Analytics
- Traffic and bandwidth
- Cache hit ratio
- Security threats blocked
- Performance metrics

---

## Support

If you encounter issues:

1. **Build Errors**: Check `npm run build` output
2. **Function Errors**: Check `firebase functions:log`
3. **Deployment Errors**: Check Firebase Console → Hosting/Functions
4. **Webhook Issues**: Check Function logs and Lemon Squeezy webhook attempts
5. **DNS Issues**: Use https://dnschecker.org/ to verify propagation

---

## Next Steps

1. ✅ Review this migration document
2. ✅ Follow deployment steps in DEPLOYMENT.md
3. ✅ Build and deploy your app
4. ✅ Configure custom domain
5. ✅ Update webhook URL in Lemon Squeezy
6. ✅ Test thoroughly
7. ✅ Monitor for any issues

Good luck with your deployment! 🚀
