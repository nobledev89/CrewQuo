# Live Project Tracking & Running Bill Feature

## Overview
The Live Project Tracking feature allows admin/main contractors to see **real-time** logged hours, costs, and margins from subcontractors **before they submit** timesheets. This provides complete visibility into project costs as work is being logged.

## Key Features

### ✅ Real-Time Visibility
- See ALL logged work regardless of status (DRAFT, SUBMITTED, APPROVED)
- Track unsubmitted hours and costs as subcontractors log them
- Monitor running project totals in real-time

### ✅ Complete Financial Breakdown
- **Total Hours**: All logged hours across all subcontractors
- **Total Cost**: What you pay subcontractors (subCost)
- **Total Billing**: What you charge clients (clientBill)
- **Total Margin**: Profit margin with percentage

### ✅ Status-Based Tracking
View breakdown by status:
- **🟡 DRAFT**: Unsubmitted work (logged but not yet submitted)
- **🟠 SUBMITTED**: Pending approval (submitted but not approved)
- **🟢 APPROVED**: Finalized work (approved timesheets)

### ✅ Subcontractor Breakdown
For each subcontractor:
- Total hours, cost, billing, and margin
- Status breakdown (draft/submitted/approved)
- Expandable line-by-line detail view
- Individual time logs and expenses with:
  - Date, role, shift, hours/quantity
  - Cost, billing, and margin per line item
  - Status indicator

## User Interface

### Navigation
Admin project detail page now has two tabs:
1. **Subcontractor Assignments** - Manage which subcontractors work on the project
2. **Live Tracking & Running Bill** - Real-time cost tracking

### Live Tracking Dashboard Components

#### 1. Summary Cards (Top Row)
Four gradient cards showing:
- Total Hours (blue) - All logged hours
- Total Cost (red) - What you pay
- Total Billing (green) - What you charge
- Total Margin (purple) - Your profit

#### 2. Status Breakdown
Three-column grid showing:
- Draft (yellow) - Unsubmitted work
- Submitted (orange) - Pending approval  
- Approved (green) - Finalized

Each shows hours, cost, and billing totals.

#### 3. Subcontractor Breakdown
Expandable cards for each subcontractor with:
- **Header**: Name, total hours, total entries, cost, bill, margin
- **Status Tabs**: Draft/Submitted/Approved breakdown
- **Line Items Table** (when expanded):
  - Date, Type, Description, Quantity/Hours
  - Cost, Bill, Margin, Margin %
  - Status badge

## Technical Implementation

### Files Created/Modified

#### New Files:
1. **`lib/projectTrackingUtils.ts`**
   - `aggregateProjectCosts()` - Aggregates all time logs and expenses
   - `formatCurrency()` - Currency formatting
   - `formatDate()` - Date formatting
   - `getStatusColor()` - Status badge colors
   - Type definitions for tracking data structures

2. **`components/SubcontractorCostBreakdown.tsx`**
   - Expandable subcontractor cost card
   - Line-by-line detail view
   - Status breakdown display

#### Modified Files:
1. **`app/dashboard/projects/[projectId]/page.tsx`**
   - Added tab navigation
   - Added live tracking state management
   - Added `fetchLiveTrackingData()` function
   - Integrated SubcontractorCostBreakdown component

### Data Flow

```
1. Admin views project detail page
2. System fetches ALL time logs (not just approved)
3. System fetches ALL expenses (not just approved)
4. aggregateProjectCosts() processes data:
   - Groups by subcontractor
   - Calculates totals by status
   - Computes margins
5. UI displays real-time breakdown
```

### Key Functions

#### `fetchLiveTrackingData(companyId, projectId)`
- Fetches all time logs and expenses (no status filter)
- Sorts by date descending
- Builds subcontractor map
- Calls `aggregateProjectCosts()` for aggregation

#### `aggregateProjectCosts(timeLogs, expenses, subcontractorsMap)`
Returns:
```typescript
{
  totals: { hours, cost, billing, margin, marginPct },
  byStatus: {
    draft: { hours, cost, billing, margin, count },
    submitted: { ... },
    approved: { ... }
  },
  subcontractors: [
    {
      id, name,
      totalHours, totalCost, totalBilling, totalMargin, marginPct,
      byStatus: { draft, submitted, approved },
      timeLogs: [...],
      expenses: [...]
    }
  ]
}
```

## Benefits

### For Admin/Main Contractors:
1. **Proactive Cost Management**: See costs accumulating in real-time
2. **Early Warning System**: Identify cost overruns before submission
3. **Complete Transparency**: Full visibility into all logged work
4. **Better Forecasting**: Accurate running totals for financial planning
5. **Margin Tracking**: Always know your profit margin

### For Business Operations:
- No surprises when timesheets are submitted
- Better cash flow management
- Improved client billing accuracy
- Enhanced project profitability tracking

## Usage Workflow

1. **Admin assigns subcontractors** to project (Assignments tab)
2. **Subcontractors log work** (hours/expenses) - status: DRAFT
3. **Admin monitors live** (Live Tracking tab) - sees unsubmitted work
4. **Subcontractors submit** timesheet - status: SUBMITTED
5. **Admin reviews & approves** - status: APPROVED
6. **All stages visible** in real-time on Live Tracking tab

## Data Security

- Only admins/managers can view live tracking
- Firestore rules ensure proper access control
- Subcontractors can only see their own data
- All financial data is properly secured

## Future Enhancements (Potential)

- Export tracking data to CSV/PDF
- Set budget alerts when costs exceed threshold
- Comparison with estimated vs. actual costs
- Historical trend analysis
- Real-time notifications for new entries
- Filtering by date range
- Filtering by individual subcontractor

## Notes

- No workflow changes for subcontractors - they log work as before
- Complements existing reports (reports = historical, this = real-time)
- Read-only view for admins (no editing of subcontractor entries)
- Maintains audit trail integrity
- Works with existing rate card and timeframe system

---

**Implementation Date**: January 27, 2026
**Version**: 1.0
**Status**: ✅ Complete and Ready for Testing
