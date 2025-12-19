# Project Assignment Fix - Complete Solution

## Problem
1. Admin dashboard couldn't fetch assigned subcontractors (permissions error)
2. Multiple duplicate assignments were being created (11 duplicates for one project!)
3. No prevention mechanism for duplicate assignments

## Root Cause
The Firestore security rules for `projectAssignments` were using `sameCompany()` which checks the `companyId` token claim, but the frontend code was using `ownCompanyId` from token claims. This mismatch caused:
- Permission denials when fetching assignments
- Inability to detect existing assignments, leading to duplicates

## Solution Implemented

### 1. Fixed Firestore Rules (✅ DEPLOYED)
**File:** `firestore.rules`

Changed `projectAssignments` rules from:
```javascript
allow read: if authed() && (
  sameCompany(resource.data) || 
  hasAccessToCompany(resource.data.companyId)
);
allow create: if authed() 
  && sameCompany(request.resource.data) 
  && isAdminOrManager();
```

To:
```javascript
allow read: if authed() && (
  sameActiveCompany(resource.data) || 
  hasAccessToCompany(resource.data.companyId)
);
allow create: if authed() 
  && sameActiveCompany(request.resource.data) 
  && isOwnCompany()
  && isAdminOrManager()
  && !exists(/databases/$(database)/documents/projectAssignments/$(request.resource.data.projectId + '_' + request.resource.data.subcontractorId));
```

**Key changes:**
- Use `sameActiveCompany()` to match frontend's use of `activeCompanyId`
- Add `isOwnCompany()` check for write operations
- Add database-level duplicate prevention using deterministic document IDs

**Status:** ✅ Deployed to Firebase

### 2. Fixed Frontend Code (✅ COMPLETED)
**File:** `app/dashboard/projects/[projectId]/page.tsx`

Changed from using random document IDs with `addDoc()` to deterministic IDs with `setDoc()`:

```typescript
// OLD: Used addDoc with random ID
await addDoc(collection(db, 'projectAssignments'), {...});

// NEW: Uses setDoc with deterministic ID
const assignmentId = `${project.id}_${selectedSubcontractorId}`;
const assignmentRef = doc(db, 'projectAssignments', assignmentId);
await setDoc(assignmentRef, {...});
```

**Benefits:**
- Prevents duplicates at the application level
- Matches the database-level duplicate prevention
- Makes document IDs predictable and meaningful

**Status:** ✅ Committed to repository

### 3. Cleanup Script for Existing Duplicates (⚠️ READY TO RUN)
**File:** `scripts/cleanup-duplicate-assignments.ts`

A script that will:
- Find all duplicate assignments (same projectId + subcontractorId)
- Keep the oldest assignment
- Migrate it to use the correct deterministic ID format
- Delete all duplicates

**To run the cleanup:**
```bash
npx tsx scripts/cleanup-duplicate-assignments.ts
```

**Note:** Requires environment variables to be set in `.env.local`:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

**Status:** ⚠️ Script created, needs to be run manually

## Testing the Fix

1. **Refresh your browser** to ensure you're using the latest code
2. **Log out and log back in** to refresh your authentication token
3. Navigate to a project detail page
4. Try to assign a subcontractor - you should now see:
   - Existing assignments displayed correctly
   - Ability to assign new subcontractors
   - Prevention of duplicate assignments

## Expected Behavior After Fix

✅ **Admin can see assigned subcontractors** - No more permission errors  
✅ **Duplicate prevention** - Cannot assign same subcontractor twice to a project  
✅ **Subcontractors see their assigned projects** - In "My Work" page  
✅ **Clean data structure** - Each assignment has deterministic ID: `projectId_subcontractorId`

## Next Steps

1. ✅ Firestore rules deployed
2. ✅ Frontend code updated
3. ⚠️ **RUN CLEANUP SCRIPT** to remove existing duplicates:
   ```bash
   npx tsx scripts/cleanup-duplicate-assignments.ts
   ```
4. ✅ Test assignment functionality in the browser

## Files Modified

- `firestore.rules` - Updated projectAssignments security rules
- `app/dashboard/projects/[projectId]/page.tsx` - Uses deterministic document IDs
- `scripts/cleanup-duplicate-assignments.ts` - New cleanup script

## Date Fixed
December 19, 2025, 11:15 AM (Europe/London)
