# Timesheet Rejection & Rate Recalculation Features

## ✅ COMPLETED FEATURES

### 1. Timesheet Rejection Reason Feature

This feature allows admins to provide detailed feedback when rejecting timesheets, and subcontractors can view this feedback to make corrections.

#### Admin Side (`/dashboard/timesheets`)

**Changes Made:**
- ✅ Added rejection reason modal dialog
- ✅ Rejection reason is **required** (minimum 10 characters)
- ✅ Saves rejection reason to `ProjectSubmission.rejectionReason` field in Firestore
- ✅ Updates all time logs and expenses to REJECTED status
- ✅ Line-item notes feature (already existed) works alongside overall rejection reason

**How It Works:**
1. Admin clicks "Reject Timesheet" button
2. Modal appears requesting rejection reason
3. Admin enters detailed explanation (e.g., "Hours on March 1st don't match site records")
4. System validates (min 10 chars)
5. On submit: Updates submission status + saves reason

#### Subcontractor Side (`/dashboard/my-work/submissions`)

**Changes Made:**
- ✅ Added "rejected" filter tab
- ✅ Rejected timesheets shown with red border and background
- ✅ Rejection reason displayed in card view (truncated)
- ✅ Full rejection reason shown in detail modal with prominent banner
- ✅ Line-item admin notes displayed in detail modal table
- ✅ Visual indicators (red colors, warning icons)
- ✅ Instructional text explaining next steps

**How It Works:**
1. Subcontractor can filter to view rejected timesheets
2. Rejected cards have red border/background for visibility
3. Clicking a rejected card shows:
   - Full rejection reason in a banner at top
   - Line-item notes for specific entries (if any)
   - Instructions to cancel submission, fix items, and resubmit
4. Subcontractor clicks "Cancel Submission" to revert to DRAFT
5. Edits time logs/expenses
6. Resubmits for approval

---

### 2. Rate Update Detection (Partial Implementation)

**What Was Started:**
- ✅ Added state variables for rate update detection
- ✅ Logic to detect when DRAFT items use outdated rate cards
- ✅ Counts number of items that need recalculation

**Still Needed:**
- ⏳ Display banner above tabs when rate updates detected
- ⏳ Implement recalculate function
- ⏳ Show confirmation dialog with old vs new totals
- ⏳ Batch update all DRAFT items with new rates

---

## 📋 DATA MODEL

### ProjectSubmission Document
```typescript
{
  id: string,
  companyId: string,
  projectId: string,
  subcontractorId: string,
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
  
  // NEW: Overall rejection reason
  rejectionReason?: string,
  
  // EXISTING: Line-item feedback
  lineItemRejectionNotes?: Array<{
    itemId: string,
    itemType: 'timeLog' | 'expense',
    note: string,
    addedAt: Timestamp
  }>,
  
  // ... other fields
}
```

---

## 🎯 USER WORKFLOWS

### Workflow 1: Admin Rejects Timesheet

1. Admin navigates to `/dashboard/timesheets`
2. Reviews submitted timesheet
3. Can add line-item notes to specific entries (optional)
4. Clicks "Reject Timesheet"
5. Modal appears
6. Enters rejection reason (min 10 chars): "Please correct hours for March 15th - should be 8h not 12h"
7. Clicks "Reject Timesheet" in modal
8. System updates submission + all items to REJECTED status
9. Reason is saved to database

### Workflow 2: Subcontractor Views & Fixes Rejection

1. Subcontractor navigates to `/dashboard/my-work/submissions`
2. Sees rejected timesheet with red border
3. Card shows truncated rejection reason
4. Clicks to view details
5. Modal shows:
   - Full rejection reason in banner at top
   - Table with all entries
   - Admin notes for specific items (if any)
6. Clicks "Cancel Submission" button
7. Items revert to DRAFT status
8. Navigates to `/dashboard/my-work/projects/[projectId]`
9. Edits time logs/expenses
10. Resubmits corrected timesheet

---

## 🧪 TESTING CHECKLIST

### Test 1: Rejection Reason Required
- [ ] Try rejecting without entering reason → Should show error
- [ ] Try rejecting with < 10 characters → Should show error
- [ ] Reject with valid reason → Should succeed

### Test 2: Subcontractor Can View Rejection
- [ ] Navigate to submissions page as subcontractor
- [ ] Click "rejected" filter → Should show rejected timesheets
- [ ] Rejected cards have red border → Visual indicator works
- [ ] Card shows truncated reason → Preview visible
- [ ] Click card → Modal opens
- [ ] Modal shows full reason in banner → Complete feedback visible

### Test 3: Line-Item Notes Display
- [ ] Admin adds note to specific time log
- [ ] Subcontractor views rejected timesheet
- [ ] Opens detail modal
- [ ] Note appears in "Admin Notes" column → Correct

### Test 4: Fix & Resubmit Workflow
- [ ] Subcontractor cancels rejected submission
- [ ] Items change to DRAFT status → Correct
- [ ] Edit time logs/expenses
- [ ] Resubmit timesheet → Should create new submission
- [ ] Admin can approve new submission → Workflow complete

---

## 🔧 REMAINING WORK FOR RATE RECALCULATION

### To Complete Rate Recalculation Feature:

**File:** `app/dashboard/my-work/projects/[projectId]/page.tsx`

