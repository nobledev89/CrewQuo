# Company Mismatch Diagnosis Results

## Date: March 6, 2026

## Issue Reported
Main contractor admin cannot see projects when navigating to Clients > Projects, showing "no project found". However, clients can see their 3 granted projects fine.

## Diagnostic Results

### Summary
**NO DATA MISMATCH FOUND!** All 7 projects have the correct companyId matching the users' activeCompanyId.

### Details
- **Company ID**: `yTV9Jf8u36TiW1bnPu7UT9J5TAw1`
- **Client**: PricewaterhouseCoopers (`h3Os4IWCHgNwzu8Wlo5g`)
- **Total Projects**: 7
- **All projects** have matching companyId: `yTV9Jf8u36TiW1bnPu7UT9J5TAw1`
- **Client Project Access**: 3 projects granted access via `clientProjectAccess`

### User Accounts Checked
All admin/manager users have `activeCompanyId: yTV9Jf8u36TiW1bnPu7UT9J5TAw1`:
1. hernani.jay@gmail.com (ADMIN)
2. pwc@corporatespec.com (ADMIN)
3. pashesolutionslimited@yahoo.com (ADMIN)
4. hanmoreltd@gmail.com (ADMIN)
5. dpnh89@gmail.com (ADMIN)
6. karl@hanmoreandfamily.com (ADMIN)
7. jay@corporatespec.com (MANAGER)
8. dan@corporatespec.com (ADMIN)

## Potential Causes

Since the data is correct, the issue is likely:

### 1. **Runtime/Caching Issue**
- User's authentication token might have stale company ID
- Browser cache might have old data
- Need to check what companyId is actually being used at runtime

### 2. **Client Filter Issue**
- User might be viewing a different client than expected
- Need to verify which clientId is being queried

### 3. **Page State Issue**
- The debug box on the page should show the actual values being used
- Need user to check: Company ID, Client ID, Projects Found count

## Next Steps

1. **Ask user to check debug box** on `/dashboard/clients/[clientId]/projects` page
2. **Ask which email** they're logged in as
3. **Check browser console** for any errors
4. **Try hard refresh** (Ctrl+Shift+R) to clear cache
5. **Try logging out and back in** to refresh authentication token

## Scripts Created

- `scripts/diagnose-company-mismatch.js` - Diagnostic script (completed)
- `scripts/fix-company-mismatch.js` - Fix script (not needed - no mismatch found!)
