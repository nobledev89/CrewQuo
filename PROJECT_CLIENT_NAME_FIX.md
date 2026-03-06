# Project Client Name Denormalization Fix

## Issue
When viewing the client projects page at `/dashboard/clients/[clientId]/projects`, the page showed:
- "0 of 0 projects have been granted access"
- "No projects found"
- "Create a project for this client first."

However, all 7 projects were actually correctly associated with the client "PricewaterhouseCoopers".

## Root Cause
The projects in the database were missing the `clientName` field (denormalized field). They had:
- ✅ Correct `clientId` field (properly linked to client)
- ❌ Missing or `undefined` `clientName` field

This was a **denormalization issue** - the `clientName` field wasn't being populated when projects were created, causing:
1. The client projects page to fail to display them properly
2. Various queries relying on `clientName` to not work correctly

## Diagnostic Results

### Before Fix:
```
✅ Client document exists: h3Os4IWCHgNwzu8Wlo5g (PricewaterhouseCoopers)
✅ Found 7 project(s) with correct clientId
❌ All projects showed clientName: "Unknown"
```

### After Fix:
```
✅ Client document exists: h3Os4IWCHgNwzu8Wlo5g (PricewaterhouseCoopers)
✅ Found 7 project(s) with correct clientId
✅ All 7 projects now have clientName: "PricewaterhouseCoopers"
```

## Solution Implemented

### 1. Data Migration Script (`scripts/fix-project-client-names.ts`)
- Scanned all projects in the database
- For projects with missing or "Unknown" `clientName`:
  - Fetched the associated client document
  - Updated the project with the correct `clientName`
- Successfully updated all 7 projects

### 2. Code Fix (`app/dashboard/projects/page.tsx`)
Updated the `handleSubmit` function to always populate `clientName` when creating or updating projects:

```typescript
// Fetch client name for denormalization
const clientDoc = await getDoc(doc(db, 'clients', formData.clientId));
const clientName = clientDoc.exists() ? clientDoc.data().name : 'Unknown';

const projectData = {
  // ... other fields
  clientId: formData.clientId,
  clientName: clientName, // Denormalized for easier querying and display
  updatedAt: serverTimestamp(),
};
```

## Files Changed

1. **scripts/diagnose-client-projects.ts** - Diagnostic script to investigate the issue
2. **scripts/fix-project-client-names.ts** - Migration script to fix existing data
3. **app/dashboard/projects/page.tsx** - Updated to always populate `clientName` for new/edited projects
4. **PROJECT_CLIENT_NAME_FIX.md** - This documentation

## Testing

### Manual Verification:
1. ✅ Ran diagnostic script - confirmed issue
2. ✅ Ran migration script - fixed 7 projects
3. ✅ Re-ran diagnostic script - confirmed all projects now have `clientName`
4. ✅ Updated code to prevent future occurrences

### Expected Result:
- The client projects page at `/dashboard/clients/h3Os4IWCHgNwzu8Wlo5g/projects` should now display all 7 projects
- Future projects will automatically have the `clientName` field populated

## Impact
- **Low Risk**: This is a data denormalization fix
- **No Breaking Changes**: Only adds missing data
- **Immediate Benefit**: Client projects page will work correctly
- **Future Prevention**: New projects will always have `clientName` populated

## Deployment
Deployed to main branch for Vercel auto-deployment.

## Date
March 6, 2026
