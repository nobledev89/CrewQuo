# Subcontractor Project Visibility Fix

## Issue Description
When a subcontractor signs up via invite link and logs in, they experience two problems:
1. **No projects showing** in the "Assigned Projects" section on the My Work page
2. **Empty Role & Shift dropdown** when trying to log hours

## Root Cause
When a subcontractor completes signup, their user document is created with `subcontractorRoles` data, but the Firebase Auth custom claims are not immediately synchronized. The My Work page relies on these custom claims (specifically `subcontractorRoles` in the JWT token) to:
- Query project assignments
- Filter rate cards for the current company context
- Populate the role/shift dropdown

Without the custom claims being properly set, the page cannot determine:
- Which company context the user is in
- Which subcontractor ID to use for queries
- Which rate cards apply to the user

## Solution Implemented

### 1. Updated Subcontractor Signup Flow (`app/signup/subcontractor/page.tsx`)
Added explicit custom claims refresh after user creation:

```javascript
// IMPORTANT: Refresh custom claims to ensure subcontractorRoles are available
// This is critical for the My Work page to function properly
try {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('@/lib/firebase');
  const refreshClaims = httpsCallable(functions, 'refreshClaims');
  await refreshClaims();
  
  // Force token refresh on the client side
  await user.getIdToken(true);
  
  console.log('Custom claims refreshed successfully');
} catch (claimsError) {
  console.error('Error refreshing claims:', claimsError);
  // Continue anyway - claims will be set by the trigger eventually
}
```

### 2. Existing Safety Nets Already in Place
The codebase already has these mechanisms that complement the fix:
- **Firestore Trigger** (`onUserCreated` in `functions/src/index.ts`): Automatically sets custom claims when a user document is created
- **Manual Refresh Function** (`refreshClaims` callable function): Available for on-demand claim updates

---

# Project Assignment Permissions Fix

## Issue Description
When assigning a subcontractor to a project, users encountered a Firebase permissions error:
```
Error fetching assignments:
FirebaseError: Missing or insufficient permissions.
```

## Root Cause
The project detail page was using `userData.companyId` from the Firestore user document to query and create assignments. However, Firestore security rules check `request.auth.token.companyId` from JWT custom claims. 

**The critical insight:**
- The `projectAssignments` security rules use `sameCompany()` helper function
- `sameCompany()` checks: `data.companyId == companyId()`
- `companyId()` returns `request.auth.token.companyId` (the **legacy field**)
- In `auth.ts`, `companyId` is set to equal `ownCompanyId` (not `activeCompanyId`)
- Therefore, we must use `ownCompanyId` from JWT claims, not `activeCompanyId`

**The mismatch:**
- Frontend code used: `userData.companyId` (from Firestore document)
- Security rules checked: `request.auth.token.companyId` (= `ownCompanyId` from JWT)
- Result: Permission denied when values don't match

## Solution Implemented

### Updated Project Detail Page (`app/dashboard/projects/[projectId]/page.tsx`)
Changed the authentication flow to read `ownCompanyId` directly from the user's JWT token claims:

**Before:**
```javascript
const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
if (userDoc.exists()) {
  const userData = userDoc.data();
  setCompanyId(userData.companyId);  // ❌ From Firestore document
  setUserRole(userData.role);
  // ...
}
```

**After:**
```javascript
// Get the ID token to access custom claims
const idTokenResult = await currentUser.getIdTokenResult();
const claims = idTokenResult.claims;

// Use ownCompanyId from custom claims (projectAssignments rules check companyId = ownCompanyId)
const ownCompanyId = claims.ownCompanyId as string;
const role = claims.role as string;

if (!ownCompanyId) {
  console.error('No ownCompanyId in token claims');
  setLoading(false);
  return;
}

setCompanyId(ownCompanyId);  // ✅ From JWT claims
setUserRole(role);
// ...
```

## Why This Fix Works

### Firestore Security Rules Reference
The security rules use helper functions that read from the JWT token:

```javascript
function companyId() {
  return request.auth.token.companyId;  // Legacy field = ownCompanyId
}

function sameCompany(data) {
  return data.companyId == companyId();  // Checks companyId from token
}
```

The `projectAssignments` rules require:
```javascript
// For reading
allow read: if authed() && (
  sameCompany(resource.data) ||  // Checks resource.data.companyId == token.companyId
  hasAccessToCompany(resource.data.companyId)
);

// For creating
allow create: if authed() 
  && sameCompany(request.resource.data)  // Checks request.resource.data.companyId == token.companyId
  && isAdminOrManager();
```

