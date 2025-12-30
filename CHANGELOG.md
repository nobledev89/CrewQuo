# Changelog

All notable changes and implemented features for CrewQuo.

---

## December 2025

### Timesheet & Approval System
**Status:** ✅ Complete

- **Subcontractor Submissions Page** (`/dashboard/my-work/submissions`)
  - View all time logs and expenses with status (DRAFT, SUBMITTED, APPROVED, REJECTED)
  - Filter by status
  - Batch select and submit multiple items
  - Project-based grouping for submissions

- **Admin Timesheets Approval Page** (`/dashboard/timesheets`)
  - View all timesheets from all subcontractors
  - Table-based review with line items (Date, Type, Description, Qty/Hrs, Amount, Notes)
  - Per-line-item notes displayed inline within the table for each entry
  - Inline note editing with add note button in Actions column
  - **CSV Download** (Admin only):
    - Download individual timesheet as CSV with all line items
    - Download all filtered timesheets as CSV in one click
    - Includes all data: dates, types, descriptions, hours, amounts, and notes
  - Approve or reject entire timesheets at once
  - Filter by status (All, Submitted, Approved, Rejected)

### Quantity/Units Feature
**Status:** ✅ Complete

- Time logs support quantity (number of people)
  - Example: 8 men × 8 hours = 64 total hours
  - Auto-calculated costs: `quantity × hours × rate`
- Expenses support quantity (miles, nights, units, etc.)
  - Example: 150 miles @ £0.45/mile = £67.50
- Backward compatible - existing entries default to quantity=1

### Rate Card Margin Enhancement
**Status:** ✅ Complete

- Unified rate card with both subcontractor pay rates and client billing rates
- Auto-calculated margin: `clientRate - subcontractorRate`
- Auto-calculated margin percentage
- Margin summary displayed on rate card listing
- Legacy rate fields maintained for backward compatibility

### Subcontractor Workspace
**Status:** ✅ Complete

- **My Work Page** (`/dashboard/my-work`)
  - Dashboard summary with metrics (Monthly Hours, Pending, Awaiting Approval, Earnings)
  - Project cards with filtering (Active, Completed, On Hold)
  - Search functionality
  - Pagination for large project lists

- **Project Modal**
  - Three tabs: Time Logs, Expenses, Summary
  - Add time logs with role/shift selection
  - Add expenses with category selection
  - Real-time cost calculation preview
  - Status filtering on history lists

- **Subcontractor Detail Page** (`/dashboard/subcontractors/[id]`)
  - View full subcontractor information
  - Assigned projects section
  - Assign/remove project assignments

### Project Assignment System
**Status:** ✅ Complete

- Deterministic assignment IDs (`projectId_subcontractorId`) prevent duplicates
- Database-level duplicate prevention in Firestore rules
- Admins can assign subcontractors to projects
- Subcontractors can see their assigned projects in My Work

### Permission & Security Fixes
**Status:** ✅ Complete

- Fixed Firestore rules for `projectAssignments` using `sameActiveCompany()`
- Fixed rate cards and rate assignments read access for subcontractors
- Subcontractors can create time logs/expenses with DRAFT or SUBMITTED status
- Proper company context using JWT claims (`ownCompanyId`, `activeCompanyId`)

### Cost & Billing Calculations
**Status:** ✅ Complete

- Cost calculation uses `subcontractorRate` from rate cards
- Billing calculation uses `clientRate` from rate cards
- Proper fallback chain for rate field lookups
- Cost preview displays in forms before saving

### Reports Page
**Status:** ✅ Complete

- Removed duplicate breakdown sections
- Modal-based detailed breakdown when clicking project cards
- Subcontractor column in breakdown table
- Margin calculations per line item

---

## Data Models

### TimeLog
```typescript
{
  id, companyId, projectId, clientId, subcontractorId, createdByUserId,
  date, roleName, shiftType, hoursRegular, hoursOT,
  quantity,           // Number of people (default: 1)
  subCost,            // What we pay the subcontractor
  clientBill,         // What we bill the client
  marginValue,        // clientBill - subCost
  payRateCardId, billRateCardId,
  status,             // DRAFT | SUBMITTED | APPROVED | REJECTED
  createdAt, updatedAt
}
```

### Expense
```typescript
{
  id, companyId, projectId, clientId, subcontractorId, createdByUserId,
  date, category, amount,
  quantity,           // Number of units
  unitRate, unitType,
  payRateCardId, billRateCardId,
  createdAt, updatedAt
}
```

### RateEntry (within RateCard)
```typescript
{
  roleName, category, shiftType, description,
  subcontractorRate,  // What you pay the subcontractor (hourly)
  clientRate,         // What you charge the client (hourly)
  marginValue,        // Auto-calculated
  marginPercentage,   // Auto-calculated
  baseRate, hourlyRate, // Legacy fields
  congestionChargeApplicable, vehicleIncluded, driverIncluded,
  // ... additional charges
}
```

### ProjectSubmission
```typescript
{
  id, companyId, projectId, subcontractorId, createdByUserId,
  timeLogIds, expenseIds,
  status,             // DRAFT | SUBMITTED | APPROVED | REJECTED
  submittedAt, approvedAt, approvedBy,
  rejectionReason,
  lineItemRejectionNotes, // Per-line notes for feedback
  totalHours, totalCost, totalExpenses,
  createdAt, updatedAt
}
```

---

## Navigation Structure

### Admin/Manager View
- Dashboard
- Clients
- Projects
- Subcontractors
- Rate Templates
- Rate Cards
- Timesheets (approval)
- Reports

### Subcontractor View
- Summary
- Projects
- Submissions

---

## Firestore Security Rules

### Key Helper Functions
- `sameCompany()` - Checks `companyId` claim (legacy, = ownCompanyId)
- `sameActiveCompany()` - Checks `activeCompanyId` claim
- `hasAccessToCompany()` - Checks if user has subcontractor role for company
- `isOwnCompany()` - Checks if operating on own company

### Collection Rules
- `projectAssignments`: Uses `ownCompanyId` for read/write
- `projects`, `clients`, `timeLogs`, `expenses`: Use `activeCompanyId`
- `rateCards`, `subcontractorRateAssignments`: Allow read for users with company access

---

## Custom Claims Structure

```typescript
{
  companyId: string,         // Legacy field (= ownCompanyId)
  ownCompanyId: string,      // User's primary company
  activeCompanyId: string,   // Currently viewing company
  role: string,              // Role in own company
  subcontractorRoles: {      // Roles in other companies
    [companyId]: {
      subcontractorId: string,
      status: 'active' | 'inactive'
    }
  }
}
```

---

## Known Considerations

### Rate Card Assignment
- Rate cards must have `rates` array populated with entries
- Each rate entry needs `roleName` and `shiftType` for dropdown population
- Pay and bill rate cards can be separate or unified with both rates

### Submission Workflow
- Subcontractors create DRAFT entries
- Submit transitions to SUBMITTED status
- Admins approve (APPROVED) or reject (REJECTED)
- Rejected items can be edited and resubmitted

### Multi-Company Context
- Users can work for multiple companies
- `activeCompanyId` determines current workspace
- Subcontractor roles stored in JWT claims
