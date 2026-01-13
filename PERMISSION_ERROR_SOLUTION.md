# Permission Error Solution

## Problem Identified

From the screenshot, you're seeing:
```
Error: Permission denied. Your session may be outdated. Please try signing out and signing back in, or contact your administrator.

Console Error: Error querying project data: FirebaseError: Missing or insufficient permissions.
```

## Root Cause

The Firebase Authentication custom claims are either:
1. **Missing** - Not set on the user account
2. **Stale** - Cached in the browser and outdated
3. **Incorrect** - User doesn't actually have access to this company/project

## Immediate Solutions (Try in order)

### Solution 1: Sign Out and Back In (90% success rate)
This forces Firebase to fetch fresh custom claims from the server.

1. Click on your profile/user menu
2. Click "Sign Out"
3. Sign back in with your credentials
4. Try accessing the project again

**Why this works**: Signing out clears the cached authentication token. When you sign back in, Firebase fetches fresh custom claims from the server.

---

### Solution 2: Hard Refresh + Clear Cache
If signing out doesn't work, try this:

1. Press `Ctrl + Shift + Delete` (Chrome/Edge) to open Clear Browsing Data
2. Select "Cookies and other site data" and "Cached images and files"
3. Time range: "Last 24 hours"
4. Click "Clear data"
5. Close and reopen the browser
6. Sign in again

---

### Solution 3: Check User Claims (For Admins/Developers)

Run the debug script to verify custom claims are properly set:

```bash
npm run build:functions
npx tsx scripts/debug-user-claims.ts your-email@example.com
```

This will show:
- Current custom claims on the user account
- Company associations
- Subcontractor roles
- Expected vs actual values

Look for:
- `activeCompanyId`: Should match the company you're trying to access
- `subcontractorRoles`: Should contain an entry for the company ID
- `role`: Should be set (ADMIN, MANAGER, or SUBCONTRACTOR)

---

### Solution 4: Manually Refresh Custom Claims (Cloud Function)

If you have a Cloud Function endpoint for refreshing claims:

```bash
# Call the refresh claims function (if deployed)
curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/refreshUserClaims \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_UID_HERE"}'
```

---

### Solution 5: Re-create User Claims (Nuclear Option)

If nothing else works, the custom claims need to be manually reset:

```bash
# Run the set-claims script
npx tsx scripts/set-claims.ts
```

This will:
1. Find all users
2. Recalculate their proper custom claims based on database records
3. Update Firebase Auth with correct claims

---

## Technical Details

### What Custom Claims Are Needed

For accessing projects as a **subcontractor**, your Firebase Auth token needs:

```json
{
  "role": "SUBCONTRACTOR",
  "activeCompanyId": "company_XYZ",
  "ownCompanyId": "your_own_company_id",
  "subcontractorRoles": {
    "company_XYZ": {
      "subcontractorId": "subcontractor_ABC",
      "role": "subcontractor"
    }
  }
}
```

For **company admins/managers**:

```json
{
  "role": "ADMIN",
  "activeCompanyId": "company_XYZ",
  "ownCompanyId": "company_XYZ",
  "companyId": "company_XYZ"
}
```

### Firestore Rules That Check These Claims

```javascript
// Projects collection
match /projects/{projectId} {
  allow read: if authed() && hasAccessToCompany(resource.data.companyId);
}

function hasAccessToCompany(compId) {
  return compId == ownCompanyId() || 
         (request.auth.token.subcontractorRoles != null && 
          compId in request.auth.token.subcontractorRoles);
}
```

The rules check:
1. **Is user authenticated?** (`authed()`)
2. **Does user own this company?** (`compId == ownCompanyId()`)
3. **OR does user have subcontractor access?** (`compId in request.auth.token.subcontractorRoles`)

If none of these are true, Firestore returns "Missing or insufficient permissions".

---

## Prevention

To prevent this issue in the future:

1. **Ensure Cloud Functions are deployed** - These set custom claims when users accept invites or are assigned to projects
2. **Use the token refresh utility** - Already implemented in the codebase (`lib/tokenRefresh.ts`)
3. **Monitor user onboarding** - Make sure new subcontractors properly accept invites

---

## Quick Diagnostic Checklist

Run through these questions:

- [ ] Has this user ever successfully logged in before?
- [ ] Was this user recently invited/added as a subcontractor?
- [ ] Did they complete the invitation acceptance flow?
- [ ] Are the Firebase Cloud Functions deployed and working?
- [ ] Can other users access the same project without issues?
- [ ] Has this user tried signing out and back in?

---

## Related Files

- `lib/tokenRefresh.ts` - Token refresh utility
- `firestore.rules` - Security rules
- `functions/src/auth.ts` - Cloud function that sets custom claims
- `scripts/debug-user-claims.ts` - Debug script for checking claims
- `scripts/set-claims.ts` - Script to manually set claims

---

## Status

This is a **known issue** with Firebase custom claims caching. The automatic retry logic in the code should handle most cases, but occasionally users need to manually sign out/in to get fresh claims.