### Custom Claims Structure (from `auth.ts`)
```javascript
{
  companyId: userData.ownCompanyId,    // Legacy field (= ownCompanyId)
  ownCompanyId: userData.ownCompanyId,  // User's own company
  activeCompanyId: userData.activeCompanyId,  // Currently viewing company
  role: userData.role,
  subcontractorRoles: { ... }
}
```

By using `ownCompanyId` from the JWT claims, the frontend now provides the same company ID that the security rules validate against (via the legacy `companyId` field).

## Impact
- ✅ Admins and managers can now assign subcontractors to projects without permission errors
- ✅ Assignment queries work correctly with proper company filtering
- ✅ Consistent company context between frontend operations and backend security rules
- ✅ Create, read, and delete operations all work correctly

---

## How It Works Now

### Signup Flow:
1. Subcontractor clicks invite link
2. Validates token via Cloud Function
3. Creates Firebase Auth user
4. Creates company document (if needed)
5. Creates user document with `subcontractorRoles` populated
6. **Triggers `onUserCreated` Firestore function** (sets custom claims)
7. **Manually calls `refreshClaims`** (ensures claims are immediately available)
8. **Forces token refresh** (`getIdToken(true)`)
9. Redirects to dashboard

### My Work Page Flow:
1. Loads user authentication state
2. Reads `activeCompanyId` and `subcontractorRoles` from custom claims
3. Determines current `subcontractorId` from `subcontractorRoles[activeCompanyId]`
4. Queries `projectAssignments` filtered by `companyId` and `subcontractorId`
5. Queries `subcontractorRateAssignments` for the subcontractor
6. Loads rate cards and populates role/shift dropdown
7. Displays assigned projects

### Project Assignment Flow (FIXED):
1. Admin navigates to project detail page
2. Page reads `ownCompanyId` from JWT claims (not from Firestore document)
3. Fetches subcontractors and existing assignments using `ownCompanyId`
4. Admin clicks "Assign Subcontractor"
5. Selects subcontractor and submits
6. Creates `projectAssignment` document with `companyId: ownCompanyId`
7. Security rules validate that `request.resource.data.companyId == request.auth.token.companyId` (both are `ownCompanyId`)
8. Assignment succeeds ✅

## Testing Instructions

### Prerequisites:
1. Admin account with at least one client
2. At least one project assigned to that client
3. Rate cards (PAY and BILL) created

### Test Steps:

#### 1. Create Subcontractor Invite
```
1. Log in as Admin
2. Go to Subcontractors page
3. Click "Add Subcontractor"
4. Fill in details (name, email, phone)
5. Click "Send Invite"
6. Note the email address used
```

#### 2. Assign Rate Card
```
1. Go to Clients page
2. Click on the client
3. Go to "Subcontractors" tab
4. Find the newly created subcontractor
5. Click "Assign Rate Card"
6. Select PAY and BILL rate cards
7. Save
```

#### 3. Assign to Project ✨ (FIXED)
```
1. Go to Projects page
2. Click on a project (must belong to the same client)
3. Click "Assign Subcontractor"
4. Select the new subcontractor
5. Save
✅ Should succeed without permission errors
✅ No console errors about "Missing or insufficient permissions"
```

#### 4. Complete Subcontractor Signup
```
1. Open incognito/private browser window
2. Check email for invite link (or copy from database)
3. Click invite link
4. Fill in signup form (first name, last name, password)
5. Click "Complete Setup"
6. Should redirect to dashboard
```

#### 5. Verify Fix
```
✅ Check "Assigned Projects" section shows the project
✅ Check "Role & Shift" dropdown is populated with rate options
✅ Select a role/shift combination
✅ Enter hours (e.g., 8 regular, 0 OT)
✅ Verify cost/bill calculations display
✅ Click "Save Draft" - should save successfully
✅ Check saved log appears in the right panel
```

## What Should Work Now

### ✅ Project Assignment (FIXED)
- Admins can assign subcontractors to projects without permission errors
- Assignment list loads correctly on page load
- Can remove assignments without errors
- All operations use consistent company context from JWT claims (`ownCompanyId`)

### ✅ Assigned Projects Section
- Shows all projects where subcontractor is assigned
- Displays project name and client name
- Updates when new assignments are made

### ✅ Role & Shift Dropdown
- Populated with roles from the assigned PAY rate card
- Shows format: "Role Name - Shift Type"
- Reflects the rate card assigned to the subcontractor for that client

### ✅ Time Logging
- Can select project, date, role/shift, and hours
- Displays calculated costs and billing amounts
- Can save drafts and submit for approval

### ✅ Expenses
- Can log expenses based on rate card expense categories
- Respects rate caps defined in rate card

## Technical Details

