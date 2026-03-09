# Line Item Conversations Feature

## Overview
This feature enables threaded conversations on individual line items (time logs and expenses) between clients, contractors (admins/managers), and optionally subcontractors.

## Implementation Summary

### 1. Type Updates (`lib/types.ts`)
- Extended `NoteCreatorRole` to include `'SUBCONTRACTOR'`
- Added `allowSubcontractorNotes` field to `ClientProjectAccess` interface for per-project subcontractor participation control

### 2. Modal Component (`components/LineItemNotesModal.tsx`)
- Updated to support all three role types: CLIENT, ADMIN/MANAGER, SUBCONTRACTOR
- Added role-based badge colors:
  - **Client**: Blue badge
  - **Contractor** (Admin/Manager): Green badge  
  - **Subcontractor**: Purple badge
- Implemented permission logic:
  - Clients can add notes if `allowClientNotes` is enabled
  - Subcontractors can add notes if `allowSubcontractorNotes` is enabled
  - Admins/Managers can always add notes
  - Only Admins/Managers can resolve/unresolve notes

### 3. Admin Project View (`app/dashboard/projects/[projectId]/page.tsx`)
- Added `MessageSquare` icon import from lucide-react
- Added `LineItemNotesModal` component import
- Added `getUnresolvedNotesCounts` utility import
- Added state management for:
  - `selectedLineItem`: Tracks which line item's conversation is open
  - `unresolvedNotesMap`: Maps item IDs to unresolved notes count
  - `clientOrgId`: Required for notes modal
- Updated `fetchProject` to fetch and store `clientOrgId` from client record
- Updated `fetchLiveTrackingData` to fetch unresolved notes counts for all line items
- Added `LineItemNotesModal` component at bottom of page with:
  - Refresh functionality on close to update notes counts
  - `allowClientNotes` set to true
  - `allowSubcontractorNotes` set to false (default)

**Note**: The actual conversation buttons need to be integrated into the line item display (SubcontractorCostBreakdown component or similar) similar to how they appear in the client portal view.

### 4. Firestore Security Rules (`firestore.rules`)
- Extended `lineItemNotes` collection rules to support subcontractors:
  - **Read**: Subcontractors can read notes on projects they have access to
  - **List**: Subcontractors can query notes (filtered by their access)
  - **Create**: Subcontractors can create notes if they have company access (app logic checks `allowSubcontractorNotes` setting)
  - **Update**: Only contractors (ADMIN/MANAGER) can resolve/unresolve notes

### 5. Utility Functions (`lib/clientAccessUtils.ts`)
- Updated `grantProjectAccess` function to accept `allowSubcontractorNotes` parameter
- This setting is stored per-project in the `ClientProjectAccess` document

## How It Works

### Client View
1. Client views project in client portal
2. Sees "Conversation" column with message icons on each line item
3. Clicks icon to open conversation modal
4. Can add notes/questions if `allowClientNotes` is enabled
5. Sees badge showing count of unresolved messages

### Admin View
1. Admin views project in Live Tracking tab
2. Infrastructure is in place to show conversation icons (needs UI integration in line item table)
3. Clicks icon to open conversation modal
4. Can reply to client questions and mark conversations as resolved
5. Can see which role (Client/Subcontractor/Contractor) created each note

### Subcontractor View (When Enabled)
1. Admin enables `allowSubcontractorNotes` for specific project
2. Subcontractor views their project in "My Work" section
3. Can see conversations on line items they created
4. Can participate in conversations if enabled
5. Cannot resolve conversations (read-only resolution status)

## Per-Project Settings

Admins can control subcontractor participation on a per-project basis:

```typescript
// When granting project access
await grantProjectAccess(
  contractorCompanyId,
  clientOrgId,
  projectId,
  projectName,
  grantedBy,
  {
    allowSubcontractorNotes: true  // Enable subcontractor participation
  }
);
```

## Database Schema

### lineItemNotes Collection
```typescript
{
  id: string;
  itemId: string;                    // timeLog or expense ID
  itemType: 'timeLog' | 'expense';
  projectId: string;
  clientOrgId: string;
  contractorCompanyId: string;
  createdBy: string;                 // userId
  createdByRole: 'CLIENT' | 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';
  createdByName: string;
  note: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### clientProjectAccess Collection (Updated)
```typescript
{
  // ... existing fields
  allowSubcontractorNotes?: boolean;  // NEW: Per-project subcontractor participation
}
```

## Future Enhancements

1. **Add UI Integration in Admin View**: 
   - Add conversation column to SubcontractorCostBreakdown component
   - Show message icons with unresolved count badges
   - Match the UI pattern from client portal view

2. **Add UI in Subcontractor View**:
   - Add conversation column to My Work project view
   - Only show conversations on line items they created
   - Respect `allowSubcontractorNotes` setting

3. **Project Settings UI**:
   - Add toggle in client project settings to enable/disable subcontractor notes
   - Allow per-project override of this setting

4. **Notifications**:
   - Email notifications when new notes are added
   - In-app notification badges for unresolved conversations

5. **Search & Filter**:
   - Filter line items by "has unresolved conversations"
   - Search within conversations

## Testing Checklist

- [ ] Client can add notes to line items
- [ ] Admin can view and reply to client notes
- [ ] Admin can resolve/unresolve conversations
- [ ] Subcontractor can view conversations (when enabled)
- [ ] Subcontractor can participate (when `allowSubcontractorNotes` is true)
- [ ] Subcontractor cannot participate (when `allowSubcontractorNotes` is false)
- [ ] Role badges display correctly for all three roles
- [ ] Unresolved notes counts update in real-time
- [ ] Security rules prevent unauthorized access
- [ ] Modal refreshes data after closing

## Files Modified

1. `lib/types.ts` - Type definitions
2. `components/LineItemNotesModal.tsx` - Modal component with role support
3. `app/dashboard/projects/[projectId]/page.tsx` - Admin view infrastructure
4. `firestore.rules` - Security rules for subcontractor access
5. `lib/clientAccessUtils.ts` - Utility functions for project access

## Deployment Notes

- Deploy Firestore rules separately: `firebase deploy --only firestore:rules`
- Main app deployment handled by Vercel on git push
- No database migrations needed (backward compatible)
