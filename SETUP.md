# CrewQuo Setup Guide

Complete setup instructions for getting CrewQuo running with demo data.

## Quick Start with Emulators

### 1. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Start Development Environment

```bash
# Start Firebase emulators and Next.js dev server
npm run dev
```

This command starts:
- Firebase Emulators (Auth, Firestore, Functions, Storage)
- Next.js dev server on http://localhost:3000
- Emulator UI on http://localhost:4000

### 3. Seed the Database

In a new terminal:

```bash
# Windows PowerShell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run seed

# Windows CMD
set FIRESTORE_EMULATOR_HOST=localhost:8080
npm run seed

# Mac/Linux
FIRESTORE_EMULATOR_HOST="localhost:8080" npm run seed
```

This creates the "Corporate Spec" demo company with:
- Company: Corporate Spec
- Client: PriceWater Coopers (PwC)
- 2 Subcontractors (Hanmore & Family Ltd, Pashe Solutions Ltd)
- Project: PwC Office Renovation
- 8 Job roles
- Rate cards for all roles (subcontractor and client rates)
- 1 Sample time log

### 4. Create Admin User

#### Option A: Using Firebase Emulator UI

1. Open http://localhost:4000
2. Go to Authentication tab
3. Click "Add user"
4. Enter:
   - Email: `admin@corporatespec.com`
   - Password: `Password12345`

#### Option B: Using the Signup Page

1. Go to http://localhost:3000/signup
2. Sign up with any email/password

### 5. Set Custom Claims

After creating a user, set their role and company:

```bash
# Windows PowerShell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run set-claims admin@corporatespec.com ADMIN corporate-spec

# Mac/Linux
FIRESTORE_EMULATOR_HOST="localhost:8080" npm run set-claims admin@corporatespec.com ADMIN corporate-spec
```

### 6. Login and Explore

1. Go to http://localhost:3000/login
2. Login with: `admin@corporatespec.com` / `Password12345`
3. Explore the dashboard with real data!

## Environment Configuration

The project is pre-configured for emulator use. For production setup:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# For emulator (default)
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true

# For production
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Using Production Firebase

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication (Email/Password)
4. Create Firestore database (Native mode)
5. Enable Storage

### 2. Update Configuration

```bash
# Login to Firebase
firebase login

# Update .firebaserc with your project ID
# Edit the file and replace "demo-crewquo" with your project ID
```

### 3. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only firestore:indexes
```

### 4. Seed Production Database

```bash
# Make sure FIRESTORE_EMULATOR_HOST is NOT set
npm run seed:prod
```

### 5. Create Admin User

1. Use Firebase Console > Authentication to create user
2. Get the user's UID
3. Set custom claims:

```bash
firebase functions:shell
# In the shell:
admin.auth().setCustomUserClaims('USER_UID', { companyId: 'corporate-spec', role: 'ADMIN' })
```

## Demo Data Details

### Corporate Spec Company

**Client: PriceWater Coopers (PwC)**
- Contact: projects@pwc.com
- Currency: GBP

**Subcontractors:**
1. Hanmore & Family Ltd
   - Email: contact@hanmorefamily.com
   - Phone: +44 7700 900100
   
2. Pashe Solutions Ltd
   - Email: info@pashesolutions.com
   - Phone: +44 7700 900200

**Project:**
- Name: PwC Office Renovation
- Code: PWC-2025-001
- Location: London, UK
- Status: ACTIVE
- Start Date: 1 Jan 2025

**Job Roles (8 total):**
1. Supervisor/heavy gang foreman
2. Foreman/heavy gang porter
3. Fitter Supervisor (Specialist)
4. Fitter
5. Driver
6. Export packer
7. Porter
8. Luton Van

**Rate Cards:**
- 4 shift types per role (Mon-Fri Day, Nights, Saturday, Sunday)
- Client rates (PwC billing rates)
- Subcontractor rates for Hanmore & Family (80% of client rates)
- Subcontractor rates for Pashe Solutions (75% of client rates)
- Total: ~96 rate cards

**Sample Time Log:**
- Date: 15 Jan 2025
- Subcontractor: Hanmore & Family
- Role: Fitter
- Hours: 8 regular + 2 OT
- Status: APPROVED
- Cost: £196.68
- Billing: £245.86
- Margin: £49.18 (20%)

## Troubleshooting

### Ports Already in Use

Change ports in `firebase.json`:
```json
"emulators": {
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "functions": { "port": 5001 },
  "storage": { "port": 9199 },
  "ui": { "port": 4000 }
}
```

### Emulator Won't Start

1. Check Java is installed: `java -version`
2. Clear logs: `rm firebase-debug.log firestore-debug.log`
3. Try: `firebase emulators:start --only firestore,auth`

### Custom Claims Not Working

1. Sign out and sign in after setting claims
2. Check claims in Emulator UI > Authentication > Users
3. Clear browser cache/localStorage

### Can't See Data

1. Check you're using the correct companyId: `corporate-spec`
2. Verify claims are set correctly
3. Check Emulator UI > Firestore to see raw data
4. Look for errors in browser console

## Next Steps

1. **Explore the Application:**
   - Dashboard overview with stats
   - Projects page with PwC project
   - Subcontractors with contact details
   - Time logs with financial breakdown
   - Reports with analytics

2. **Customize Your Instance:**
   - Add your own company data
   - Configure your rate cards
   - Add your clients and subcontractors
   - Set up your projects

3. **Learn the System:**
   - Read [README.md](./README.md) for full documentation
   - Check rate card resolution logic
   - Understand security rules
   - Explore multi-tenant isolation

## Useful Commands

```bash
# Development
npm run dev              # Start everything
npm run dev:next         # Start Next.js only
firebase emulators:start # Start emulators only

# Database
npm run seed            # Seed emulator
npm run seed:prod       # Seed production
npm run set-claims      # Set user claims

# Testing
npm test               # Run unit tests
npm run test:rules     # Test security rules
npm run test:e2e       # Run E2E tests

# Deployment
npm run build          # Build Next.js
npm run deploy         # Deploy everything
```

## Support

For issues:
1. Check browser console for errors
2. Check emulator logs in terminal
3. Verify environment variables
4. Review Firebase Console logs (production)

---

**🎉 Happy building with CrewQuo!**
