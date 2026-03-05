# Expense Markup & Margin Fix

## Problem
Expenses were showing **zero income** because billing amounts always equaled expense costs, resulting in no margins. The system was treating all expenses as "pass-through" costs with no markup, even though the rate card system supported expense markups.

## Root Cause
1. **Missing Data Fields**: The `Expense` model in `lib/types.ts` didn't store client billing amounts
2. **Incorrect Calculation Logic**: The `aggregateProjectCosts` function in `lib/projectTrackingUtils.ts` hardcoded expenses as pass-through: `billing = cost` and `margin = 0`
3. **Missing Creation Logic**: When creating expenses, the client billing amount wasn't calculated or stored

## Solution Implemented

### 1. Updated Data Models
**File**: `lib/types.ts`
- Added `clientBillAmount` field to `Expense` interface
- Added `marginValue` and `marginPercentage` fields to `Expense` interface
- Added `status` field for consistency

**File**: `lib/projectTrackingUtils.ts`
- Updated `ExpenseData` interface with billing and margin fields

### 2. Fixed Calculation Logic
**File**: `lib/projectTrackingUtils.ts`
```typescript
// OLD (incorrect):
const billing = cost; // Expenses are pass-through (no markup)
const margin = 0;     // No margin on expenses

// NEW (correct):
const billing = exp.clientBillAmount ?? cost; // Use stored billing or fall back to cost
const margin = billing - cost;
```

### 3. Updated Expense Creation
**File**: `app/dashboard/my-work/projects/[projectId]/page.tsx`

When saving expenses, the system now:
1. Looks up the matching expense entry in the bill rate card
2. For **CAPPED expenses**: Applies markup percentage to actual amount
   - `clientBillAmount = actualAmount × (1 + markupPercentage / 100)`
3. For **FIXED expenses**: Uses client rate from rate card
   - `clientBillAmount = clientRate × quantity`
4. Calculates and stores margin values

### 4. Updated Display Components
**Files**: 
- `components/SubcontractorCostBreakdown.tsx`
- `app/dashboard/projects/[projectId]/page.tsx`
- `app/dashboard/client-portal/projects/[projectId]/page.tsx`

All expense display components now:
- Show proper billing amounts (`clientBillAmount` instead of just `amount`)
- Calculate and display margins correctly
- Support backward compatibility (fall back to cost if billing not set)

## How It Works Now

### For CAPPED Expenses (e.g., Accommodation)
1. Rate card defines: Max cap = £100, Markup = 10%
2. Subcontractor claims: £60 actual cost
3. System calculates:
   - Cost (what you pay): £60
   - Billing (what you charge): £60 × 1.10 = £66
   - Margin: £6 (10% of billing)

### For FIXED Expenses (e.g., Mileage)
1. Rate card defines: Sub rate = £0.45/mile, Client rate = £0.55/mile
2. Subcontractor claims: 100 miles
3. System calculates:
   - Cost (what you pay): £45
   - Billing (what you charge): £55
   - Margin: £10 (18.2% of billing)

## Backward Compatibility
- Existing expenses without `clientBillAmount` will fall back to showing cost as billing
- This maintains the previous "pass-through" behavior for old data
- New expenses will always have proper billing and margins

## Testing Recommendations
1. Create a new expense with a CAPPED type and verify markup is applied
2. Create a new expense with a FIXED type and verify client rate is used
3. Check the Live Tracking view shows correct margins for new expenses
4. Verify existing expenses still display correctly (pass-through)
5. Confirm recalculate functionality updates expense billing amounts

## Files Modified
- ✅ `lib/types.ts` - Updated Expense interface
- ✅ `lib/projectTrackingUtils.ts` - Fixed calculation logic and ExpenseData interface
- ✅ `app/dashboard/my-work/projects/[projectId]/page.tsx` - Added billing calculation on expense creation
- ✅ `components/SubcontractorCostBreakdown.tsx` - Display proper billing and margins
- ✅ `app/dashboard/projects/[projectId]/page.tsx` - Updated expense data fetching
- ✅ `app/dashboard/client-portal/projects/[projectId]/page.tsx` - Updated expense data fetching and display

## Impact
✅ Expenses now properly show income/margins based on rate card markups
✅ Project tracking and running bills display accurate profit calculations
✅ Client billing reflects proper markup on expenses
✅ Backward compatible with existing data
