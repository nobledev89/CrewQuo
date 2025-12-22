# Billing Rate Fix - Debug Guide

## Issue Summary
The business overview was showing:
1. ✅ **FIXED** - Total cost not including expenses
2. ⏳ **IN PROGRESS** - Total billing lower than cost (should be higher with assigned billing rate cards)

## Root Cause Identified
The rate extraction logic in `createTimeLog` was not respecting the `rateMode` field of rate cards. Rate cards can have different field names for rates based on their mode:

- **HOURLY mode**: Uses `hourlyRate` and `otHourlyRate`
- **SHIFT mode**: Uses `shiftRate`
- **DAILY mode**: Uses `dailyRate`

The old code was always trying `hourlyRate` first, which could return 0 or undefined for SHIFT/DAILY cards, causing wrong rate calculations.

## Changes Made

### 1. Fixed Rate Extraction Logic (functions/src/index.ts)
Enhanced the `extractBaseRate` and `extractOTRate` functions to:
- Check the card's `rateMode` field
- Extract the appropriate rate based on the mode
- Only apply OT rates for HOURLY mode (SHIFT/DAILY have no OT)
- Add comprehensive logging to show what values are being extracted

**Code Changes:**
```typescript
const extractBaseRate = (card: any): number => {
  const rateMode = card.rateMode || 'HOURLY';
  console.log(`[extractBaseRate] Card rateMode: ${rateMode}, Card data:`, {
    hourlyRate: card.hourlyRate,
    shiftRate: card.shiftRate,
    dailyRate: card.dailyRate,
    baseRate: card.baseRate,
    rate: card.rate,
  });
  
  // Extract based on rateMode
  switch (rateMode) {
    case 'SHIFT':
      return card.shiftRate || card.baseRate || card.rate || 0;
    case 'DAILY':
      return card.dailyRate || card.baseRate || card.rate || 0;
    case 'HOURLY':
    default:
      return card.hourlyRate || card.baseRate || card.rate || 0;
  }
};
```

### 2. Added Detailed Logging
New console.log statements show:
- Pay Card ID and RateMode with extracted rates
- Bill Card ID and RateMode with extracted rates
- Full card data as JSON for inspection

## Next Steps: Testing

### 1. Create a New Time Log Entry
1. Log into your CrewQuo dashboard
2. Go to a project where you have rate cards assigned
3. Create a **NEW** time log entry (existing ones won't have the debugging logs)
4. Submit the form

### 2. Check Firebase Cloud Functions Logs
After creating the time log:

**Option A: Using Firebase Console**
1. Go to: https://console.firebase.google.com/project/projects-corporatespec/functions
2. Click on `createTimeLog` function
3. Go to "Logs" tab
4. Look for logs from the past few minutes
5. Search for `[extractBaseRate]` or `[createTimeLog]`

**Option B: Using CLI**
```bash
firebase functions:log --limit 50
```

### 3. What to Look For in the Logs
You should see output like:
```
[extractBaseRate] Card rateMode: HOURLY, Card data: { hourlyRate: 45, ... }
[createTimeLog] Pay Card ID: <id>, RateMode: HOURLY, Base: 45, OT: 67.5
[createTimeLog] Bill Card ID: <id>, RateMode: HOURLY, Base: 55, OT: 82.5
[createTimeLog] Full pay card: { rateMode: "HOURLY", hourlyRate: 45, ... }
[createTimeLog] Full bill card: { rateMode: "HOURLY", hourlyRate: 55, ... }
```

### 4. Interpret the Results

**Expected Behavior:**
- Bill base rate should be HIGHER than pay base rate
- Example: Pay £45/hr → Bill £55/hr = Positive margin
- If hours = 8 regular: Cost = £360, Billing = £440, Margin = £80

**If Billing is Still Lower:**
1. Check that both `Pay Rate Card ID` and `Bill Rate Card ID` are different
2. Verify the Bill Rate Card actually has a higher rate in the logs
3. Check the actual rate card documents in Firebase to see if rates are stored correctly
4. May need to check if rate card field names differ from what we're checking

## Deployment Status
✅ Functions deployed successfully at: 2025-12-22 01:14:32 UTC

All 11 functions updated:
- ✅ onUserCreated
- ✅ completeSignup
- ✅ createTimeLog (with enhanced logging)
- ✅ getProjectSummary
- ✅ switchCompanyContext
- ✅ refreshClaims
- ✅ gumroadWebhook
- ✅ validateInviteToken
- ✅ sendSubcontractorInvite
- ✅ onSubcontractorInviteCreated
- ✅ onSubcontractorInviteAccepted

## Important Notes
- **Only NEW time logs** will show the debugging output
- Existing time logs were created with the old (incorrect) logic
- If needed, you can delete old test time logs and create new ones to verify the fix
- The logging will remain in production - we can remove it after validation

## Troubleshooting
If the logs show unexpected values:

1. **Bill rate is same as pay rate?**
   - Check that rate card assignment has a DIFFERENT `billRateCardId`
   - Verify the billing rate card exists in Firestore

2. **Rate is 0 or undefined?**
   - The rateMode might not be set on the rate card
   - Check if the field name is different (could be `baseRate` or `rate`)
   - Log shows what fields actually exist in the card

3. **Wrong rateMode shown?**
   - Rate card document may not have the `rateMode` field
   - Check rate card creation code

## Key Files Modified
- `functions/src/index.ts` - Enhanced rate extraction in createTimeLog
- `functions/src/rates.ts` - No changes (reference for understanding structure)

## Previous Fixes Applied
- ✅ Expenses now included in total cost
- ✅ Rate card lookup now uses subcontractorRateAssignments correctly
- ✅ Store payRateCardId and billRateCardId in time logs
