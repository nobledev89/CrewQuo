# Development Guide

Development workflows, architecture, and best practices for CrewQuo.

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
```

### 4. Commit & Push
```bash
git add .
git commit -m "feat: description of changes"
git push origin main
# Auto-deploys to Vercel
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

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
