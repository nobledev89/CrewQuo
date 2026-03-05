# Expense Client Rate Fix - Single Rate Card Support

## Problem
Expenses were showing **zero margin** because the client billing amount was always equal to the subcontractor cost. The system was only looking for client rates in a separate BILL rate card, but bill cards weren't being used. Labour rates were working fine because they had a fallback to use the `clientRate` field from the same rate card entry.

## Root Cause Analysis

### Why Labour Worked ✅
```typescript
// Labour rate lookup with fallback
const billRate = matchingBillEntry
  ? (matchingBillEntry.clientRate ?? pay)
  : (selectedRateEntry?.clientRate ?? pay); // <- FALLBACK to pay card's clientRate!
```

Labour had a **fallback mechanism**: if no bill card entry was found, it would use the `clientRate` field from the **same pay card entry**.

### Why Expenses Failed ❌
```typescript
// Expense rate lookup WITHOUT fallback
if (billCard?.expenses) {
  const matchingBillExpense = billCard.expenses.find(...)
  if (matchingBillExpense) {
    // use matchingBillExpense rates
  }
}
// No fallback! If billCard is undefined → clientBillAmount = finalAmount (zero margin)
```

Expenses **only looked in the bill card** and had no fallback. If:
- No bill card was assigned
- Bill card had no expenses
- Category names didn't match

Then `clientBillAmount` remained equal to `finalAmount`, resulting in zero margin.

## Solution Implemented

Added the same fallback mechanism that labour uses, allowing expenses to work with a **single rate card** containing both subcontractor and client rates.

### Changes Made

#### File 1: `app/dashboard/my-work/projects/[projectId]/page.tsx`

**Function: `saveExpense`**
- Added lookup of expense entry from pay card: `payCard?.expenses?.find(...)`
- Added fallback logic when bill card is missing or doesn't have matching expense
- For CAPPED expenses: applies `marginPercentage` from pay card expense
- For FIXED expenses: uses `clientRate` from pay card expense

**Function: `recalculateRates`**
- Updated the expense recalculation logic with the same fallback
- Ensures existing expenses can be recalculated even without bill cards

#### File 2: `components/ProjectModal.tsx`

**Function: `saveExpense`**
- Added identical fallback logic to match the main project detail page
- Ensures consistent behavior across both UI components

### How It Works Now

#### For CAPPED Expenses (e.g., Accommodation)
1. Rate card defines: Max cap = £100, Markup = 10% (`marginPercentage: 10`)
2. Subcontractor claims: £60 actual cost
3. System calculates:
   - **Subcontractor Cost**: £60
   - **Client Billing**: £60 × (1 + 10/100) = £66
   - **Margin**: £6 (10% of billing)

#### For FIXED Expenses (e.g., Mileage)
1. Rate card defines: Sub rate = £0.45/mile (`subcontractorRate: 0.45`), Client rate = £0.55/mile (`clientRate: 0.55`)
2. Subcontractor claims: 100 miles
3. System calculates:
   - **Subcontractor Cost**: £45 (0.45 × 100)
   - **Client Billing**: £55 (0.55 × 100)
   - **Margin**: £10 (18.2% of billing)

### Rate Card Structure Required

For expenses to work properly, the **pay rate card** must have expense entries with these fields:

```typescript
{
  id: "unique-id",
  categoryName: "Mileage",
  rateType: "FIXED",  // or "CAPPED"
  subcontractorRate: 0.45,  // What you pay
  clientRate: 0.55,         // What you charge (for FIXED)
  marginPercentage: 10,     // Markup % (for CAPPED)
  rate: 0.45,              // Legacy field (keep for backward compatibility)
  unitType: "per_mile"
}
```

The RateCardForm component already creates these fields when you set up expenses, so no changes are needed to the rate card creation process.

## Backward Compatibility

✅ **Bill cards still work**: If a bill card with expenses is assigned, it takes priority
✅ **Legacy expenses**: Old expenses without `clientBillAmount` will display correctly
✅ **Mixed setups**: Systems can have some subcontractors with bill cards and others without

## Testing Checklist

- [ ] Create a new FIXED expense and verify client rate is used (shows margin)
- [ ] Create a new CAPPED expense and verify markup percentage is applied (shows margin)
- [ ] Check the Live Tracking view shows correct margins for new expenses
- [ ] Verify the "Recompute All Rates" feature updates expenses correctly
- [ ] Confirm existing expenses created before this fix still display correctly
- [ ] Test with a rate card that has both labour and expense entries

## Files Modified

✅ `app/dashboard/my-work/projects/[projectId]/page.tsx` - Main project detail page (saveExpense & recalculateRates)
✅ `components/ProjectModal.tsx` - Project modal component (saveExpense)

## Impact

✅ **Expenses now work without bill cards** - uses clientRate/marginPercentage from pay card
✅ **Matches labour behavior** - consistent pattern across time logs and expenses
✅ **Proper margins calculated** - running bills show accurate profit
✅ **Backward compatible** - existing setups with bill cards continue to work

## Key Insight

The issue was **not a bug in the logic**, but rather a **missing fallback**. Labour had a fallback to use the pay card's clientRate, but expenses didn't. Now both use the same pattern:

1. Try bill card (if exists)
2. Fall back to pay card's client rate fields
3. Default to pass-through (cost = billing) only if neither exists

This makes the system work intuitively with a **single unified rate card** per subcontractor-client relationship.
