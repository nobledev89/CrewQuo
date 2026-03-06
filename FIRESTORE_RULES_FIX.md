# Firestore Rules Fix - Projects Not Showing Issue

## Date: March 6, 2026

## Issue
Main contractor admin users could not see projects when navigating to `Clients > [ClientId] > Projects`, showing "no project found". However:
- Clients could see their granted projects (3 out of 7)
- Data in Firestore was correct (all 7 projects existed)
- The debug box showed correct Company ID and Client ID but 0 projects found

## Root Cause

The `hasAccessToCompany()` helper function in Firestore security rules was **not checking `activeCompanyId`**.

### The Problem
```javascript
function hasAccessToCompany(compId) {
  return compId == ownCompanyId() || 
         (request.auth.token.subcontractorRoles != null && 
          compId in request.auth.token.subcontractorRoles);
}
```

This function only checked:
1. If `compId == ownCompanyId` (user's original/own company)
2. If user is a subcontractor in that company

### Why It Failed
Users in this system have:
- `ownCompanyId`: Their original company ID (e.g., `5O89NyVFwke0efy5RroKCtsnrjJ3`)
- `activeCompanyId`: The company they're currently viewing (e.g., `yTV9Jf8u36TiW1bnPu7UT9J5TAw1`)

When users are viewing a different company than their own (via activeCompanyId), the security rules were blocking their access because:
- Projects had `companyId: yTV9Jf8u36TiW1bnPu7UT9J5TAw1`
- User had `ownCompanyId: 5O89NyVFwke0efy5RroKCtsnrjJ3`
- `hasAccessToCompany()` returned false
- Firestore blocked the query

## Solution

Updated the `hasAccessToCompany()` function to also check `activeCompanyId`:

```javascript
function hasAccessToCompany(compId) {
  return compId == ownCompanyId() || 
         compId == activeCompanyId() ||  // ← ADDED THIS LINE
         (request.auth.token.subcontractorRoles != null && 
          compId in request.auth.token.subcontractorRoles);
}
```

This allows users to access data from companies they're currently viewing via `activeCompanyId`.

## Files Changed

- `firestore.rules` - Updated `hasAccessToCompany()` function

## Deployment

1. ✅ Updated Firestore rules locally
2. ✅ Deployed to Firebase: `firebase deploy --only firestore:rules`
3. ⏳ Push to git main for Vercel auto-deploy

## Verification

After deployment, users should now:
1. Be able to see all 7 projects when visiting `Clients > [ClientId] > Projects`
2. No longer see "no project found" error
3. The debug box should show "Projects Found: 7"

## Impact

This fix affects all collections that use the `hasAccessToCompany()` helper function, including:
- Companies
- Users (list queries)
- Role Catalog
- Clients
- Subcontractors
- Projects
- Rate Card Templates
- Rate Cards
- Subcontractor Rate Assignments

All these collections now properly respect the `activeCompanyId` for access control.

## Notes

- This issue only affected users who were viewing companies other than their `ownCompanyId`
- The diagnostic script confirmed no data corruption - all data was intact
- Client portal access was working because it uses a different access control mechanism (via `clientProjectAccess` collection)
