# Running Bill - REJECTED Status Fix

## Issue
When an admin rejects a timesheet, the entries are marked with `status: 'REJECTED'`. However, the **Live Tracking & Running Bill** section was not displaying these REJECTED entries because the aggregation logic only processed DRAFT, SUBMITTED, and APPROVED statuses.

This meant that rejected timesheets would disappear from the running bill, making it impossible for admins to track work that needs to be corrected and resubmitted.

## Root Cause
The `aggregateProjectCosts()` function in `lib/projectTrackingUtils.ts` had TypeScript types that only included three statuses:
- `'draft' | 'submitted' | 'approved'`

When processing entries with `status: 'REJECTED'`, the type casting failed and these entries were silently skipped.

## Solution Implemented

### 1. Updated TypeScript Interfaces (`lib/projectTrackingUtils.ts`)
Added `rejected` status to type definitions:

```typescript
export interface ProjectTracking {
  byStatus: {
    draft: StatusBreakdown;
    submitted: StatusBreakdown;
    approved: StatusBreakdown;
    rejected: StatusBreakdown;  // ✅ ADDED
  };
}

export interface SubcontractorTracking {
  byStatus: {
    draft: StatusBreakdown;
    submitted: StatusBreakdown;
    approved: StatusBreakdown;
    rejected: StatusBreakdown;  // ✅ ADDED
  };
}
```

### 2. Updated Aggregation Logic (`lib/projectTrackingUtils.ts`)

**Changed status type casting:**
```typescript
// Before:
const status = (log.status || 'DRAFT').toLowerCase() as 'draft' | 'submitted' | 'approved';

// After:
const status = (log.status || 'DRAFT').toLowerCase() as 'draft' | 'submitted' | 'approved' | 'rejected';
```

**Initialized rejected breakdown:**
```typescript
const byStatus: ProjectTracking['byStatus'] = {
  draft: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
  submitted: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
  approved: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
  rejected: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },  // ✅ ADDED
};
```

**Same changes applied to:**
- Time logs processing
- Expenses processing
- Subcontractor tracking initialization

### 3. Updated UI (`app/dashboard/projects/[projectId]/page.tsx`)

**Changed grid layout:**
```typescript
// Before:
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

// After:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Added REJECTED status card:**
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm font-semibold text-red-700">🔴 REJECTED (Needs Fixing)</span>
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('REJECTED')}`}>
      {projectTracking.byStatus.rejected.count}
    </span>
  </div>
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="text-red-700">Hours:</span>
      <span className="font-semibold text-red-900">{projectTracking.byStatus.rejected.hours.toFixed(1)}h</span>
    </div>
    <div className="flex justify-between">
      <span className="text-red-700">Cost:</span>
      <span className="font-semibold text-red-900">{formatCurrency(projectTracking.byStatus.rejected.cost, currency)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-red-700">Bill:</span>
      <span className="font-semibold text-red-900">{formatCurrency(projectTracking.byStatus.rejected.billing, currency)}</span>
    </div>
  </div>
</div>
```

### 4. Updated SubcontractorCostBreakdown (`components/SubcontractorCostBreakdown.tsx`)

**Changed grid layout:**
```typescript
// Before:
<div className="grid grid-cols-3 gap-4">

// After:
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

**Added REJECTED status card** in the status breakdown section

## Expected Behavior After Fix

### ✅ Workflow
1. **Admin rejects timesheet** → Entries marked as `REJECTED` → **Now visible in running bill** with red "REJECTED (Needs Fixing)" status
2. **Subcon views in submissions** → Sees rejection reason and can cancel submission
3. **Subcon cancels rejected submission** → Entries revert to `DRAFT` → Still visible in running bill
4. **Subcon edits entries** → Still `DRAFT` → Still in running bill
5. **Subcon resubmits** → Entries marked `SUBMITTED` → Visible in running bill
6. **Admin approves** → Entries marked `APPROVED` → Visible in running bill (finalized)

### ✅ Display
- **Total Cards**: REJECTED entries now count toward Total Hours, Total Cost, Total Billing, and Total Margin
- **Status Breakdown**: New 4th card shows "🔴 REJECTED (Needs Fixing)" with hours, cost, and billing
- **Subcontractor Breakdown**: REJECTED entries appear with red status badges in the line items table
- **Status Tab**: Subcontractors can now see their rejected status in the expandable breakdown

## Files Modified
1. `lib/projectTrackingUtils.ts` - Core aggregation logic
2. `app/dashboard/projects/[projectId]/page.tsx` - Admin project detail page UI
3. `components/SubcontractorCostBreakdown.tsx` - Subcontractor breakdown component

## Testing Recommendations
1. Create a timesheet with time logs and expenses
2. Submit the timesheet
3. Reject it as admin with a reason
4. Verify REJECTED entries appear in the Live Tracking & Running Bill
5. As subcon, cancel the rejected submission
6. Verify entries revert to DRAFT and remain visible
7. Edit and resubmit
8. Verify the entire workflow

## Notes
- REJECTED entries are treated as "work in progress" and count toward running totals
- The fix maintains backward compatibility with existing DRAFT/SUBMITTED/APPROVED workflows
- The status badge colors make it easy to identify rejected work at a glance

---

**Fixed on**: March 5, 2026
**Issue**: REJECTED entries not showing in running bill
**Resolution**: Added REJECTED status support to aggregation and UI
