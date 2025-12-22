# Rate Card Margin Enhancement - Implementation Summary

## Overview
The rate card system has been enhanced to handle **both subcontractor pay rates and client billing rates in a single unified interface** with automatic margin calculation. This allows you to see profitability at a glance when setting rates.

## Key Changes

### 1. **Updated Type Definitions** (`lib/types.ts`)
Added new fields to the `RateEntry` interface:
- `subcontractorRate: number` - What you pay the subcontractor (hourly rate)
- `clientRate: number` - What you charge the client (hourly rate)
- `marginValue?: number` - Auto-calculated: `clientRate - subcontractorRate`
- `marginPercentage?: number` - Auto-calculated: `(marginValue / clientRate) * 100`

**Backward Compatibility**: Legacy fields (`baseRate`, `hourlyRate`, etc.) are retained for existing data.

### 2. **Enhanced Rate Card Form** (`components/RateCardForm.tsx`)

#### New Pricing Section (Section 4)
The form now displays two main areas:

**Primary Rates (Required) - Blue highlighted box:**
```
┌─────────────────────────────────────────────────┐
│ 💷 Primary Rates (Required)                     │
├─────────────────────────────────────────────────┤
│ Subcontractor Rate (£/hr):  [15.00]             │
│ What you pay the subcontractor                   │
│                                                   │
│ Client Rate (£/hr):         [21.00]             │
│ What you charge the client                       │
│                                                   │
│ Margin (Read-Only):    £6.00 (28.6%)            │
│ Profit per hour       [Green background]        │
└─────────────────────────────────────────────────┘
```

**Legacy Rates (Optional):**
- Keep existing rate fields for backward compatibility
- Base Rate, Hourly Rate, 4-8-9-10-12 Hour Rates, Flat Shift Rate

#### Real-Time Margin Calculation
When either rate is changed:
1. Margin value is calculated: `clientRate - subcontractorRate`
2. Margin percentage is calculated: `(margin / clientRate) * 100`
3. Displays update in real-time
4. Color-coded (Green for positive margins)

### 3. **Rate Card Listing Enhancement** (`app/dashboard/ratecards/page.tsx`)

Each rate card now displays:
- **Entry Count**: Number of rate entries
- **Margin Summary**: Shows each role with its profit per hour

Example:
```
💰 Margin Summary:
┌────────────┬────────────┬────────────┐
│   Fitter   │ Supervisor │   Driver   │
│ £6.00 (28%) │ £8.50 (30%) │ £5.00 (20%) │
└────────────┴────────────┴────────────┘
```

## Usage Example

When creating a rate card for "Fitter":

1. **Enter Subcontractor Rate**: £15.00 (what you pay)
2. **Enter Client Rate**: £21.00 (what you charge)
3. **See Margin Automatically**: £6.00 (28.6%)
4. **Save**: Margin data is persisted in Firestore

The margin is now available for:
- **Reporting**: Easy to see profit margins across all roles
- **Billing**: Match subcontractor invoices with client billing at a glance
- **Analysis**: Track profitability by role/shift type

## Benefits

✅ **Single unified rate card** - No more managing separate PAY and BILL cards
✅ **Immediate visibility** - See profit margins when creating rates
✅ **Automatic calculation** - No manual math needed
✅ **Easy matching** - Simple to match subcontractor invoices with client charges
✅ **Better decision-making** - See profitability before committing to rates
✅ **Clearer reporting** - Margin data embedded for billing/reporting

## Backward Compatibility

- Existing PAY and BILL rate cards remain in the database unchanged
- Legacy rate fields are still available and functional
- The new subcontractor/client rate fields are optional
- Old data will continue to work as before

## Data Validation

- **Both rates required**: Cannot save without filling subcontractor and client rates
- **Automatic calculation**: Margins update in real-time as rates change
- **Firestore storage**: Margins are stored with the rate entry for easy retrieval

## Future Enhancements

Potential additions:
- Bulk margin updates for multiple entries
- Margin trend analysis over time
- Alerts for low-margin rates
- Integration with expense tracking for total profitability

## Files Modified

1. `lib/types.ts` - Added new rate fields
2. `components/RateCardForm.tsx` - Dual rate input UI and margin calculation
3. `app/dashboard/ratecards/page.tsx` - Margin summary display

---

**Implementation Date**: December 22, 2025
**Status**: Complete and Ready for Testing
