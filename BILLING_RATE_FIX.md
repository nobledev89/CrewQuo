# Billing Rate Calculation Fix

## Issue Summary

The total billing in the Reports page was showing lower than expected, with zero margin. This occurred because the system was not correctly reading the client billing rate from the rate card.

**Example:**
- Subcontractor rate: £23.25/hr
- Client billing rate: £25.00/hr (as configured in rate card)
- Expected margin: £1.75/hr
- **Actual result: £0.00 margin** ❌

## Root Cause

In `components/ProjectModal.tsx`, when calculating billing rates for new time logs, the code had a fallback logic issue:

```javascript
// BUGGY CODE:
const billRate = matchingBillEntry
  ? (matchingBillEntry.clientRate ?? ...)
  : payRate;  // Falls back to subcontractor rate if no matching bill entry!
```

### Why This Happened

The system was designed to support two separate rate cards:
1. **PAY Card** - Contains `subcontractorRate` for what you pay the subcontractor
2. **BILL Card** - Contains `clientRate` for what you charge the client

However, your rate card structure stores **BOTH** rates in a single rate entry:
- `subcontractorRate` - What you pay
- `clientRate` - What you charge

**The bug:** When no separate "BILL card" was found, the code fell back to using the subcontractor rate as the billing rate, resulting in:
- Cost = £23.25/hr ✓ (from `subcontractorRate`)
- Billing = £23.25/hr ✗ (should be £25.00/hr from `clientRate`)
- Margin = £0.00 ✗

## Solution Applied

Updated the fallback logic in `components/ProjectModal.tsx` line ~166:

```javascript
// FIXED CODE:
const billRate = matchingBillEntry
  ? (matchingBillEntry.clientRate ?? matchingBillEntry.hourlyRate ?? matchingBillEntry.baseRate ?? payRate)
  : (selectedRateEntry?.clientRate ?? payRate);  // Now checks clientRate from same card!
```

Now the logic:
1. If a separate bill card exists with matching role/shift, use its `clientRate` ✓
2. **If no separate bill card, use `clientRate` from the same rate card** ✓ (NEW)
3. Final fallback to `payRate` only if neither option has a rate defined

## Impact

### Time Logs Created After Fix
New time logs will now correctly calculate:
- **Cost:** From `subcontractorRate` 
- **Billing:** From `clientRate` 
- **Margin:** Difference between the two

### Existing Time Logs (Before Fix)
The 2 existing time logs have incorrect billing values stored in the database. You have two options:

**Option 1: Delete and Recreate (Recommended)**
1. Go to your project's time logs
2. Delete the existing logs with incorrect billing
3. Create new logs with the same details
4. Verify they now show the correct client billing rate

**Option 2: Batch Update (Advanced)**
If you have many incorrect logs, contact support to run a script that recalculates `clientBill` values for all time logs using the current rate cards.

## Files Modified

- `components/ProjectModal.tsx` - Line ~166: Updated `billRate` fallback logic

## Testing

To verify the fix works:

1. Create a new time log with your configured rates
2. Confirm the preview shows correct values:
   - Cost = subcontractor rate × hours
   - Billing = client rate × hours
3. Check the Reports page shows positive margin after approval

## Future Considerations

For cleaner architecture, consider:
- Always require `clientRate` in rate entries (not optional)
- Add validation to ensure `clientRate >= subcontractorRate`
- Document the rate card structure clearly for admins
