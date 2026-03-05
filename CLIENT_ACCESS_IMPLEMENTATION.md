# Client Access Feature - Implementation Guide

## Overview
This document outlines the implementation of client portal access for CrewQuo, allowing clients to view project progress, live tracking, running bills, and collaborate with contractors through line item notes.

## Key Requirements
- **Multi-Contractor Support**: Clients can work with multiple contractors and see all projects in one portal
- **Granular Visibility Controls**: Contractors decide what financial data clients see (costs, margins, rates)
- **Real-Time Tracking**: Clients see live updates of time logs, expenses, and project status
- **Collaboration**: Clients can add notes on line items; contractors can respond
- **Flexible Access**: Per-project access grants with customizable settings

---

## Database Schema

### Collections

#### 1. `clientOrganizations` (Global)
Represents actual client companies that work with multiple contractors.

```typescript
{
  id: string;
  name: string;                // "ABC Corporation"
  domain?: string;             // "abccorp.com"
  taxId?: string;
  address?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;           // First contractor userId
}
```

#### 2. `clientUsers` (Global)
Portal users for client organizations.

```typescript
{
  id: string;
  userId: string;              // Links to users collection
  clientOrgId: string;
  clientOrgName?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'VIEWER' | 'ADMIN';
  active: boolean;
  contractorCompanyIds: string[];  // All contractors they can access
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 3. `contractorClientRelationships`
Links contractors to client organizations with default settings.

```typescript
{
  id: string;  // "{contractorId}_{clientOrgId}"
  contractorCompanyId: string;
  contractorCompanyName: string;
  clientOrgId: string;
  clientOrgName: string;
  
  // Default visibility settings
  defaultShowCosts: boolean;
  defaultShowMargins: boolean;
  defaultShowSubcontractorRates: boolean;
  allowClientNotes: boolean;
  showDraftStatus: boolean;
  showRejectedStatus: boolean;
  
  contractorClientId: string;  // Links to existing 'clients' collection
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
```

#### 4. `clientUserInvites`
Invitation system for client users.

```typescript
{
  id: string;
  email: string;
  contractorCompanyId: string;
  contractorCompanyName: string;
  clientOrgId: string;
  clientOrgName: string;
  invitedBy: string;
  inviteToken: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  sentAt: Timestamp;
  acceptedAt?: Timestamp;
  expiresAt: Timestamp;
}
```

#### 5. `clientProjectAccess`
Grants specific project access to client organizations.

```typescript
{
  id: string;
  contractorCompanyId: string;
  clientOrgId: string;
  projectId: string;
  projectName?: string;
  grantedBy: string;
  grantedAt: Timestamp;
  
  // Per-project overrides (optional)
  overrideShowCosts?: boolean;
  overrideShowMargins?: boolean;
  overrideShowSubcontractorRates?: boolean;
  
  active: boolean;
}
```

#### 6. `lineItemNotes`
Collaboration notes on time logs and expenses.

```typescript
{
  id: string;
  itemId: string;              // timeLog or expense ID
  itemType: 'timeLog' | 'expense';
  projectId: string;
  clientOrgId: string;
  contractorCompanyId: string;
  
  createdBy: string;
  createdByRole: 'CLIENT' | 'ADMIN' | 'MANAGER';
  createdByName: string;
  note: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Modified Collections

#### `users`
Add fields for CLIENT role:
- `clientOrgId?: string`
- `clientOrgName?: string`
- `contractorCompanyIds?: string[]`

#### `clients`
Add fields to link to global organizations:
- `clientOrgId?: string`
- `clientOrgName?: string`

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
- [x] Add CLIENT to UserRole type
- [x] Create new interface definitions in lib/types.ts
- [ ] Update Firebase security rules
- [ ] Update AuthContext to handle CLIENT role
- [ ] Create utility functions for client access

### Phase 2: Contractor-Side Management
- [ ] Enhance client creation UI (link to ClientOrganization)
- [ ] Build client users management page (`/dashboard/clients/[clientId]/users`)
- [ ] Build project access management (`/dashboard/clients/[clientId]/projects`)
- [ ] Build client settings page (`/dashboard/clients/[clientId]/settings`)
- [ ] Create client user invitation system

### Phase 3: Client Portal
- [ ] Create client signup flow (`/signup/client`)
- [ ] Build client dashboard with contractor selector (`/dashboard/client-portal`)
- [ ] Build client project detail view (`/dashboard/client-portal/projects/[projectId]`)
- [ ] Implement contractor switcher dropdown

### Phase 4: Visibility Controls
- [ ] Create component for conditional data display
- [ ] Modify SubcontractorCostBreakdown for client view
- [ ] Implement settings-based filtering

### Phase 5: Line Item Notes
- [ ] Create LineItemNotesModal component
- [ ] Add notes icon to line items table
- [ ] Implement notes CRUD operations
- [ ] Add notification badges for unresolved notes

### Phase 6: Testing & Polish
- [ ] Test invitation flow (new + existing users)
- [ ] Test multi-contractor switching
- [ ] Test visibility controls
- [ ] Test access permissions
- [ ] End-to-end testing

---

## User Flows

### Contractor Invites Client User

1. Navigate to `/dashboard/clients/[clientId]/users`
2. Click "Invite Client User"
3. Enter email, name
4. System checks:
   - Does client org exist? (create if not)
   - Does user already exist? (add contractor if yes, create if no)
5. Creates invitation record
6. Sends email with signup link

### Client Accepts Invitation

**Scenario A: New User**
1. Clicks email link → `/signup/client?token=xxx`
2. Creates Firebase Auth account
3. Creates `users` document (role: CLIENT)
4. Creates `clientUser` document
5. Updates invitation status
6. Redirects to client portal

**Scenario B: Existing User**
1. Clicks email link (already logged in or logs in)
2. System detects existing `clientUser`
3. Adds contractor to `contractorCompanyIds` array
4. Updates invitation status
5. Shows success message

### Client Views Projects

1. Logs in → `/dashboard/client-portal`
2. Sees contractor dropdown (if multiple contractors)
3. Selects contractor
4. Sees list of accessible projects for that contractor
5. Clicks project → `/dashboard/client-portal/projects/[projectId]`
6. Views:
   - Summary cards (filtered by visibility settings)
   - Status breakdown
   - Subcontractor breakdown
   - Line items with conditional columns

### Client Adds Note

1. In project detail view, clicks notes icon on line item
2. Modal opens showing existing notes
3. Types new note
4. Submits
5. Note saved with createdByRole: CLIENT
6. Contractor sees notification badge

---

## Firebase Security Rules

```javascript
// clientOrganizations - contractors can create, clients can read their own
match /clientOrganizations/{orgId} {
  allow read: if request.auth != null && (
    request.auth.token.role in ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] ||
    (request.auth.token.role == 'CLIENT' && request.auth.token.clientOrgId == orgId)
  );
  allow create: if request.auth != null && 
    request.auth.token.role in ['ADMIN', 'MANAGER'];
}

// clientUsers - contractors can manage for their clients, users can read their own
match /clientUsers/{userId} {
  allow read: if request.auth != null && (
    request.auth.uid == userId ||
    resource.data.clientOrgId == request.auth.token.clientOrgId
  );
  allow write: if request.auth != null && 
    request.auth.token.role in ['ADMIN', 'MANAGER'];
}

// contractorClientRelationships
match /contractorClientRelationships/{relationshipId} {
  allow read: if request.auth != null && (
    resource.data.contractorCompanyId == request.auth.token.ownCompanyId ||
    (request.auth.token.role == 'CLIENT' && 
     resource.data.clientOrgId == request.auth.token.clientOrgId)
  );
  allow write: if request.auth != null && 
    request.auth.token.role in ['ADMIN', 'MANAGER'] &&
    request.resource.data.contractorCompanyId == request.auth.token.ownCompanyId;
}

// clientProjectAccess
match /clientProjectAccess/{accessId} {
  allow read: if request.auth != null && (
    resource.data.contractorCompanyId == request.auth.token.ownCompanyId ||
    (request.auth.token.role == 'CLIENT' && 
     resource.data.clientOrgId == request.auth.token.clientOrgId &&
     resource.data.contractorCompanyId in request.auth.token.contractorCompanyIds)
  );
  allow write: if request.auth != null && 
    request.auth.token.role in ['ADMIN', 'MANAGER'] &&
    request.resource.data.contractorCompanyId == request.auth.token.ownCompanyId;
}

// lineItemNotes
match /lineItemNotes/{noteId} {
  allow read: if request.auth != null && (
    resource.data.contractorCompanyId == request.auth.token.ownCompanyId ||
    (request.auth.token.role == 'CLIENT' && 
     resource.data.clientOrgId == request.auth.token.clientOrgId &&
     resource.data.contractorCompanyId in request.auth.token.contractorCompanyIds)
  );
  allow create: if request.auth != null && (
    (request.resource.data.createdByRole in ['ADMIN', 'MANAGER'] &&
     request.resource.data.contractorCompanyId == request.auth.token.ownCompanyId) ||
    (request.resource.data.createdByRole == 'CLIENT' &&
     request.resource.data.clientOrgId == request.auth.token.clientOrgId)
  );
  allow update: if request.auth != null && (
    request.auth.token.role in ['ADMIN', 'MANAGER'] &&
    resource.data.contractorCompanyId == request.auth.token.ownCompanyId
  );
}

// timeLogs - clients can read if they have project access
match /timeLogs/{logId} {
  allow read: if request.auth != null && (
    resource.data.companyId == request.auth.token.ownCompanyId ||
    resource.data.companyId == request.auth.token.activeCompanyId ||
    (request.auth.token.role == 'CLIENT' && 
     exists(/databases/$(database)/documents/clientProjectAccess/$(request.auth.token.clientOrgId + '_' + resource.data.projectId)))
  );
}

// expenses - same as timeLogs
match /expenses/{expenseId} {
  allow read: if request.auth != null && (
    resource.data.companyId == request.auth.token.ownCompanyId ||
    resource.data.companyId == request.auth.token.activeCompanyId ||
    (request.auth.token.role == 'CLIENT' && 
     exists(/databases/$(database)/documents/clientProjectAccess/$(request.auth.token.clientOrgId + '_' + resource.data.projectId)))
  );
}
```

---

## File Structure

```
lib/
  types.ts ✅ (Updated)
  clientAccessUtils.ts (NEW)
  lineItemNotesUtils.ts (NEW)

app/dashboard/clients/[clientId]/
  users/
    page.tsx (NEW)
  projects/
    page.tsx (NEW)
  settings/
    page.tsx (NEW)

app/dashboard/client-portal/
  page.tsx (NEW - dashboard with contractor selector)
  projects/[projectId]/
    page.tsx (NEW - project detail view)

app/signup/client/
  page.tsx (NEW - client signup flow)

components/
  ContractorSelector.tsx (NEW)
  ClientProjectCard.tsx (NEW)
  LineItemNotesModal.tsx (NEW)
  ClientAccessSettings.tsx (NEW)
  SubcontractorCostBreakdownClient.tsx (NEW - variant with visibility controls)
```

---

## Next Steps

1. Create utility functions for client access
2. Build contractor-side management UI
3. Implement client invitation system
4. Build client portal pages
5. Add visibility controls
6. Implement line item notes
7. Update Firestore rules
8. End-to-end testing

---

## Notes

- Keep backward compatibility with existing client records
- Gradual rollout: existing clients don't need clientOrgId immediately
- Client organizations are optional until contractors invite portal users
- Settings cascade: Relationship defaults → Project overrides
- Multi-contractor switching is seamless (no re-auth required)
