# Deployment Guide

Deploy CrewQuo to production on Vercel.

---

## Overview

- **Platform**: Vercel (optimal for Next.js)
- **Domain**: crewquo.com (custom domain configured)
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Repository**: https://github.com/nobledev89/CrewQuo

---

## Initial Deployment

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### 2. Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository: `nobledev89/CrewQuo`
3. Vercel auto-detects Next.js settings ✅
4. **Before deploying**, add environment variables (see below)
5. Click **Deploy**
6. Wait 2-3 minutes

### 3. Add Environment Variables

In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**:

```env
# Firebase Configuration (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_value
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_value
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_value
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_value
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_value
NEXT_PUBLIC_FIREBASE_APP_ID=your_value

# Firebase Admin SDK (Server-side) - Required for API routes (create-user, etc.)
# Get these from Firebase Console → Project Settings → Service Accounts → Generate new private key
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY...\n-----END PRIVATE KEY-----\n"

# Gumroad Configuration
NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK=zxjxzj

# Email Configuration (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Application URL
APP_URL=https://crewquo.com
```

**Important**: 
- Apply to all environments (Production, Preview, Development)
- For `FIREBASE_ADMIN_PRIVATE_KEY`: When pasting in Vercel, replace `\n` with actual newlines, or wrap the entire value in double quotes

### 4. Configure Custom Domain

1. In Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add `crewquo.com`
3. Update DNS records at your domain registrar:
   - **Type**: A Record
   - **Name**: @
   - **Value**: `76.76.21.21` (Vercel's IP)
   - **Type**: CNAME
   - **Name**: www
   - **Value**: `cname.vercel-dns.com`
4. Wait ~10 minutes for DNS propagation

---

## Firebase Functions Deployment

Deploy Cloud Functions separately:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

---

## Continuous Deployment

**Automatic**: Every `git push` to `main` triggers automatic Vercel deployment

### Deploy Preview (Test Branch)
```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
```
Vercel automatically creates a preview URL for testing

---

## Post-Deployment Checklist

- [ ] Test authentication (sign up, login, logout)
- [ ] Verify Firebase connection (create a client, project)
- [ ] Check all dynamic routes work (`/dashboard/clients/[id]`)
- [ ] Test on mobile device
- [ ] Verify SSL certificate (https://)
- [ ] Check environment variables are loaded
- [ ] Test rate card assignment
- [ ] Verify subcontractor invitation flow

---

## Monitoring & Logs

### Vercel Logs
- Go to Vercel Dashboard → Your Project → **Deployments**
- Click on a deployment → **Functions** tab
- View runtime logs

### Firebase Logs
```bash
firebase functions:log
```

---

## Rollback

If deployment fails:

1. Go to Vercel Dashboard → **Deployments**
2. Find previous working deployment
3. Click **⋯** → **Promote to Production**

---

## Update Deployment

```bash
# Make changes
git add .
git commit -m "Update: description"
git push origin main

# Vercel auto-deploys in ~2 minutes
```

---

## Environment-Specific Deployments

### Production
- Branch: `main`
- URL: https://crewquo.com
- Auto-deploy on push

### Staging (Optional)
```bash
# Create staging branch
git checkout -b staging
git push origin staging

# Configure in Vercel:
# Settings → Git → Production Branch → staging
```

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all environment variables are set
- Test build locally: `npm run build`

### Functions Not Working
- Deploy Firebase Functions: `firebase deploy --only functions`
- Check Firebase Functions logs
- Verify Firestore rules

### Custom Domain Not Working
- Verify DNS settings (can take up to 48 hours)
- Check SSL certificate status in Vercel
- Try accessing via Vercel URL first

---

## Performance Optimization

- Images are already optimized (`unoptimized: true` in config)
- Static pages are cached automatically
- Dynamic routes use server-side rendering

---

## Security Checklist

- [x] `.env.local` not pushed to GitHub
- [x] Firebase rules deployed
- [x] Authentication required for dashboard
- [x] Role-based access control implemented
- [x] API keys stored in environment variables
- [x] HTTPS enabled (Vercel default)
