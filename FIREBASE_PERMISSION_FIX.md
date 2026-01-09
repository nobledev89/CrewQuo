# Firebase Permission Error Fix - Implementation Guide

## 🎯 Problem Summary

Subcontractor users were experiencing "Missing or insufficient permissions" errors when accessing the `/dashboard/my-work/projects` page. This was caused by stale or missing Firebase custom claims (authentication tokens) that the Firestore security rules require.

## ✅ Solution Implemented

### 1. **Created Token Refresh Utility** (`lib/tokenRefresh.ts`)

A comprehensive utility module that handles:
- **Token refresh**: Forces Firebase to fetch a new ID token with updated claims
- **Claims refresh**: Calls the Cloud Function to update claims on the server, then refreshes locally
- **Permission error detection**: Identifies permission-related errors automatically
- **Automatic retry logic**: Retries operations after refreshing tokens
- **Error handling**: Provides user-friendly error messages and recovery options

Key functions:
```typescript
refreshAuthToken()         // Refresh local token
refreshUserClaims()        // Refresh claims on server + local token
isPermissionError()        // Detect permission errors
retryWithTokenRefresh()    // Auto-retry with token refresh
handlePermissionError()    // Handle errors with user feedback
```

### 2. **Updated My Work Projects Page** (`app/dashboard/my-work/projects/page.tsx`)

Enhanced the page with:
- **Automatic retry logic**: Wraps data fetching with `retryWithTokenRefresh()`
- **Error state management**: Shows clear error messages when permissions fail
- **Manual refresh button**: Users can manually refresh their access
- **Error banner**: Displays at the top when there are issues
- **Full error screen**: Shows when no data can be loaded with recovery options
- **User guidance**: Provides clear instructions on how to fix the issue

### 3. **Leveraged Existing Cloud Function** (`functions/src/index.ts`)

The `refreshClaims` Cloud Function already exists and:
- Takes the current user's Firestore document
- Rebuilds their custom claims
- Updates Firebase Auth with the new claims
- Returns success status

## 🧪 Testing Instructions

### Test 1: Normal Flow (Should work automatically)
1. Sign in as a subcontractor user
2. Navigate to `/dashboard/my-work/projects`
3. **Expected**: Page loads successfully (may take 1-2 seconds on first load)

### Test 2: Stale Token (Manual trigger)
1. If you have access to the backend, run the debug script:
   ```bash
   npm run tsx scripts/debug-user-claims.ts <user-email>
   ```
2. This shows current claims status

3. If claims are missing/incorrect, refresh them:
   ```bash
   npm run tsx scripts/refresh-user-token.ts <user-email>
   ```
4. User should then sign out and back in OR hard refresh the browser (Ctrl+Shift+R)

### Test 3: Manual Refresh Button
1. Navigate to `/dashboard/my-work/projects`
2. Click the **"Refresh"** button in the top right
3. **Expected**: Button shows spinner, then reloads data
4. If there were permission issues, they should be resolved

### Test 4: Error Recovery
1. If you see an error banner or error screen
2. Click **"Refresh Access"** button
3. **Expected**: 
   - System attempts to refresh claims
   - Shows success message or guides to sign out/in
   - Data loads after successful refresh

## 🔍 Debugging Tools

### Check User Claims
```bash
npm run tsx scripts/debug-user-claims.ts user@example.com
```
This shows:
- Current custom claims
- User document data
- Company information
- Sample project assignments

### Refresh User Claims (Server-side)
```bash
npm run tsx scripts/refresh-user-token.ts user@example.com
```
This:
- Reads user document from Firestore
- Rebuilds claims based on current data
- Updates Firebase Auth custom claims
- User must sign out/in to get new token

### Browser Console Debugging
The token refresh utility logs helpful messages:
- ✅ Success messages with green checkmarks
- ⚠️ Warnings with yellow triangles  
- ❌ Errors with red X marks
- 🔄 Refresh attempts with arrow

Look for these in the browser console when debugging.

## 📋 Required Custom Claims for Subcontractors

The Firestore security rules require these custom claims:

```typescript
{
  companyId: string;           // Legacy field
  ownCompanyId: string;        // User's own company
  activeCompanyId: string;     // Currently active company context
  role: string;                // User role (ADMIN, MANAGER, SUBCONTRACTOR)
  subcontractorRoles?: {       // Map of company IDs to subcontractor info
    [companyId: string]: {
      subcontractorId: string;
      status: string;
    }
  }
}
```

### For Subcontractors Specifically:
- `activeCompanyId` must match the company they're viewing data for
- `subcontractorRoles` must contain an entry for that company
- `subcontractorRoles[activeCompanyId].subcontractorId` must match the subcontractor ID in the data

## 🔒 How Firestore Rules Work

From `firestore.rules`, the key helper functions:

```javascript
function hasAccessToCompany(compId) {
  return compId == ownCompanyId() || 
         (request.auth.token.subcontractorRoles != null && 
          compId in request.auth.token.subcontractorRoles);
}

function subcontractorIdForActiveCompany() {
  return (request.auth.token.subcontractorRoles != null && 
          activeCompanyId() in request.auth.token.subcontractorRoles)
    ? request.auth.token.subcontractorRoles[activeCompanyId()].subcontractorId
    : null;
}
```

These check:
1. User owns the company, OR
2. User has a subcontractor role for that company
3. When accessing data, the activeCompanyId must match
4. The subcontractorId in the token must match the data

## 🚀 Deployment Notes

### No Deployment Required for Client Code
The client-side fixes are in Next.js pages and will be deployed with your next deployment.

### Cloud Functions Already Deployed
The `refreshClaims` function already exists in your Firebase project, so no new deployment needed.

### Security Rules Already Deployed
The Firestore rules already support the required logic.

## 🐛 Common Issues & Solutions

### Issue: "Permission denied" errors persist after refresh
**Solution**: Have user sign out completely and sign back in. This forces a complete token refresh.

### Issue: User doesn't have subcontractorRoles in claims
**Solution**: 
1. Check if user was properly invited as a subcontractor
2. Check if they accepted the invitation
3. Run `refresh-user-token.ts` script to rebuild claims
4. User must sign out and back in

### Issue: activeCompanyId doesn't match the data's companyId
**Solution**:
1. User may need to switch company context
2. Check the company switcher in the dashboard
3. Verify the user document has correct `activeCompanyId`

### Issue: subcontractorId in claims doesn't match the data
**Solution**:
1. Check the subcontractor document has correct data
2. Check the user's `subcontractorRoles` mapping
3. Rebuild claims with `refresh-user-token.ts`

## 📝 Next Steps

1. **Test the implementation** with a real subcontractor account
2. **Monitor browser console** for any errors or warnings
3. **Check that claims are being set** when subcontractors accept invitations
4. **Consider adding similar error handling** to other subcontractor pages:
   - `/dashboard/my-work/summary`
   - `/dashboard/my-work/submissions`
   - Any other pages that query Firestore data

## 🔧 Future Improvements

Consider these enhancements:
1. **Automatic token refresh on app load** for all subcontractor pages
2. **Proactive claim validation** before making Firestore queries
3. **Better onboarding flow** to ensure claims are set immediately after signup
4. **Periodic token refresh** (e.g., every 30 minutes) to prevent stale tokens
5. **Admin dashboard** to view and fix user claims issues

## 📞 Support

If issues persist:
1. Check browser console for detailed error messages
2. Run the debug scripts to inspect user claims
3. Verify Firestore security rules are deployed correctly
4. Check Firebase Auth custom claims in the Firebase Console
5. Review the Firebase logs for any errors during claim updates
