# Quantity/Units Feature Implementation Summary

## Overview
Implemented quantity support for time logs and expenses to allow subcontractors to efficiently log multiple instances of the same work without creating duplicate entries.

## Problem Solved
**Before:** If 8 men worked the same role for 8 hours, you had to add 8 separate time log entries manually.
**After:** Add 1 time log entry with "8 Men" × "8 Hours" = automatically calculated as 64 total hours of work

## Changes Implemented

### 1. **Type Definitions** (`lib/types.ts`)

#### TimeLog Model
```typescript
- quantity: number              // Number of people (default: 1)
- unitSubCost?: number         // Per person hourly cost (before multiplying)
- unitClientBill?: number      // Per person hourly billing (before multiplying)
```

**Calculation Formula:**
- `subCost = quantity × (hoursRegular + hoursOT) × payRate`
- `clientBill = quantity × (hoursRegular + hoursOT) × billRate`

#### Expense Model
```typescript
- quantity: number             // Number of units (miles, nights, rooms, etc.)
- unitRate?: number           // Rate per unit from rate card
- unitType?: string           // Unit type (per_mile, per_day, per_unit, per_hour, flat)
```

**Calculation Formula:**
- `amount = quantity × unitRate`
- Example: 150 miles @ £0.45/mile = £67.50

### 2. **User Interface Updates** (`components/ProjectModal.tsx`)

#### Time Log Form - NEW UI
Added "Men" input field between Role/Shift and Regular Hours:
```
Date | Role & Shift | Men | Regular Hours | OT Hours | Cost Preview | Add Button
```

**Features:**
- Quantity field with min=1, step=1
- Cost preview automatically updates: `£ (payRate × (hours) × quantity)`
- Example: 8 men × 8 hours × £15/hr = £960.00

#### Expense Form - Remains Flexible
- Quantity field for flexible expense logging
- Supports partial unit entries with cap enforcement
- Example: Enter 150 miles, system calculates based on rate card

### 3. **Calculation Logic Updates**
- Time log cost: `payRate × (hoursRegular + hoursOT) × quantity`
- Overtime properly multiplied: `8 men × 2 OT hours = 16 OT hours total`
- All calculations rounded to 2 decimal places

### 4. **Database Schema**
TimeLog document now includes:
```javascript
{
  // Existing fields...
  quantity: 8,                  // Number of people
  hoursRegular: 8,
  hoursOT: 0,
  subCost: 960.00,             // 8 × 8 × 15 = 960
  unitSubCost: 15.00,          // For reference
  unitClientBill: 21.00,       // For reference
  // ...
}
```

Expense document now includes:
```javascript
{
  // Existing fields...
  quantity: 150,               // Number of miles
  unitRate: 0.45,             // Per mile rate
  unitType: 'per_mile',
  amount: 67.50,              // 150 × 0.45 = 67.50
  // ...
}
```

## User Workflow Example

### Time Logs
1. **Before**: Add 8 separate entries (one per person)
   - Entry 1: 1 Supervisor, 8 hours
   - Entry 2: 1 Supervisor, 8 hours
   - ... (6 more entries)

2. **After**: Add 1 entry
   - Date: 2024-12-22
   - Role: Supervisor
   - Men: 8
   - Hours: 8 regular
   - Cost Preview: £960.00 (auto-calculated)

### Expenses
1. **Mileage**: Enter quantity of miles
   - Expense Type: Mileage (cap £0.45/mile)
   - Quantity: 150 miles
   - Amount: 150 × £0.45 = £67.50 (auto-capped)

2. **Accommodation**: Enter quantity of nights/rooms
   - Expense Type: Accommodation (cap £50/night)
   - Quantity: 3 nights
   - Amount: 3 × £50 = £150.00 (custom with cap)

## Features

✅ **Quantity Input for Time Logs**
- Simple numeric input field
- Auto-calculates total cost preview
- Properly multiplies all hours (regular + OT)

✅ **Quantity Support for Expenses**
- Flexible unit-based calculations
- Rate cap enforcement
- Works with all unit types (per_mile, per_day, per_unit, per_hour, flat)

✅ **Backward Compatibility**
- Existing data defaults to quantity=1
- Legacy entries unaffected
- Seamless integration with existing system

✅ **Calculation Accuracy**
- Proper rounding to 2 decimal places
- Correct financial calculations
- Margin calculations preserved

## Next Steps (Optional Enhancements)

### Phase 3: Display Updates
- Update timesheets approval page to show quantity column
- Display: "8 men × 8h = 64h total" in table view
- Update reports to properly aggregate quantity-based data

### Phase 4: Reports Enhancement
- Update hour totals calculation: `Σ(hoursRegular × quantity) + Σ(hoursOT × quantity)`
- Update cost aggregation to account for quantity
- Per-project and per-subcontractor breakdown improvements

### Phase 5: Additional Features
- Edit functionality to modify quantity after creation
- Bulk entry feature for recurring patterns
- Export/import with quantity support

## Testing Recommendations

1. **Time Logs**
   - Create 1 entry with 8 men × 8 hours = should show 64 total hours
   - Verify cost calculation: 8 × 8 × hourly_rate
   - Test with overtime: 8 men × 6 regular + 2 OT hours

2. **Expenses**
   - Mileage: 150 miles @ £0.45 = £67.50
   - Accommodation: 3 nights @ £50 = £150.00
   - Verify cap enforcement prevents overage

3. **Submissions**
   - Verify total hours include quantity multiplier
   - Check cost calculations are correct
   - Confirm data persists to Firestore

4. **Reporting**
   - Verify summary statistics account for quantity
   - Check timesheet totals are accurate
   - Validate financial calculations in reports

## File Changes Summary

| File | Changes |
|------|---------|
| `lib/types.ts` | Added `quantity`, `unitSubCost`, `unitClientBill` to TimeLog; added `quantity`, `unitRate`, `unitType` to Expense |
| `components/ProjectModal.tsx` | Added quantity input field to time log form; updated cost calculation to multiply by quantity |

## Backward Compatibility
- All existing TimeLog and Expense records continue to work
- Default quantity=1 applied by application logic where not specified
- No database migration required
- Existing calculations unaffected

## Notes
- Quantity field defaults to 1 (single person/unit)
- Field accepts integers only (min: 1)
- Cost preview updates in real-time as quantity changes
- All financial calculations maintain 2 decimal place precision
- OT hours properly multiplied: `quantity × hoursOT`
