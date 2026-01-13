# Subcontractor Permission Error Fix

## Issue
Subcontractors were seeing a Firebase permission error when accessing project details:
```
Error fetching project data: FirebaseError: Missing or insufficient permissions.
```

## Root Cause
When a subcontractor logs in, Firebase Authentication needs to have **custom claims** (JWT tokens) that include:
- `subcontractorRoles` - A map of companyId → subcontractor details
- `activeCompanyId` - The currently active company they're working for

The Firestore security rules check these custom claims to determine if the user has permission to read project data. If these claims are missing or outdated, Firestore denies access.

### Why This Happens
1. **Stale Tokens**: When custom claims are updated in Firebase Auth (e.g., when a subcontractor accepts an invite), the client's cached token doesn't automatically refresh
2. **Session Expiry**: Tokens expire after a certain period and need to be refreshed
3. **New Sessions**: When logging in from a new device/browser, the token needs to be properly set with all custom claims

## Solution
The fix implements an **automatic token refresh with retry logic** that:

1. **Detects Permission Errors**: Identifies when a Firestore operation fails due to missing/insufficient permissions
2. **Refreshes the Token**: Calls Firebase Auth to get a new ID token with updated custom claims
3. **Retries the Operation**: Automatically retries the failed operation with the new token
4. **User-Friendly Messages**: Provides clear error messages if the refresh fails

### Changes Made

#### 1. Updated `/app/dashboard/my-work/projects/[projectId]/page.tsx`
- **Added import**: `retryWithTokenRefresh`, `isPermissionError`, `handlePermissionError` from `@/lib/tokenRefresh`
- **Wrapped `fetchProjectData`**: Entire data fetching logic now wrapped in `retryWithTokenRefresh()` which will:
  - Attempt to fetch data
  - If permission error occurs, refresh the auth token
  - Wait 1.5 seconds for claims to propagate
  - Retry the operation (up to 2 times)
- **Better error handling**: Distinguishes between permission errors and other errors, providing appropriate user feedback

## How It Works

```typescript
await retryWithTokenRefresh(async () => {
  // Fetch all project data, rate cards, time logs, expenses, etc.
  // If this fails with a permission error, the wrapper will:
  // 1. Refresh the user's Firebase Auth token
  // 2. Wait for claims to propagate
  // 3. Retry this entire block
}, 2); // Retry up to 2 times
```

## Expected Behavior Now

### Scenario 1: Stale Token
1. Subcontractor opens project page
2. Gets permission error (token is stale)
3. System automatically refreshes token
4. Retries fetch operation
5. **Success** - page loads normally

### Scenario 2: Completely Missing Claims
1. Subcontractor opens project page
2. Gets permission error
3. System attempts to refresh token
4. Shows error message: "Permission denied. Your session may be outdated. Please try signing out and signing back in, or contact your administrator."
5. User signs out/in to get fresh claims

## Testing Instructions

1. **Test with Subcontractor Account**:
   - Log in as a subcontractor
   - Navigate to "My Work" > "Projects"
   - Click on a project you're assigned to
   - ✅ Should load successfully (may take 1-2 seconds on first load if token needs refresh)

2. **Test Token Refresh**:
   - Have admin assign subcontractor to a new project
   - Subcontractor refreshes browser
   - ✅ Should see new project and be able to access it

3. **Test Error Handling**:
   - Remove subcontractor from all projects (admin side)
   - Subcontractor tries to access project
   - ✅ Should see clear error message

## Related Files
- `/lib/tokenRefresh.ts` - Token refresh utility (already existed)
- `/firestore.rules` - Security rules that check custom claims
- `/functions/src/auth.ts` - Cloud function that sets custom claims on user creation/updates

## Additional Notes

### If Issues Persist
If subcontractors still see permission errors after this fix:

1. **Check Cloud Function**: Ensure the `refreshClaims` Cloud Function is deployed
2. **Verify Claims**: Use the debug script to check if claims are set:
   ```bash
   npm run debug-user-claims
   ```
3. **Force Sign Out/In**: Have the user completely sign out and sign back in
4. **Check Firestore Rules**: Verify the security rules allow subcontractor access to the specific collections

### Prevention
- The retry logic prevents most token staleness issues
- Custom claims are automatically set when:
  - Subcontractor accepts an invite
  - Admin assigns subcontractor to a project
  - User switches active company context

## Status
✅ **FIXED** - Automatic token refresh with retry logic now handles permission errors gracefully