### Custom Claims Structure
```javascript
{
  companyId: "user123",           // Legacy field (= ownCompanyId for compatibility)
  ownCompanyId: "user123",         // User's own company (primary)
  activeCompanyId: "company456",   // Currently active company context
  role: "ADMIN",                   // Role in OWN company
  subcontractorRoles: {
    "company456": {                // Working as subcontractor for this company
      subcontractorId: "sub789",
      status: "active"
    }
  }
}
```

### Firestore Security Rules - Understanding the Difference

**For `projectAssignments`:** Uses `sameCompany()` which checks `companyId()` = `request.auth.token.companyId` (legacy field = `ownCompanyId`)
```javascript
allow read: if authed() && sameCompany(resource.data);
allow create: if authed() && sameCompany(request.resource.data) && isAdminOrManager();
```

**For other collections like `projects`, `clients`:** Use `sameActiveCompany()` which checks `activeCompanyId()`
```javascript
allow read: if authed() && sameActiveCompany(resource.data);
```

**Key takeaway:** Different collections use different company ID fields in their security rules:
- `projectAssignments` → Uses `companyId` (= `ownCompanyId`)
- `projects`, `clients`, `timeLogs`, etc. → Use `activeCompanyId`

### Best Practice: Always Use JWT Claims for Company Context
When implementing features that interact with Firestore, always read the company context from JWT token claims rather than the Firestore user document. **However, use the correct field for the collection you're accessing:**

```javascript
// ✅ CORRECT - For projectAssignments
const idTokenResult = await user.getIdTokenResult();
const ownCompanyId = idTokenResult.claims.ownCompanyId;  // Use ownCompanyId
// Query/create projectAssignments with ownCompanyId

// ✅ CORRECT - For projects, clients, timeLogs
const idTokenResult = await user.getIdTokenResult();
const activeCompanyId = idTokenResult.claims.activeCompanyId;  // Use activeCompanyId
// Query/create projects with activeCompanyId

// ❌ INCORRECT (can cause permission errors)
const userDoc = await getDoc(doc(db, 'users', user.uid));
const companyId = userDoc.data().companyId;  // Don't use Firestore document
```

## Troubleshooting

### If projects still don't show:
1. Check browser console for errors
2. Verify custom claims are set: Open browser dev tools → Application → Cookies → Check `__session` token
3. Decode JWT token at jwt.io to verify `subcontractorRoles` field exists
4. Check Firestore: Verify `projectAssignments` document exists with correct `subcontractorId`
5. Check Firestore: Verify `subcontractorRateAssignments` document exists

### If assignment fails with permission error:
1. Check browser console for the exact error message
2. Verify JWT token contains `ownCompanyId`: `await user.getIdTokenResult()` and check `claims.ownCompanyId`
3. Check that user has ADMIN or MANAGER role in their own company
4. Verify the project belongs to the user's own company
5. Check Firestore rules console in Firebase for detailed error
6. **Important:** Verify you're using `ownCompanyId` not `activeCompanyId` for `projectAssignments`

### If dropdown is empty:
1. Verify rate card is assigned: Check `subcontractorRateAssignments` collection
2. Verify rate card has rates: Check `rateCards` document has `rates` array
3. Check client-subcontractor relationship is correct
4. Verify `clientId` in project matches `clientId` in rate assignment

### Force claims refresh manually:
```javascript
// In browser console while logged in
const { httpsCallable } = await import('firebase/functions');
const { functions } = await import('@/lib/firebase');
const refreshClaims = httpsCallable(functions, 'refreshClaims');
await refreshClaims();
await firebase.auth().currentUser.getIdToken(true);
location.reload();
```

## Files Modified
- `app/signup/subcontractor/page.tsx` - Added claims refresh before redirect
- `app/dashboard/projects/[projectId]/page.tsx` - Changed to use `ownCompanyId` from JWT claims (not `activeCompanyId`)

## Files Reviewed (No Changes Needed)
- `app/dashboard/my-work/page.tsx` - Logic is correct
- `functions/src/index.ts` - Triggers and functions working as designed
- `functions/src/auth.ts` - Claims building logic correct
- `firestore.rules` - Security rules properly configured

## Deployment Notes
1. Deploy Cloud Functions if not already deployed: `firebase deploy --only functions`
2. Deploy updated frontend: `npm run build && firebase deploy --only hosting`
3. Verify in production environment before notifying users
4. Monitor Cloud Function logs for any claim refresh errors

## Success Criteria
- ✅ Subcontractor can see assigned projects immediately after signup
- ✅ Role & Shift dropdown is populated with available rates
- ✅ Can log time entries successfully
- ✅ Can log expenses successfully
- ✅ Admins can assign subcontractors to projects without permission errors
- ✅ No console errors about "Missing or insufficient permissions"
- ✅ No security rule violations