**Add Banner Component** (above tab navigation):
```tsx
{/* Rate Update Banner */}
{showRateUpdateBanner && summaryStats.draftCount > 0 && (
  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-bold text-orange-900 mb-1">⚠️ Rate Update Available</h4>
        <p className="text-sm text-orange-800 mb-3">
          The rate cards for this project have been updated. {outdatedItemsCount} draft {outdatedItemsCount === 1 ? 'item is' : 'items are'} using outdated rates.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRecalculateRates}
            disabled={recalculating}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {recalculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Recalculating...
              </>
            ) : (
              'Recalculate All Draft Items'
            )}
          </button>
          <button
            onClick={() => setShowRateUpdateBanner(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Add Recalculation Function:**
```typescript
const handleRecalculateRates = async () => {
  if (!rateAssignment || !payCard) {
    setError('Rate card configuration not found');
    return;
  }

  // Calculate old and new totals for confirmation
  const draftLogs = timeLogs.filter(log => log.status === 'DRAFT');
  const draftExps = expenses.filter(exp => exp.status === 'DRAFT');
  
  const oldTotal = draftLogs.reduce((sum, log) => sum + log.subCost, 0) +
                   draftExps.reduce((sum, exp) => sum + exp.amount, 0);
  
  // Show confirmation
  const confirmed = window.confirm(
    `Recalculate ${outdatedItemsCount} draft items with current rates?\n\n` +
    `This will update costs based on the latest rate cards.\n\n` +
    `Current Total: £${oldTotal.toFixed(2)}\n\n` +
    `Continue?`
  );
  
  if (!confirmed) return;
  
  setRecalculating(true);
  setError('');
  
  try {
    const batch = writeBatch(db);
    let updatedCount = 0;
    let newTotal = 0;
    
    // Recalculate time logs
    for (const log of draftLogs) {
      // Find matching rate entry
      const rateEntry = payCard.rates?.find((r: any) => 
        r.roleName === log.roleName &&
        (r.timeframeId === log.timeframeId || r.shiftType === log.shiftType)
      );
      
      if (rateEntry) {
        const newSubCost = (rateEntry.subcontractorRate || 0) * (log.hoursRegular || 0) * (log.quantity || 1);
        const newClientBill = (rateEntry.clientRate || 0) * (log.hoursRegular || 0) * (log.quantity || 1);
        
        batch.update(doc(db, 'timeLogs', log.id), {
          subCost: newSubCost,
          clientBill: newClientBill,
          unitSubCost: rateEntry.subcontractorRate || 0,
          unitClientBill: rateEntry.clientRate || 0,
          payRateCardId: rateAssignment.payRateCardId,
          billRateCardId: rateAssignment.billRateCardId,
          updatedAt: Timestamp.now(),
        });
        
        updatedCount++;
        newTotal += newSubCost;
      }
    }
    
    // Recalculate expenses
    for (const exp of draftExps) {
      const expenseEntry = payCard.expenses?.find((e: any) => e.categoryName === exp.category);
      
      if (expenseEntry) {
        const newAmount = (expenseEntry.rate || 0) * (exp.quantity || 1);
        
        batch.update(doc(db, 'expenses', exp.id), {
          amount: newAmount,
          unitRate: expenseEntry.rate || 0,
          payRateCardId: rateAssignment.payRateCardId,
          billRateCardId: rateAssignment.billRateCardId,
          updatedAt: Timestamp.now(),
        });
        
        updatedCount++;
        newTotal += newAmount;
      }
    }
    
    await batch.commit();
    
    const difference = newTotal - oldTotal;
    const sign = difference >= 0 ? '+' : '';
    
    setSuccess(
      `Successfully recalculated ${updatedCount} items! ` +
      `Old total: £${oldTotal.toFixed(2)} → New total: £${newTotal.toFixed(2)} ` +
      `(${sign}£${difference.toFixed(2)})`
    );
    
    // Refresh data
    if (auth.currentUser) {
      await fetchProjectData(auth.currentUser);
    }
    
    setTimeout(() => setSuccess(''), 5000);
  } catch (error) {
    console.error('Error recalculating rates:', error);
    setError('Failed to recalculate rates. Please try again.');
  } finally {
    setRecalculating(false);
  }
};
```

---

## 📝 NOTES

### Communication Flow
- **One-way communication:** Admin → Subcontractor
- Subcontractors cannot reply to rejection reasons
- Subcontractors must fix and resubmit

### Email Notifications
- Not implemented in this version
- Can be added later using Firebase Cloud Functions
- Would trigger on status change to REJECTED

### Security
- Rejection reason stored in Firestore
- Protected by security rules (only company members can read)
- Subcontractors can only see their own submissions

---

## 🚀 DEPLOYMENT NOTES

### Firestore Security Rules
Ensure rules allow reading rejection data:
```
match /projectSubmissions/{submissionId} {
  allow read: if request.auth != null && 
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.activeCompanyId == resource.data.companyId ||
     resource.data.createdByUserId == request.auth.uid);
}
```

### Testing Database
- Admin user required for testing rejection flow
- Subcontractor user required for testing viewing/fixing
- At least one project with time logs

---

## 💡 FUTURE ENHANCEMENTS

1. **Email Notifications**
   - Send email when timesheet rejected
   - Include rejection reason in email
   - Link to view details

2. **Rejection History**
   - Track multiple rejection cycles
   - Show revision history
   - Audit trail

3. **Templates for Common Rejections**
   - Pre-defined rejection reasons
   - Quick select common issues
   - Consistency in feedback

4. **Dashboard Analytics**
   - Track rejection rates
   - Common rejection reasons
   - Time to resolution

---

## 📧 SUPPORT

If you encounter issues:
1. Check browser console for errors
2. Verify Firestore security rules
3. Ensure user has proper permissions
4. Test with fresh data

Last Updated: March 3, 2026
