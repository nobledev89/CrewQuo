# Project Assignment Fix Summary

## Issue
Error when assigning subcontractors to projects:
```
Error fetching assignments: FirebaseError: Missing or insufficient permissions.
```

## Root Cause
The Firestore security rules for `projectAssignments` collection were using `sameCompany()` (which checks the `companyId` token claim), but the frontend code in `app/dashboard/projects/[projectId]/page.tsx` was using `ownCompanyId` from the token claims to fetch assignments. This mismatch caused a permissions error.

## Solution
Updated the Firestore rules for `projectAssignments` collection to use `sameActiveCompany()` instead of `sameCompany()`, and added `isOwnCompany()` checks for write operations to align with the frontend code and the multi-company context system.

### Changes Made in `firestore.rules`

**Before:**
```javascript
match /projectAssignments/{assignmentId} {
  allow read: if authed() && (
    sameCompany(resource.data) || 
    hasAccessToCompany(resource.data.companyId)
  );
  allow create: if authed() 
    && sameCompany(request.resource.data) 
    && isAdminOrManager();
  // ... etc
}
```

**After:**
```javascript
match /projectAssignments/{assignmentId} {
  allow read: if authed() && (
    sameActiveCompany(resource.data) || 
    hasAccessToCompany(resource.data.companyId)
  );
  allow create: if authed() 
    && sameActiveCompany(request.resource.data) 
    && isOwnCompany()
    && isAdminOrManager();
  // ... etc
}
```

## Deployment
The updated rules were deployed to Firebase using:
```bash
firebase deploy --only firestore:rules
```

## Testing
To verify the fix:
1. Log into the application as an ADMIN or MANAGER user
2. Navigate to a project detail page
3. Click "Assign Subcontractor"
4. Select a subcontractor and assign them
5. The assignment should now work without the permissions error

## Date Fixed
December 19, 2025, 10:54 AM (Europe/London)
