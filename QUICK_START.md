# Quick Start Guide - Deploy to Custom Domain

## ✅ Configuration Complete!

All code changes have been made. Your app is now ready to deploy with static export + Firebase Functions.

---

## 🚀 Deploy Now (3 Steps)

### Step 1: Set Webhook Secret
```bash
firebase functions:config:set lemonsqueezy.webhook_secret="YOUR_SECRET_HERE"
```

Replace `YOUR_SECRET_HERE` with your actual Lemon Squeezy webhook secret.

### Step 2: Build & Deploy

**⚠️ Windows Users: If you get "EPERM" error, use the build script:**
```powershell
# Use the automated clean build script (recommended)
.\build-clean.ps1

# Or manually clean first
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
npm run build
```

**Standard build (all platforms):**
```bash
# Build Next.js static site (creates 'out' directory)
npm run build

# Deploy everything to Firebase
npm run deploy
```

### Step 3: Configure Custom Domain

#### A. In Firebase Console:
1. Go to https://console.firebase.google.com/
2. Select project: `projects-corporatespec`
3. Go to **Hosting** → **Add custom domain**
4. Enter your Namecheap domain
5. Copy the DNS records provided by Firebase

#### B. In Cloudflare:
1. Go to https://dash.cloudflare.com/
2. Add your site (if not added)
3. Update Namecheap nameservers to Cloudflare's (shown in Cloudflare)
4. Add DNS records from Firebase:
   - **A record**: @ → Firebase IP
   - **CNAME record**: www → Firebase target
   - **TXT record**: @ → Verification code
5. Keep "DNS only" (gray cloud) until verified
6. After verification, enable proxy (orange cloud) if desired

---

## ⚠️ Critical: Update Webhook URL

After deployment, update your Lemon Squeezy webhook:

**Old URL:** ~~`/api/webhooks/lemonsqueezy`~~ (deleted)

**New URL:** `https://us-central1-projects-corporatespec.cloudfunctions.net/lemonsqueezyWebhook`

Or with custom domain: `https://yourdomain.com/__/functions/lemonsqueezyWebhook`

1. Go to https://app.lemonsqueezy.com/
2. Settings → Webhooks → Edit webhook
3. Update URL to new Firebase Function endpoint
4. Save changes

---

## 📋 What Changed

✅ **Migrated webhook** from `/app/api/webhooks/lemonsqueezy/route.ts` to Firebase Function  
✅ **Added static export** to `next.config.js`  
✅ **Configured hosting** in `firebase.json`  
✅ **Deleted API routes** directory (not compatible with static export)  
✅ **Built Functions** successfully  

---

## 🧪 Test Locally (Optional)

```bash
# Start emulators
npm run emu

# In another terminal, build the app
npm run build

# Access:
# - Site: http://localhost:5000
# - Webhook: http://localhost:5001/projects-corporatespec/us-central1/lemonsqueezyWebhook
```

---

## 📖 Documentation

- **DEPLOYMENT.md** - Full deployment guide with Cloudflare setup
- **MIGRATION_NOTES.md** - Detailed migration info and troubleshooting
- **This file** - Quick start for immediate deployment

---

## 🆘 Troubleshooting

### Build fails with "EPERM" error (Windows)
```powershell
# Use the automated script
.\build-clean.ps1

# Or see BUILD_FIX.md for detailed solutions
```

**Common causes:**
- VS Code has files locked (close VS Code completely)
- Antivirus scanning the directory
- Previous Node process still running

### Function deployment fails
```bash
# Check Functions build
cd functions
npm run build
cd ..
```

### DNS not propagating
- Wait 24-48 hours for nameserver changes
- Check status: https://dnschecker.org/

### Webhook not working
- Check function logs: `firebase functions:log --only lemonsqueezyWebhook`
- Verify secret is set: `firebase functions:config:get`
- Test webhook from Lemon Squeezy dashboard

---

## ✅ Deployment Checklist

- [ ] Set webhook secret: `firebase functions:config:set lemonsqueezy.webhook_secret="..."`
- [ ] Build app: `npm run build`
- [ ] Deploy: `npm run deploy`
- [ ] Add custom domain in Firebase Console
- [ ] Update Namecheap nameservers to Cloudflare
- [ ] Configure DNS records in Cloudflare
- [ ] Wait for domain verification (5-15 min)
- [ ] Update Lemon Squeezy webhook URL
- [ ] Test webhook
- [ ] Verify site is live

---

## 🎉 You're Ready!

Everything is configured. Just follow the 3 steps above and your app will be live on your custom domain with free SSL from Cloudflare!

**Firebase Project:** projects-corporatespec  
**Hosting:** Firebase Hosting + Cloudflare CDN  
**Functions:** Node.js 20 (including webhook handler)  
**Database:** Firestore  
**Auth:** Firebase Authentication  
**Storage:** Firebase Storage  

Good luck! 🚀
