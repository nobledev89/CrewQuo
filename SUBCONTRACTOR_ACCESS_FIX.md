# Subcontractor Access Revocation Fix

## Problem

When deleting a subcontractor from the admin dashboard, the subcontractor retained access to previously assigned projects. This occurred because the deletion only removed the subcontractor document from Firestore, but did not:

1. Remove the company from the user's `subcontractorRoles` field
2. Refresh the user's JWT custom claims
3. Delete project assignments
4. Clean up rate card assignments

As a result, the user's authentication token still contained the company in their `subcontractorRoles`, allowing them to pass the Firestore security rules check:

```javascript
function hasAccessToCompany(compId) {
  return compId == ownCompanyId() || 
         (request.auth.token.subcontractorRoles != null && 
          compId in request.auth.token.subcontractorRoles);
}
```

## Solution

Implemented a Cloud Function (`onSubcontractorDelete`) that automatically triggers when a subcontractor document is deleted. The function performs comprehensive cleanup:

### Cleanup Actions

1. **Update User Document**: Removes the company from the user's `subcontractorRoles` map
2. **Switch Active Company**: If the deleted company was the user's active company, switches them back to their own company
3. **Refresh Custom Claims**: Updates the user's JWT token to immediately revoke access
4. **Delete Project Assignments**: Removes all project assignments for the subcontractor
5. **Delete Rate Assignments**: Removes all rate card assignments for the subcontractor
6. **Preserve Audit Trail**: Intentionally does NOT delete time logs, expenses, or submissions to maintain historical data

### Implementation Details

**Location**: `functions/src/index.ts`

**Function Name**: `onSubcontractorDelete`

**Trigger**: Firestore document deletion on `subcontractors/{subcontractorId}`

**Key Features**:
- Handles both invited subcontractors (with user accounts) and manual subcontractors
- Uses batched operations for efficient bulk deletions
- Includes comprehensive error handling and logging
- Non-blocking - errors in one step don't prevent other cleanup steps

### Code Structure

```typescript
export const onSubcontractorDelete = functions.firestore
  .document('subcontractors/{subcontractorId}')
  .onDelete(async (snap, context) => {
    // 1. Remove company from user's subcontractorRoles
    // 2. Switch activeCompanyId if needed
    // 3. Refresh user's custom claims
    // 4. Delete project assignments
    // 5. Delete rate assignments
  });
```

### Helper Functions

- `deleteProjectAssignments()`: Batch deletes all project assignments
- `deleteRateAssignments()`: Batch deletes all rate card assignments

## Deployment

To deploy this fix:

```bash
cd functions
npm run build
firebase deploy --only functions:onSubcontractorDelete
```

Or deploy all functions:

```bash
firebase deploy --only functions
```

## Testing

1. **Create a test subcontractor**:
   - Add a subcontractor with an invite
   - Have them accept the invite
   - Assign them to a project

2. **Verify access**:
   - Log in as the subcontractor
   - Confirm they can access the project

3. **Delete the subcontractor**:
   - Log in as admin
   - Delete the subcontractor from the dashboard

4. **Verify access revocation**:
   - The subcontractor should no longer see the company in their list
   - They should not be able to access any projects from that company
   - Check Cloud Functions logs for confirmation of cleanup

## Monitoring

Check Firebase Cloud Functions logs:

```bash
firebase functions:log --only onSubcontractorDelete
```

Expected log output:
```
Subcontractor deleted: {subcontractorId}, Company: {companyId}, User: {userId}
Removed company {companyId} from user {userId}'s subcontractorRoles
Refreshed custom claims for user {userId}
Deleted {count} project assignments for subcontractor {subcontractorId}
Deleted {count} rate assignments for subcontractor {subcontractorId}
Cleanup completed for subcontractor {subcontractorId}
```

## Security Considerations

- The function runs with Admin SDK privileges, bypassing Firestore security rules
- All operations are logged for audit purposes
- Historical data (time logs, expenses, submissions) is preserved
- User JWT tokens are refreshed immediately to revoke access

## Future Enhancements

Consider adding:
1. Email notification to the subcontractor when access is revoked
2. Grace period before full deletion (soft delete)
3. Admin dashboard showing cleanup status
4. Undo functionality for accidental deletions

## Related Files

- `functions/src/index.ts` - Cloud Function implementation
- `functions/src/auth.ts` - Custom claims management
- `firestore.rules` - Security rules using custom claims
- `app/dashboard/subcontractors/page.tsx` - Subcontractor deletion UI

## Date

Implemented: January 28, 2026
