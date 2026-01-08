# Development Guide

Complete guide for setting up, developing, and maintaining CrewQuo.

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase CLI: `npm install -g firebase-tools`
- Git

### Initial Setup

1. **Clone Repository**
```bash
git clone https://github.com/nobledev89/CrewQuo.git
cd CrewQuo
```

2. **Install Dependencies**
```bash
npm install
cd functions && npm install && cd ..
```

3. **Configure Environment**

Create `.env.local` in root:
```env
# Firebase Config (from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
APP_URL=http://localhost:3000

# Payment Integration
NEXT_PUBLIC_GUMROAD_PRODUCT_ID=your_product_id
```

4. **Start Development**
```bash
npm run dev
# App runs at http://localhost:3000
```

5. **Start Firebase Emulators** (optional for local testing)
```bash
firebase emulators:start
# Firestore UI at http://localhost:4000
```

---

## Email System Setup

### Quick Setup (5 Minutes)

1. **Sign up for Resend**
   - Visit [resend.com](https://resend.com)
   - Free tier: 100 emails/day

2. **Get API Key**
   - Resend Dashboard → API Keys → Create API Key
   - Copy key (starts with `re_`)

3. **Configure Environment**

   **Local Development** (`.env.local`):
   ```env
   RESEND_API_KEY=re_your_key_here
   APP_URL=http://localhost:3000
   ```

   **Production** (Firebase Functions):
   ```bash
   firebase functions:config:set resend.api_key="re_your_key_here"
   firebase functions:config:set app.url="https://crewquo.com"
   ```

4. **Configure Domain** (Production only)
   - Resend Dashboard → Domains → Add Domain
   - Enter: `crewquo.com`
   - Add DNS records to domain registrar
   - Wait for verification (up to 48 hours)

### Email Features

The system automatically sends:

1. **Subcontractor Invites**
   - Triggered when creating subcontractor with invite option
   - Includes secure invitation link
   - From: support@crewquo.com

2. **Registration Confirmation**
   - Sent on new user signup
   - Includes trial information
   - From: support@crewquo.com

3. **Invite Acceptance Notification**
   - Sent to company owner when subcontractor accepts
   - From: support@crewquo.com

### Testing Emails

**Local Development:**
```bash
npm run emu  # Start emulators
# Create test subcontractor
# Check console logs for email confirmation
```

**Production:**
```bash
npm run functions:build
firebase deploy --only functions
# Create subcontractor with real email
# Monitor in Resend dashboard
```

---

## Architecture Overview

### Frontend (Next.js 15)
- **App Router**: Modern routing with server/client components
- **TypeScript**: Type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Client-Side Rendering**: For Firebase real-time features

### Backend (Firebase)
- **Firestore**: NoSQL database
- **Authentication**: Email/password auth
- **Cloud Functions**: Serverless backend logic
- **Cloud Storage**: File uploads (future)

### Key Features
- Multi-company support with company switching
- Role-based access control (Admin, Manager, Viewer, Subcontractor)
- Dynamic rate card assignment per client-subcontractor
- Project-based subcontractor assignments

---

## Project Structure

```
CrewQuo/
├── app/                          # Next.js pages (App Router)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   ├── login/                   # Auth pages
│   ├── signup/
│   └── dashboard/               # Protected dashboard
│       ├── page.tsx             # Dashboard home
│       ├── clients/             # Client management
│       ├── projects/            # Project management
│       ├── subcontractors/      # Subcontractor management
│       └── ratecards/           # Rate card management
│
├── components/                   # Reusable React components
│   ├── DashboardLayout.tsx      # Main dashboard wrapper
│   └── RateCardForm.tsx         # Rate card forms
│
├── lib/                          # Utilities and contexts
│   ├── firebase.ts              # Firebase client config
│   ├── firebase-admin.ts        # Admin SDK (server-side)
│   ├── types.ts                 # TypeScript types
│   ├── useCompanyContext.ts     # Company switching hook
│   └── ClientFilterContext.tsx  # Client filtering context
│
├── functions/                    # Firebase Cloud Functions
│   └── src/
│       ├── index.ts             # Function exports
│       ├── auth.ts              # Auth triggers
│       └── rates.ts             # Rate calculation logic
│
├── scripts/                      # Database management
│   ├── seed-test-data.ts        # Seed development data
│   └── create-admin-user.ts     # Create admin accounts
│
├── firestore.rules              # Security rules
└── firebase.json                # Firebase configuration
```

---

## Development Workflow

### 1. Start Development Server
```bash
npm run dev
# Access at http://localhost:3000
```

### 2. Make Changes
- Edit files in `app/`, `components/`, or `lib/`
- Hot reload updates automatically
- TypeScript errors shown in terminal

### 3. Test Locally
```bash
# Run build to check for errors
npm run build

# Test production build
npm start

# Test with emulators
firebase emulators:start
```

### 4. Commit & Deploy

**Vercel Deployment (Automatic):**
```bash
git add .
git commit -m "feat: description of changes"
git push origin main
# Automatically triggers Vercel deployment
# Check status at https://vercel.com/dashboard
```

**Manual Deployment (if needed):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables (Vercel):**
- Set in Vercel Dashboard → Project → Settings → Environment Variables
- Required for production:
  - All NEXT_PUBLIC_FIREBASE_* variables
  - RESEND_API_KEY
  - APP_URL (your production URL)

---

## Performance Optimizations

### Client Data Prefetching

Implemented to improve navigation speed between pages:

**Architecture:**
- `ClientDataContext.tsx`: Manages data cache and prefetching
- `useClientContext.ts`: Triggers prefetch on client selection
- `ClientFilterContext.tsx`: Integrates prefetch with client switching

**How It Works:**
1. When user switches clients/workspace, `prefetchClientData()` is called
2. All page data fetches in parallel using `Promise.all()`:
   - Projects
   - Subcontractors  
   - Rate Cards
   - Clients
   - Dashboard Stats
3. Data is cached in context
4. Pages read from cache for instant rendering
5. CRUD operations update cache automatically

**Benefits:**
- Single loading screen when switching clients
- Instant page navigation after initial load
- Reduced Firebase read operations
- Better user experience

**Implementation Example:**
```typescript
// In dashboard pages
const { cachedData } = useClientData();

useEffect(() => {
  if (cachedData) {
    setProjects(cachedData.projects); // Instant!
  }
}, [cachedData]);
```

---

## Key Concepts

### Multi-Company Architecture

Users can work for multiple companies:

```typescript
// User document structure
{
  email: string,
  ownCompanyId: string,           // Their primary company
  activeCompanyId: string,         // Currently selected company
  role: string,                    // Role in own company
  subcontractorRoles: {            // Roles in other companies
    [companyId]: {
      subcontractorId: string,
      status: 'active' | 'inactive'
    }
  }
}
```

### Company Switching
```typescript
// lib/useCompanyContext.ts
const { activeCompanyId, switchCompany } = useCompanyContext();
switchCompany(newCompanyId);
```

### Role-Based Access Control

Permissions by role:
- **ADMIN**: Full access to everything
- **MANAGER**: Manage projects, clients, subcontractors
- **VIEWER**: Read-only access
- **SUBCONTRACTOR**: View assigned projects only

Check in components:
```typescript
const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';
```

### Rate Card System

Rate cards assigned per client-subcontractor relationship:

1. Create rate card (global to company)
2. Assign subcontractor to project (under a client)
3. Assign rate card to subcontractor for that specific client
4. Rate card applies to all projects under that client

---

## Database Collections

### companies
```typescript
{
  name: string,
  ownerId: string,
  subscriptionPlan: 'free' | 'pro' | 'enterprise',
  subscriptionStatus: string
}
```

### users
```typescript
{
  email: string,
  firstName: string,
  lastName: string,
  companyId: string,           // Legacy
  ownCompanyId: string,
  activeCompanyId: string,
  role: string,
  subcontractorRoles: object
}
```

### clients
```typescript
{
  name: string,
  email: string,
  phone: string,
  address: string,
  companyId: string,
  active: boolean
}
```

### projects
```typescript
{
  projectCode: string,
  name: string,
  clientId: string,
  location: string,
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED',
  companyId: string
}
```

### subcontractors
```typescript
{
  name: string,
  email: string,
  phone: string,
  companyId: string,
  userId?: string,             // Linked user account
  inviteStatus: 'pending' | 'accepted',
  active: boolean
}
```

### rateCards
```typescript
{
  name: string,
  category: string,
  description: string,
  companyId: string,
  active: boolean
}
```

### projectAssignments
```typescript
{
  projectId: string,
  subcontractorId: string,
  companyId: string,
  assignedAt: timestamp
}
```

### subcontractorRateAssignments
```typescript
{
  subcontractorId: string,
  clientId: string,
  rateCardId: string,
  companyId: string,
  assignedAt: timestamp
}
```

---

## Common Tasks

### Add a New Page
```bash
# Create new page file
touch app/dashboard/newpage/page.tsx
```

```typescript
'use client';
import DashboardLayout from '@/components/DashboardLayout';

export default function NewPage() {
  return (
    <DashboardLayout>
      <div>Your content</div>
    </DashboardLayout>
  );
}
```

### Add a New Component
```typescript
// components/MyComponent.tsx
export default function MyComponent() {
  return <div>Component content</div>;
}

// Use in page
import MyComponent from '@/components/MyComponent';
```

### Add Firebase Cloud Function
```typescript
// functions/src/myfunction.ts
import * as functions from 'firebase-functions';

export const myFunction = functions.https.onCall(async (data, context) => {
  // Your logic
  return { success: true };
});

// Export in functions/src/index.ts
export { myFunction } from './myfunction';
```

### Update Firestore Rules
```bash
# Edit firestore.rules
# Deploy
firebase deploy --only firestore:rules
```

---

## Best Practices

### TypeScript
- Define types in `lib/types.ts`
- Use TypeScript for all new code
- Avoid `any` types

### State Management
- Use React hooks (useState, useEffect)
- Context for global state (company, client filter)
- No external state management needed

### Firebase Queries
- Always filter by `companyId` for multi-tenancy
- Use indexes for complex queries
- Limit query results for performance

### Error Handling
```typescript
try {
  await someFirebaseOperation();
} catch (error) {
  console.error('Error:', error);
  alert('Operation failed. Please try again.');
}
```

### Security
- All dashboard routes require authentication
- Check user roles before showing edit buttons
- Validate user permissions in Cloud Functions
- Never expose API keys in client code

---

## Testing

```bash
# Build test
npm run build

# Type check
npx tsc --noEmit

# Run with Firebase emulators
firebase emulators:start
```

---

## Debugging

### Client-Side
- Use browser DevTools
- Check Console for errors
- Use React DevTools extension

### Server-Side (Functions)
```bash
firebase functions:log
```

### Firestore Issues
- Check Firestore rules
- Verify indexes are created
- Check data structure matches code

---

## Performance Tips

- Use `'use client'` only when needed
- Implement pagination for large lists
- Cache Firebase queries where appropriate
- Optimize images before upload
- Minimize component re-renders

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: your feature description"

# Push and create PR
git push origin feature/your-feature
# Create Pull Request on GitHub

# After review, merge to main
# Vercel auto-deploys
```

---

## Troubleshooting

### Email Issues

**Emails not sending?**
- Verify API key in environment variables
- Check domain verification in Resend dashboard
- View logs: `firebase functions:log`

**Emails in spam?**
- Ensure domain is fully verified
- Add all DNS records (SPF, DKIM, DMARC)
- Whitelist support@crewquo.com

### Build Errors

**TypeScript errors:**
```bash
npx tsc --noEmit  # Check all types
```

**Module not found:**
```bash
rm -rf node_modules .next
npm install
npm run dev
```

### Firebase Issues

**Authentication errors:**
- Check Firebase console for auth configuration
- Verify environment variables match Firebase project

**Firestore permission denied:**
- Review `firestore.rules`
- Ensure user is authenticated
- Check companyId filtering

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Resend Docs](https://resend.com/docs)
