# Cancelled Project Access Fix

## Issue
Client users were able to see "Pashe Jobs February 2026" (PWC-20260201P) in the client portal, even though it was marked as CANCELLED and not listed in the granted access list on the contractor's client management page.

## Root Cause
The project had an active `clientProjectAccess` record in the database even though the project status was set to CANCELLED. This occurred because:
- Access was granted to the project when it was active
- The project was later cancelled
- The access record was not automatically revoked when the project status changed

## Diagnosis
Used `scripts/diagnose-pashe-access.js` to query the database and identify:
- 5 active access records for PricewaterhouseCoopers
- 1 CANCELLED project ("Pashe Jobs February 2026") with active access
- Access ID: `L6IB0OmYSY3gZ8Dfzh1L_cuI02LFwrFCFMRqTgHmq`

## Solution Implemented

### 1. Database Fix
Created and ran `scripts/fix-cancelled-project-access.js` which:
- Queries all active `clientProjectAccess` records
- Checks the status of each associated project
- Automatically revokes access for CANCELLED projects by:
  - Setting `active: false`
  - Adding `revokedAt` timestamp
  - Adding `revokedReason: "Project cancelled"`
  - Adding `autoRevoked: true` flag

**Result:** Successfully revoked access to 1 CANCELLED project

### 2. Client Portal Safeguard
Updated `app/dashboard/client-portal/page.tsx` to filter out CANCELLED projects even if they have active access records:

```typescript
// Filter out null and CANCELLED projects (safety check - access should have been revoked)
setProjects(projectsData.filter(p => p !== null && p.status !== 'CANCELLED') as Project[]);
```

This ensures that even if a project is cancelled and the access record isn't immediately revoked, it won't be visible to clients.

## Files Modified
- `app/dashboard/client-portal/page.tsx` - Added CANCELLED project filter
- `scripts/diagnose-pashe-access.js` - Diagnostic script (new)
- `scripts/fix-cancelled-project-access.js` - Fix script (new)
- `CANCELLED_PROJECT_ACCESS_FIX.md` - This documentation (new)

## Testing
After the fix:
- Cancelled project "Pashe Jobs February 2026" should no longer appear in the client portal
- Client should only see 4 projects (down from 5):
  - Pashe Jobs March 2026 (ACTIVE)
  - Hanmore Jobs March 2026 (ACTIVE)
  - CSL Jobs March 2026 (ACTIVE)
  - Hanmore Jobs February 2026 (COMPLETED)

## Prevention
The client portal now has a defensive filter that prevents CANCELLED projects from being displayed, even if access records aren't properly cleaned up. For full prevention, consider:
- Adding a Firestore function to automatically revoke access when a project status changes to CANCELLED
- Adding validation in the project update logic to check and revoke access
- Periodic cleanup script to catch any orphaned access records

## Scripts

### Diagnose Issues
```bash
node scripts/diagnose-pashe-access.js
```

### Fix Cancelled Project Access (if needed again)
```bash
node scripts/fix-cancelled-project-access.js
```

## Deployment
Date: March 9, 2026
Deployed to: Production (Vercel)
