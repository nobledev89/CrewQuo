# CrewQuo - Multi-Tenant Contractor Management SaaS

A production-grade, multi-tenant SaaS application built on Google Firebase for contractor companies to manage projects, subcontractors, shift-based rate cards, time logs, and expenses.

## 🏗️ Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Firebase Cloud Functions v2 (Node 20)
- **Database**: Cloud Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Hosting**: Firebase Hosting
- **Testing**: Vitest, @firebase/rules-unit-testing, Playwright

## 📋 Features

- ✅ **Multi-tenant isolation** with companyId enforced in security rules
- ✅ **Complex rate-card resolution** (role + shift label + effective dates)
- ✅ **Shift-based time tracking** with automatic cost/bill calculation
- ✅ **Expense management** with receipt uploads
- ✅ **Role-based permissions** (ADMIN, MANAGER, SUBCONTRACTOR)
- ✅ **Project KPIs** with real-time margin calculations
- ✅ **Approval workflows** for time logs and expenses
- ✅ **Firebase Emulator** support for local development

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Firebase CLI: `npm install -g firebase-tools`
- Java Runtime (for Firestore emulator)

### 1. Installation

```bash
# Install root dependencies
npm install

# Install function dependencies
cd functions
npm install
cd ..
```

### 2. Firebase Project Setup

```bash
# Login to Firebase
firebase login

# Create a new Firebase project or use existing
# Update .firebaserc with your project ID
```

### 3. Environment Configuration

```bash
# Copy the example env file
cp .env.local.example .env.local

# Edit .env.local with your Firebase config
# For local development, set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

### 4. Local Development with Emulators

```bash
# Start Firebase emulators
firebase emulators:start

# In a new terminal, seed the database
FIRESTORE_EMULATOR_HOST="localhost:8080" npm run seed

# In another terminal, start Next.js dev server
npm run dev:next

# Or use concurrently to run both:
npm run dev
```

Access the app at:
- **App**: http://localhost:3000
- **Emulator UI**: http://localhost:4000

### 5. Set User Claims (for testing)

After creating a user via the UI or emulator, set their claims:

```bash
# Set claims for local emulator
FIRESTORE_EMULATOR_HOST="localhost:8080" npm run set-claims user@example.com ADMIN corporate-spec
```

## 📁 Project Structure

```
CrewQuo/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── dashboard/         # Admin/Manager dashboard
│   ├── projects/          # Project management
│   ├── time/              # Time log entry
│   └── globals.css        # Global styles
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility libraries
│   ├── firebase.ts       # Firebase client SDK init
│   └── firestore.ts      # Firestore queries
├── functions/             # Cloud Functions
│   └── src/
│       ├── index.ts      # Main function exports
│       ├── rates.ts      # Rate resolution engine
│       ├── auth.ts       # Auth helpers
│       └── validators.ts # Zod schemas
├── scripts/              # Utility scripts
│   ├── seed.ts          # Database seeder
│   └── set-claims.ts    # Set custom user claims
├── tests/               # Tests
│   ├── rules.spec.ts   # Security rules tests
│   ├── rates.spec.ts   # Rate calculation tests
│   └── e2e/            # Playwright E2E tests
├── firestore.rules      # Firestore security rules
├── storage.rules        # Storage security rules
├── firestore.indexes.json # Composite indexes
└── firebase.json        # Firebase configuration
```

## 🔐 Security Rules

Multi-tenant isolation is enforced at the database level:

- Every document has a `companyId` field
- All queries are filtered by the user's `companyId` from custom claims
- Role-based permissions for ADMIN, MANAGER, SUBCONTRACTOR
- APPROVED time logs and expenses are immutable

## 💰 Rate Card System

The rate resolution engine:

1. Queries rate cards matching: companyId, targetType (SUBCONTRACTOR/CLIENT), targetId, roleId, rateLabel
2. Filters by effectiveFrom <= date and effectiveTo >= date (or null)
3. Selects most recent rate card
4. Calculates costs/bills based on hours and rates
5. Stores resolved snapshot on time logs for audit

Shift types:
- **WEEKDAY_DAY**: Mon-Fri Day (maps to "Mon–Fri Day")
- **NIGHT**: Night shifts (maps to "Mon–Thurs Night")
- **SUNDAY**: Sunday premium (maps to "Sunday")
- **SHIFT**: Fixed shift rate
- **DAILY**: Fixed daily rate

## 📊 Data Model

### Collections

- **companies**: Tenant companies
- **users**: User accounts with role
- **roleCatalog**: Job roles (Electrician, Plumber, etc.)
- **clients**: Client companies
- **subcontractors**: Contractor workers
- **projects**: Client projects
- **projectAssignments**: Subcontractor-to-project assignments
- **rateCards**: Rate definitions (sub cost + client bill)
- **timeLogs**: Time entries with resolved rates
- **expenses**: Expenses with receipts

## 🧪 Testing

### Run Security Rules Tests

```bash
npm run test:rules
```

### Run Unit Tests

```bash
npm test
```

### Run E2E Tests

```bash
# Start emulators and app first
npm run dev

# In another terminal
npm run test:e2e
```

## 🚀 Deployment

### 1. Build Functions

```bash
cd functions
npm run build
cd ..
```

### 2. Build Next.js

```bash
npm run build
```

### 3. Deploy to Firebase

```bash
# Deploy everything
npm run deploy

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
```

### 4. Region Selection

When deploying Cloud Functions, consider:
- **europe-west2** (London) for UK/EU
- **us-central1** for US
- Update function region in `functions/src/index.ts` if needed

### 5. Enable Services

In Firebase Console:
- Enable Authentication (Email/Password + Google)
- Enable Firestore Native mode
- Enable Storage
- Enable Cloud Functions
- (Optional) Enable BigQuery export for analytics

## 📈 Post-Deployment

### Set up first admin user

1. Create user via Authentication console or sign up flow
2. Set custom claims using Firebase CLI:

```bash
firebase functions:shell
# Then in shell:
admin.auth().setCustomUserClaims('USER_UID', { companyId: 'your-company', role: 'ADMIN' })
```

### Monitor & Logs

```bash
# View function logs
firebase functions:log

# Or in Firebase Console > Functions > Logs
```

## 🎯 Sample Data

The seed script creates:
- Company: "Corporate Spec"
- Client: "PwC"
- 2 Subcontractors (John Smith, Jane Doe)
- Project: "PwC Office Refit"
- Rate cards for Electrician role
- Sample approved time log
- Sample expenses

## 🔧 Development Tips

### Emulator Data Persistence

```bash
# Export data
npm run emu:export

# Import on next start
npm run emu:import
```

### Hot Reload Functions

```bash
cd functions
npm run build:watch
```

### Clear Emulator Data

Delete the `firebase-debug.log` and restart emulators.

## 📝 Environment Variables

Required for production:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

For development with emulators:
```env
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

## 🐛 Troubleshooting

### Emulator Connection Issues

Ensure ports are free:
- 3000: Next.js
- 4000: Emulator UI
- 5001: Functions
- 8080: Firestore
- 9099: Auth
- 9199: Storage

### Custom Claims Not Working

1. User must sign out and sign in after claims are set
2. Verify claims in emulator Auth UI
3. Check browser console for token

### Index Errors

Deploy indexes before querying:
```bash
firebase deploy --only firestore:indexes
```

Wait for indexes to build (check Console > Firestore > Indexes).

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## 📄 License

Proprietary - All Rights Reserved

## 🤝 Support

For issues and questions, contact the development team.

---

**Built with ❤️ for contractor management excellence**
