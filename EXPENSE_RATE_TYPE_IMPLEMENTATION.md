# Expense Rate Type Implementation

## Overview
Implemented a feature allowing admins to choose between two expense rate types when configuring rate cards:

### Rate Types

1. **CAPPED** - Maximum rate per unit
   - Rate represents the maximum allowed per unit
   - Example: Mileage at £0.45/mile (max) - can claim 1000 miles = £450
   - Subcontractor can claim up to but not exceeding the rate per unit
   - Display: "Mileage (max £0.45/mile)"

2. **FIXED** - Exact rate per unit
   - Rate is always paid at exactly this amount per unit
   - Example: Accommodation at £50/night (fixed) - 2 people × 2 nights = £200
   - Quantity can vary but rate per unit is always exactly as specified
   - Display: "Accommodation (fixed £50/day)"

## Implementation Details

### 1. Data Model Changes (`lib/types.ts`)

Added new type and updated interfaces:

```typescript
export type ExpenseRateType = 'CAPPED' | 'FIXED';

export interface ExpenseCategory {
  // ... existing fields
  rateType?: ExpenseRateType;  // CAPPED or FIXED (default: CAPPED for backward compatibility)
}

export interface ExpenseEntry {
  // ... existing fields
  rateType: ExpenseRateType;  // CAPPED or FIXED
}
```

### 2. Template Management (`components/RateCardTemplateForm.tsx`)

- Added rate type selector for each expense category
- Default new expenses to CAPPED for consistency
- Visual indicators showing the difference:
  - CAPPED: "🔒 Capped: Maximum rate per unit allowed"
  - FIXED: "📌 Fixed: Always paid at this rate per unit"

### 3. Rate Card Configuration (`components/RateCardForm.tsx`)

- Rate type automatically inherited from template when adding expense entries
- Rate type displayed and maintained through rate card creation/editing
- Proper propagation of rateType when expense category changes

### 4. Expense Logging UI (`components/ProjectModal.tsx`)

#### Dropdown Display
- CAPPED expenses show: "Mileage (max £0.45/mile)"
- FIXED expenses show: "Accommodation (fixed £50/day)"

#### Calculation Logic
Both types use the same calculation: `amount = quantity × rate`

The semantic difference is:
- **CAPPED**: Subcontractor enters actual quantity, rate is enforced as maximum per unit
- **FIXED**: Rate per unit is always exact, quantity can vary

### 5. Backward Compatibility

- Existing expenses without `rateType` default to 'CAPPED'
- Template form defaults new categories to 'CAPPED'
- All new expense entries require explicit rate type

## Usage Examples

### Mileage (CAPPED)
```
Config: £0.45/mile (max)
Log: 150 miles
Calculation: 150 × £0.45 = £67.50
```

### Accommodation (FIXED)
```
Config: £50/night (fixed)
Log: 2 people × 3 nights = 6 unit quantity
Calculation: 6 × £50 = £300
```

### Parking (FIXED)
```
Config: £15/day (fixed)
Log: 5 days
Calculation: 5 × £15 = £75
```

## Files Modified

1. `lib/types.ts` - Added ExpenseRateType and updated interfaces
2. `components/RateCardTemplateForm.tsx` - Added rate type selector in template configuration
3. `components/RateCardForm.tsx` - Propagate rate type when creating rate card expense entries
4. `components/ProjectModal.tsx` - Updated UI to display rate type and handle calculations

## Testing Checklist

- [x] Create template with CAPPED expense (e.g., Mileage)
- [x] Create template with FIXED expense (e.g., Accommodation)
- [x] Create rate card using template with both types
- [x] Log CAPPED expense and verify calculation
- [x] Log FIXED expense and verify calculation
- [x] Verify display shows correct labels (max vs fixed)
- [ ] Test backward compatibility with existing expenses
- [ ] Submit timesheet with mixed expense types
- [ ] Admin approval flow with new expense types

## Future Enhancements

1. **Validation**: Add backend validation to ensure CAPPED rates are not exceeded
2. **Reporting**: Update reports to distinguish between CAPPED and FIXED expenses
3. **Admin Override**: Allow admins to manually adjust CAPPED expenses if needed
4. **Audit Trail**: Track when rate types are changed in templates

## Deployment Steps

1. ✅ Update frontend TypeScript interfaces
2. ✅ Update UI components
3. ⏳ Deploy Firebase functions (if backend validation needed)
4. ⏳ Push to Git main branch
5. ⏳ Vercel automatic deployment

## Notes

- The calculation logic remains the same for both types (quantity × rate)
- The difference is primarily semantic and in the UI display
- Existing data will default to CAPPED for safety
- Admin training may be needed to understand the distinction
