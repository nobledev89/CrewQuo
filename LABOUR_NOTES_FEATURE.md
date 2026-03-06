# Labour Notes Feature Implementation

## Overview
Added notes functionality to labour entries (time logs) on the subcontractor's project page, matching the existing notes system for expenses.

## What Was Added

### 1. **Imports**
- `MessageSquare` icon from lucide-react
- `LineItemNotesModal` component
- `getUnresolvedNotesCounts` utility function

### 2. **State Management**
```typescript
// Notes state
const [selectedNoteItem, setSelectedNoteItem] = useState<{ id: string; type: 'timeLog' | 'expense'; description: string } | null>(null);
const [notesCounts, setNotesCounts] = useState<Map<string, number>>(new Map());
```

### 3. **Fetch Note Counts**
After fetching time logs, get unresolved note counts:
```typescript
// Fetch unresolved notes counts for time logs
if (logs.length > 0) {
  try {
    const logIds = logs.map((log: any) => log.id);
    const counts = await getUnresolvedNotesCounts(logIds);
    setNotesCounts(counts);
  } catch (error) {
    console.error('Error fetching note counts:', error);
  }
}
```

### 4. **Fetch ClientOrgId**
Updated client fetching to get clientOrgId for notes:
```typescript
// Fetch client name and get clientOrgId for notes
let clientOrgId = '';
if (projectData.clientId) {
  const clientDoc = await getDoc(doc(db, 'clients', projectData.clientId));
  if (clientDoc.exists()) {
    const clientData = clientDoc.data();
    setClientName(clientData.name);
    clientOrgId = clientData.clientOrgId || '';
  }
}

// Store clientOrgId in project data for notes modal
setProject({ id: projectDoc.id, ...projectData, clientOrgId });
```

### 5. **Table Updates**
- Added "Notes" column header to time logs table
- Added notes button with unresolved count badge for each time log row
- Icon shows blue message icon
- Red badge displays count of unresolved notes

### 6. **Notes Modal**
Added conditional rendering at the end of the component:
```typescript
{/* Line Item Notes Modal */}
{selectedNoteItem && (
  <LineItemNotesModal
    itemId={selectedNoteItem.id}
    itemType={selectedNoteItem.type}
    itemDescription={selectedNoteItem.description}
    projectId={projectId!}
    clientOrgId={project.clientOrgId || ''}
    contractorCompanyId={project.companyId}
    onClose={async () => {
      setSelectedNoteItem(null);
      // Refresh note counts after modal closes
      if (auth.currentUser) {
        await fetchProjectData(auth.currentUser);
      }
    }}
    allowClientNotes={true}
  />
)}
```

## Benefits

1. **Improved Communication**: Subcontractors can add notes/questions on their time logs
2. **Client Collaboration**: When clients have access, they can see and respond to notes
3. **Better Transparency**: Clarifications about rates, shifts, or entries can be documented
4. **Consistent UX**: Matches the expense notes functionality

## Usage

1. **As a Subcontractor**:
   - Navigate to "My Work" > Project Details
   - Click the message icon (💬) next to any time log
   - Add a note or question
   - See responses from admins/managers

2. **As Admin/Manager**:
   - View notes added by subcontractors
   - Respond to questions
   - Mark notes as resolved

3. **Unresolved Notes Badge**:
   - Red badge shows count of unresolved notes
   - Helps identify entries needing attention

## Technical Details

- **Modal Component**: `LineItemNotesModal` (already exists)
- **Database Collection**: `lineItemNotes` in Firestore
- **Utilities**: `lib/lineItemNotesUtils.ts`
- **Types**: `LineItemNote` type in `lib/types.ts`
- **Supported Item Types**: `'timeLog'` and `'expense'`

## Files Modified

- `app/dashboard/my-work/projects/[projectId]/page.tsx`
  - Added imports
  - Added state management
  - Added note count fetching
  - Added Notes column to table
  - Added modal rendering

## Next Steps

Due to file corruption during implementation, the actual code changes need to be re-applied using smaller, targeted edits. The plan is documented above.
