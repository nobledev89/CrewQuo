# Deploying CrewQuo to Custom Domain with Cloudflare

## Overview
This guide covers deploying your Next.js + Firebase app to your custom Namecheap domain using Cloudflare for DNS and free SSL/TLS certificates.

## 🚨 Important: Configuration Issue Detected

Your current setup has a configuration mismatch:
- `firebase.json` points to `out` directory (expects static export)
- `next.config.js` lacks `output: 'export'` (won't generate static files)
- Your app uses dynamic features (API routes, Firebase Functions)

**You need to choose a deployment strategy:**

### Option A: Firebase Hosting + Cloud Functions (Recommended)
Best for your current setup since you're already using Firebase Functions.

### Option B: Vercel + Firebase Backend
Better Next.js support but requires more migration work.

---

## Option A: Firebase Hosting + Cloudflare DNS (Recommended)

### Step 1: Fix Next.js Configuration

Since your app uses Firebase Functions and likely needs SSR, you should either:

**Choice 1: Static Export (Simpler but limited)**
If your app can work as a static site:

```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // Add this line
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};
```

**Choice 2: Server-Side Rendering with Firebase Functions**
For dynamic features, update firebase.json:

```json
{
  "hosting": {
    "public": ".next",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "function": "nextjsServer"
      }
    ]
  }
}
```

Then create a Firebase Function to serve Next.js (requires additional setup).

### Step 2: Build Your App

```bash
# Install dependencies
npm install

# Build Next.js app
npm run build

# If using static export, this creates the 'out' directory
# If not, you'll need custom Firebase Functions setup
```

### Step 3: Deploy to Firebase

```bash
# Make sure you're logged in to Firebase
firebase login

# Deploy everything (hosting, functions, firestore, storage)
npm run deploy

# Or deploy only hosting if you've already deployed functions
firebase deploy --only hosting
```

After deployment, Firebase will give you a URL like:
`https://projects-corporatespec.web.app` or `.firebaseapp.com`

### Step 4: Configure Custom Domain in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `projects-corporatespec`
3. Go to **Hosting** in the left sidebar
4. Click **Add custom domain**
5. Enter your domain (e.g., `yourdomain.com`)
6. Firebase will provide DNS records to configure

**You'll see two types of records:**
- **A record** or **CNAME record** for your domain
- **TXT record** for domain verification

### Step 5: Configure Cloudflare DNS

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Add your domain if you haven't already:
   - Click **Add a Site**
   - Enter your Namecheap domain
   - Select the Free plan
   - Cloudflare will scan your existing DNS records

3. **Update Namecheap Nameservers:**
   - Go to [Namecheap Dashboard](https://ap.www.namecheap.com/)
   - Find your domain → Click **Manage**
   - Under **Nameservers**, select **Custom DNS**
   - Enter Cloudflare's nameservers (shown in Cloudflare dashboard):
     ```
     Example:
     anya.ns.cloudflare.com
     rick.ns.cloudflare.com
     ```
   - Save changes (can take 24-48 hours to propagate)

4. **Add Firebase DNS Records in Cloudflare:**
   - Go to Cloudflare → **DNS** → **Records**
   - Add the records provided by Firebase:

   **For root domain (yourdomain.com):**
   ```
   Type: A
   Name: @
   IPv4 address: [IP provided by Firebase]
   Proxy status: DNS only (orange cloud OFF initially)
   TTL: Auto
   ```

   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Target: [Firebase target provided]
   Proxy status: DNS only (orange cloud OFF initially)
   TTL: Auto
   ```

   **For domain verification:**
   ```
   Type: TXT
   Name: @
   Content: [Verification code from Firebase]
   TTL: Auto
   ```

5. **Important:** Start with "DNS only" (gray cloud, not proxied)
   - This allows Firebase to provision SSL certificates
   - Once verified, you can enable Cloudflare proxy if needed

### Step 6: Verify Domain in Firebase

1. Return to Firebase Console → Hosting → Custom domains
2. Click **Verify** or wait for automatic verification
3. Firebase will check DNS records (may take a few minutes)
4. Once verified, Firebase will provision free SSL certificate
5. Domain status will change to "Connected"

### Step 7: Enable Cloudflare Proxy (Optional)

After Firebase shows "Connected":
1. Go back to Cloudflare DNS settings
2. Click the gray cloud icon next to your A/CNAME records
3. Turn it orange to enable Cloudflare proxy
4. This adds Cloudflare's CDN, DDoS protection, and additional SSL features

**Cloudflare SSL Settings:**
- Go to SSL/TLS → Overview
- Set encryption mode to **Full (strict)** or **Full**
- This ensures traffic is encrypted between Cloudflare ↔ Firebase ↔ Users

### Step 8: Configure Environment Variables

Make sure your production environment variables are set:

```bash
# In Firebase Console → Functions → Configuration
firebase functions:config:set \
  lemonsqueezy.api_key="YOUR_LEMON_SQUEEZY_API_KEY" \
  lemonsqueezy.webhook_secret="YOUR_WEBHOOK_SECRET"
```

Or use `.env` variables in your Firebase Functions.

### Step 9: Test Your Live Site

1. Visit `https://yourdomain.com`
2. Check SSL certificate (should show valid)
3. Test key functionality:
   - User authentication
   - Database operations
   - File uploads
   - Payment webhooks

---

## Option B: Deploy to Vercel + Cloudflare

If you prefer Vercel for better Next.js support:

### Step 1: Prepare for Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login
```

### Step 2: Deploy to Vercel

```bash
# From your project directory
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set project name
# - Configure settings
```

### Step 3: Configure Environment Variables in Vercel

In Vercel Dashboard → Your Project → Settings → Environment Variables:
- Add all variables from your `.env.local`
- Set them for Production, Preview, and Development

### Step 4: Configure Custom Domain in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click **Add**
3. Enter your domain (e.g., `yourdomain.com`)
4. Vercel will provide DNS configuration

### Step 5: Configure Cloudflare DNS for Vercel

In Cloudflare DNS:

```
Type: CNAME
Name: @
Target: cname.vercel-dns.com
Proxy status: DNS only (initially)
TTL: Auto
```

```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy status: DNS only (initially)
TTL: Auto
```

### Step 6: Verify and Enable SSL

1. Wait for Vercel to verify domain (few minutes)
2. Vercel automatically provisions SSL
3. Enable Cloudflare proxy (orange cloud) if desired
4. Set SSL/TLS mode to **Full** in Cloudflare

---

## Troubleshooting

### DNS Not Propagating
- Check propagation: https://dnschecker.org/
- Wait 24-48 hours for nameserver changes
- Clear browser cache

### SSL Certificate Issues
- Make sure Cloudflare proxy is OFF during initial setup
- Use "DNS only" until Firebase/Vercel verifies domain
- Check SSL mode is set to "Full" or "Full (strict)"

### 404 Errors After Deployment
- Check `firebase.json` rewrites configuration
- Ensure Next.js build completed successfully
- Verify `out` directory exists and has content

### Firebase Functions Not Working
- Check function logs: `firebase functions:log`
- Verify environment variables are set
- Ensure functions are deployed: `firebase deploy --only functions`

### Webhook Fails After Domain Change
- Update webhook URL in Lemon Squeezy dashboard
- Change from Firebase URL to your custom domain
- Test webhook: `https://yourdomain.com/api/webhooks/lemonsqueezy`

---

## Recommended Configuration

Based on your app structure, I recommend:

1. **Use Firebase Hosting + Functions** (Option A)
   - You're already using Firebase extensively
   - Functions, Firestore, Storage already configured
   - Free SSL included
   - Good performance with Cloudflare CDN

2. **Fix the Next.js configuration first:**
   - Decide if you need SSR or can use static export
   - If static: add `output: 'export'` to next.config.js
   - If SSR: set up Next.js with Firebase Functions (more complex)

3. **Use Cloudflare for:**
   - DNS management
   - Additional CDN/caching
   - DDoS protection
   - Analytics

---

## Quick Start Commands

```bash
# 1. Build your app
npm run build

# 2. Deploy to Firebase
npm run deploy

# 3. Configure custom domain in Firebase Console
# (Follow steps above)

# 4. Update Namecheap nameservers to Cloudflare
# (Follow steps above)

# 5. Add Firebase DNS records in Cloudflare
# (Follow steps above)

# 6. Wait for verification and SSL provisioning
# (Usually takes 5-15 minutes)

# 7. Test your live site
# Open https://yourdomain.com
```

---

## Need Help?

If you run into issues:
1. Check Firebase Console for deployment status
2. Check Cloudflare DNS for record configuration
3. Use browser dev tools to debug
4. Check Firebase Functions logs for backend issues

---

## Summary Checklist

- [ ] Choose deployment strategy (Firebase or Vercel)
- [ ] Fix Next.js configuration (add `output: 'export'` if needed)
- [ ] Build and deploy app
- [ ] Add custom domain in hosting provider
- [ ] Transfer nameservers to Cloudflare (in Namecheap)
- [ ] Configure DNS records in Cloudflare
- [ ] Verify domain and wait for SSL
- [ ] Enable Cloudflare proxy (optional)
- [ ] Update webhook URLs
- [ ] Test live site thoroughly
