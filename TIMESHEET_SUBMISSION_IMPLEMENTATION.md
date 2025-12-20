# Timesheet Submission & Approval System Implementation

## Overview
A complete timesheet submission and approval system has been implemented for CrewQuo, allowing subcontractors to submit their timesheets and expenses for admin approval.

## Features Implemented

### 1. Subcontractor Submissions Page
**Location:** `/dashboard/my-work/submissions`
**File:** `app/dashboard/my-work/submissions/page.tsx`

#### Features:
- View all time logs and expenses with their current status (DRAFT, SUBMITTED, APPROVED, REJECTED)
- Filter by status: All, Draft, Submitted, Approved
- Batch select multiple items and submit together
- Select all / deselect all functionality
- Real-time status updates
- Project and date information for each entry
- Hours and cost details for time logs
- Expense categories for expense entries
- Success/error notifications
- Responsive design with mobile support

#### Workflow:
1. Subcontractor logs hours or expenses (creates DRAFT status)
2. Navigates to Submissions page
3. Reviews all draft items
4. Selects items to submit
5. Clicks "Submit Selected"
6. Items change to SUBMITTED status
7. Awaits admin approval

### 2. Admin Timesheets Approval Page
**Location:** `/dashboard/timesheets`
**File:** `app/dashboard/timesheets/page.tsx`

#### Features:
- View all time logs and expenses across all subcontractors
- Filter by status: All, Submitted, Approved, Rejected
- Group items by subcontractor for organized review
- Expandable subcontractor cards showing:
  - Subcontractor name and email
  - Number of pending submissions
- Individual item cards with:
  - Project name
  - Work details (date, hours, role)
  - Cost/amount
  - Status badge
- Approve button: Changes status to APPROVED
- Reject button with reason: Allows recording rejection reason
- Rejection reason input field with confirmation
- Real-time data refresh after actions
- Success/error notifications
- Role-based access (ADMIN/MANAGER only)

#### Workflow:
1. Admin navigates to Timesheets page
2. Filters to view SUBMITTED items
3. Expands subcontractor group
4. Reviews individual submissions
5. Either:
   - Clicks Approve (SUBMITTED → APPROVED)
   - Clicks Reject and enters reason (SUBMITTED → REJECTED)
6. System updates status immediately
7. Page refreshes to show updated data

### 3. Navigation Updates
**File:** `components/DashboardLayout.tsx`

#### Changes:
- Added Clock icon import from lucide-react
- Added "Submissions" link to subcontractor navigation menu
- Added "Timesheets" link to admin/manager navigation menu (only visible when viewing own company)
- Conditional display based on user role:
  - Subcontractors see: Summary, Projects, **Submissions**
  - Admins/Managers see: Dashboard, Clients, Projects, Subcontractors, Rate Templates, Rate Cards, **Timesheets**, Reports

## Data Model

The implementation uses the existing `ProjectSubmission` type from `lib/types.ts`:

```typescript
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ProjectSubmission {
  id: string;
  companyId: string;
  projectId: string;
  subcontractorId: string;
  createdByUserId: string;
  timeLogIds: string[];
  expenseIds: string[];
  status: SubmissionStatus;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectionReason?: string;
  totalHours: number;
  totalCost: number;
  totalExpenses: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Individual time logs and expenses also have status fields that track: DRAFT → SUBMITTED → APPROVED/REJECTED

## Security & Firestore Rules

The implementation leverages existing Firestore rules for:

### Time Logs Security:
- Subcontractors can create DRAFT logs in their own context
- Subcontractors can only edit their own DRAFT logs (cannot edit once submitted)
- Admins/Managers can update status (approve/reject)
- All writes validated by `status` field and company context

### Expenses Security:
- Same rules as time logs
- Subcontractors can create DRAFT expenses
- Cannot edit after submission
- Admins/Managers control approval/rejection

### Project Submissions Security:
- Subcontractors can create DRAFT submissions
- Subcontractors can transition DRAFT → SUBMITTED
- Admins/Managers can update to APPROVED or REJECTED
- Company-based access control

## Database Operations

### Status Updates:
```typescript
// Subcontractor submitting items:
batch.update(doc(db, 'timeLogs', id), {
  status: 'SUBMITTED',
  updatedAt: Timestamp.now(),
});

// Admin approving:
batch.update(doc(db, 'timeLogs', id), {
  status: 'APPROVED',
  updatedAt: Timestamp.now(),
});

// Admin rejecting:
batch.update(doc(db, 'timeLogs', id), {
  status: 'REJECTED',
  rejectionReason: reason,
  updatedAt: Timestamp.now(),
});
```

## User Experience

### For Subcontractors:
1. Clear view of all their submissions in one place
2. Easy batch submission workflow
3. Status indicators showing approval progress
4. Can see rejection reasons if items are rejected
5. Filters to organize submissions by status

### For Admins/Managers:
1. Centralized approval center
2. Organized by subcontractor for easy review
3. Quick approve/reject actions
4. Ability to record rejection reasons
5. Filter to focus on pending submissions
6. Historical view of approved and rejected items

## File Structure

```
app/dashboard/
├── my-work/
│   └── submissions/
│       └── page.tsx          (New - Subcontractor submission page)
├── timesheets/
│   └── page.tsx              (New - Admin approval page)
└── ...existing files

components/
└── DashboardLayout.tsx       (Updated - Added navigation items)

lib/
└── types.ts                  (Already contains ProjectSubmission type)
```

## Testing Checklist

- [ ] Subcontractor can view draft items on Submissions page
- [ ] Subcontractor can select and submit multiple items
- [ ] Status changes from DRAFT to SUBMITTED after submission
- [ ] Admin can view Timesheets page with SUBMITTED filter
- [ ] Admin can approve submitted items
- [ ] Status changes from SUBMITTED to APPROVED after approval
- [ ] Admin can reject items with reason
- [ ] Status changes from SUBMITTED to REJECTED
- [ ] Rejection reason is displayed on rejected items
- [ ] Data refreshes after approval/rejection
- [ ] Success/error notifications display correctly
- [ ] Navigation items appear for correct roles
- [ ] "Timesheets" only shows for ADMIN/MANAGER roles
- [ ] "Submissions" shows for subcontractors
- [ ] Filtering works on both pages
- [ ] Mobile responsiveness works

## Future Enhancements

1. **Email Notifications**: Notify subcontractors when submissions are approved/rejected
2. **Bulk Actions**: Admin ability to approve/reject multiple items at once
3. **Comments/Notes**: Allow back-and-forth communication about rejected items
4. **Export Reports**: Generate reports of approved timesheets
5. **Scheduling**: Auto-submission on specific dates
6. **Attachments**: Support for uploading supporting documentation
7. **Audit Trail**: Track all status changes and who made them
8. **Analytics**: Dashboard showing approval rates and trends

## Technical Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth with custom claims
- **Date Handling**: Firestore Timestamps

## Notes

- All security rules were already in place in `firestore.rules`
- Uses existing type definitions and patterns from the codebase
- Follows the same UI/UX patterns as other admin pages
- Responsive design works on mobile and desktop
- Batch operations minimize database calls
- Real-time data refresh ensures consistency
