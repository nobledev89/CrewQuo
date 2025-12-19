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

#### 3. Assign to Project
```
1. Go to Projects page
2. Click on a project (must belong to the same client)
3. Click "Assign Subcontractor"
4. Select the new subcontractor
5. Save
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
  companyId: "user123",           // Legacy field
  ownCompanyId: "user123",         // User's own company
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

### Firestore Security Rules
The rules use these custom claims:
- `hasAccessToCompany()` - Checks if user owns or has subcontractor role
- `subcontractorIdForActiveCompany()` - Extracts subcontractor ID from claims
- Allows read/write operations based on company context

## Troubleshooting

### If projects still don't show:
1. Check browser console for errors
2. Verify custom claims are set: Open browser dev tools → Application → Cookies → Check `__session` token
3. Decode JWT token at jwt.io to verify `subcontractorRoles` field exists
4. Check Firestore: Verify `projectAssignments` document exists with correct `subcontractorId`
5. Check Firestore: Verify `subcontractorRateAssignments` document exists

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
- ✅ No console errors or security rule violations
