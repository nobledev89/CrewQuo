# Subcontractor Permission Fix

## Issues Fixed
Subcontractors were experiencing multiple permission errors:

### 1. Initial Error - Reading Data
- Error: `FirebaseError: Missing or insufficient permissions`
- Affected collections: `subcontractorRateAssignments` and `rateCards`
- **Root Cause**: Rules used `sameCompany()` which checked the user's own company instead of their active company

### 2. Saving Time Logs Error
- Error: `Error saving log: FirebaseError: Missing or insufficient permissions`
- Affected collection: `timeLogs`
- **Root Cause**: Rules only allowed creating time logs with `DRAFT` status, but the UI allowed submitting directly with `SUBMITTED` status

### 3. Saving Expenses Error
- Error: `Error saving expense: FirebaseError: Missing or insufficient permissions`
- Affected collection: `expenses`
- **Root Cause**: Same as time logs - rules only allowed `DRAFT` status on creation

## Solutions Implemented

### Fix 1: Rate Cards & Rate Assignments Read Access
Updated the Firestore rules to use `hasAccessToCompany(resource.data.companyId)` instead of `sameCompany(resource.data)`:

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

### Fix 2: Time Logs Creation
Allow subcontractors to create time logs with either `DRAFT` or `SUBMITTED` status:

```javascript
// Before:
&& request.resource.data.status == 'DRAFT'

// After:
&& request.resource.data.status in ['DRAFT', 'SUBMITTED']
```

### Fix 3: Expenses Creation
Allow subcontractors to create expenses with either `DRAFT` or `SUBMITTED` status:

```javascript
// Before:
&& request.resource.data.status == 'DRAFT'

// After:
&& request.resource.data.status in ['DRAFT', 'SUBMITTED']
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
After the fixes:
1. ✅ Subcontractors can now access their "My Work" page without permission errors
2. ✅ They can view their assigned projects with associated rate cards
3. ✅ They can see their rate assignments for different clients
4. ✅ Time logs can be saved as either DRAFT or directly SUBMITTED
5. ✅ Expenses can be saved as either DRAFT or directly SUBMITTED
6. ✅ Projects and clients data loads correctly (via `sameActiveCompany()` check)

## Key Concepts

### Active Company vs Own Company
- **Own Company**: The company the subcontractor created (their business entity)
- **Active Company**: The corporate company they're currently working for
- Subcontractors need access to data in their **active company**, not just their own

### Status Workflow
Subcontractors can now:
- Save time logs/expenses as **DRAFT** (for later submission)
- Submit time logs/expenses directly as **SUBMITTED** (for approval)
- Edit items that are **DRAFT** or **REJECTED**
- Cannot edit items that are **SUBMITTED** or **APPROVED**

## Files Modified
- `firestore.rules` - Updated permissions for:
  - `rateCards` (read access)
  - `subcontractorRateAssignments` (read access)
  - `timeLogs` (creation with DRAFT or SUBMITTED status)
  - `expenses` (creation with DRAFT or SUBMITTED status)
