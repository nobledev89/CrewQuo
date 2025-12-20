# Subcontractor Permission Fix

## Issue
Subcontractors were experiencing permission errors when accessing the "My Work" page:
- Error: `FirebaseError: Missing or insufficient permissions`
- Affected collections: `subcontractorRateAssignments` and `rateCards`

## Root Cause
The Firestore security rules for `rateCards` and `subcontractorRateAssignments` collections were using `sameCompany(resource.data)` which checked if the data belonged to the user's **own company** (`companyId`).

However, subcontractors work in **corporate companies** (their `activeCompanyId`) and need to read rate cards and assignments that belong to those corporate companies, not their own company.

## Solution
Updated the Firestore rules to use `hasAccessToCompany(resource.data.companyId)` instead of `sameCompany(resource.data)` for read operations on these collections:

### Changed Rules:

**Rate Cards:**
```javascript
// Before:
allow read: if authed() && sameCompany(resource.data);

// After:
allow read: if authed() && hasAccessToCompany(resource.data.companyId);
```

**Subcontractor Rate Assignments:**
```javascript
// Before:
allow read: if authed() && sameCompany(resource.data);

// After:
allow read: if authed() && hasAccessToCompany(resource.data.companyId);
```

## How hasAccessToCompany() Works
The helper function checks if a user has access to a company by:
1. Checking if it's their own company (`compId == ownCompanyId()`)
2. OR checking if they have a subcontractor role for that company (`compId in request.auth.token.subcontractorRoles`)

This allows subcontractors to read:
- Rate cards from corporate companies they work for
- Rate assignments that define their pay rates with those companies

## Deployment
- Rules deployed to Firebase: ✅
- Date: December 20, 2025
- Command: `firebase deploy --only firestore:rules`

## Testing
After the fix:
1. Subcontractors can now access their "My Work" page without permission errors
2. They can view their assigned projects with associated rate cards
3. They can see their rate assignments for different clients

## Files Modified
- `firestore.rules` - Updated read permissions for `rateCards` and `subcontractorRateAssignments`
