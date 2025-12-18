# Rate Card Customization System

## Overview

The CrewQuo rate card system has been upgraded to a flexible three-tier architecture that allows companies to fully customize shift types, rate multipliers, and expense categories to match their specific business needs.

## Three-Tier Architecture

### Tier 1: Rate Card Templates
**Purpose:** Define the foundational structure for rate cards

Templates allow you to define:
- **Custom Shift Types** with individual rate multipliers (e.g., Sunday = 2.0x, Saturday = 1.5x)
- **Expense Categories** with unit types and default rates (e.g., Mileage at £0.45/mile, Accommodation at £80/day)
- **Resource Categories** for organizing labour and equipment

**Key Features:**
- Create multiple templates for different scenarios
- Set one template as the default for new rate cards
- Fully customizable shift types and multipliers
- Flexible expense tracking

**Example Template:**
```
Template: "UK Construction Standard"
Shift Types:
  - Weekday Standard (1.0x)
  - Saturday (1.5x - time and a half)
  - Sunday (2.0x - double time)
  - Bank Holiday (2.5x)
  - Night Shift (1.25x)

Expense Categories:
  - Mileage (per mile, £0.45)
  - Accommodation (per day, £80)
  - Parking Fees (flat rate, £15)
  - Tool Hire (per day, £25)
```

### Tier 2: Rate Cards
**Purpose:** Apply actual rates to roles using template structures

Rate cards contain:
- **Labour & Resource Rates**: Actual pricing for roles (Supervisor, Fitter, Driver, etc.)
- **Base Rate**: The standard rate before multipliers are applied
- **Automatic Calculation**: Hourly rates automatically calculated using shift type multipliers
- **Flexible Pricing**: Support for hourly, 4-hour, 8-hour, 10-hour, 12-hour, and flat shift rates
- **Expense Rates**: Actual rates for expenses defined in the template

**Example Rate Card:**
```
Rate Card: "London Site Rates 2024" (using UK Construction Standard template)

Labour Rates:
  Supervisor - Weekday Standard:
    Base Rate: £35/hour
    Calculated Rate: £35/hour (1.0x)
  
  Supervisor - Sunday:
    Base Rate: £35/hour
    Calculated Rate: £70/hour (2.0x)
  
  Fitter - Saturday:
    Base Rate: £28/hour
    Calculated Rate: £42/hour (1.5x)

Expense Rates:
  Mileage: £0.50/mile
  Accommodation: £100/day
  Parking: £20 flat rate
```

### Tier 3: Rate Assignments (Coming Soon)
**Purpose:** Assign rate cards to specific subcontractors, clients, or projects

This will allow:
- Assigning different rate cards to different subcontractors
- Client-specific or project-specific rates
- Easy rate card switching
- Historical tracking of rate changes

## Benefits

### 1. Complete Flexibility
- **No more fixed shift types**: Define exactly the shift types your business uses
- **Custom multipliers**: Set any multiplier you need (1.5x, 2.0x, 2.5x, or any other value)
- **Company-specific**: Different companies can have completely different rate structures

### 2. Automatic Calculations
- **Base rate system**: Enter the base rate once, all shift variations calculate automatically
- **Consistency**: Eliminates manual calculation errors
- **Easy updates**: Change the base rate and all shift types update accordingly

### 3. Comprehensive Expense Tracking
- **Custom categories**: Track expenses that matter to your business
- **Unit flexibility**: Flat rates, per mile, per day, per hour, per unit
- **Tax management**: Mark expenses as taxable or non-taxable

### 4. Better Organization
- **Templates for reusability**: Create once, use many times
- **Multiple rate cards**: Maintain different rates for different scenarios
- **Clear structure**: Easy to understand and maintain

## How to Use

### Step 1: Create a Rate Card Template

1. Navigate to **Dashboard → Rate Templates**
2. Click **"New Template"**
3. Enter template name and description
4. Define your shift types:
   - Name (e.g., "Sunday", "Night Shift")
   - Rate Multiplier (e.g., 2.0 for double time)
   - Optional description
5. Define expense categories:
   - Name (e.g., "Mileage", "Accommodation")
   - Unit type (flat, per_mile, per_day, per_hour, per_unit)
   - Default rate
   - Taxable status
6. Define resource categories (e.g., Labour, Vehicle, Equipment)
7. Optionally set as default template
8. Save

### Step 2: Create a Rate Card

1. Navigate to **Dashboard → Rate Cards**
2. Click **"Add Rate Card"**
3. Select a template (or choose "No Template" for legacy mode)
4. Enter rate card name and description
5. Add rate entries:
   - Select role/resource name
   - Choose category
   - Select shift type (from template)
   - **Enter base rate** - the hourly rate automatically calculates using the shift multiplier
   - Optionally enter 4-hour, 8-hour, 10-hour rates, etc.
   - Add any additional charges
6. Add expense rates (if template has expenses)
7. Save

### Step 3: Assign Rates (Coming Soon)

Future functionality will allow you to assign rate cards to:
- Specific subcontractors
- Specific clients
- Specific projects

## Example Scenarios

### Scenario 1: Construction Company with Weekend Premiums

**Template: "Weekend Premium Rates"**
```
Shift Types:
  - Weekday (1.0x)
  - Saturday (1.5x)
  - Sunday (2.0x)
```

**Rate Card: "Site A Labour 2024"**
```
General Labourer:
  - Weekday: £20/hour (base) → £20/hour
  - Saturday: £20/hour (base) → £30/hour (1.5x)
  - Sunday: £20/hour (base) → £40/hour (2.0x)
```

### Scenario 2: Security Company with Night Differential

**Template: "Security Shifts"**
```
Shift Types:
  - Day Shift (1.0x)
  - Evening Shift (1.15x)
  - Night Shift (1.25x)
  - Weekend Night (1.5x)
```

### Scenario 3: Transport Company with Mileage Tracking

**Template: "Transport & Logistics"**
```
Expense Categories:
  - Mileage (£0.45/mile)
  - Fuel Surcharge (£0.10/mile)
  - Congestion Charge (£15 flat)
  - Parking (flat rate)
  - Overnight Stay (£85/day)
```

## Migration from Legacy System

### Backward Compatibility

The new system is **fully backward compatible**:
- Existing rate cards continue to work without any changes
- You can choose "No Template (Legacy)" when creating new rate cards
- Legacy shift types are still available

### Recommended Migration Path

1. **Create a template** that matches your current rate structure
2. **Test with a new rate card** using the template
3. **Gradually migrate** existing rate cards by editing them and selecting a template
4. **No rush** - migrate at your own pace

## API Changes

### New Types

```typescript
// Rate Card Template
interface RateCardTemplate {
  id: string;
  name: string;
  description: string;
  shiftTypes: CustomShiftType[];
  expenseCategories: ExpenseCategory[];
  resourceCategories: string[];
  companyId: string;
  isDefault: boolean;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// Custom Shift Type
interface CustomShiftType {
  id: string;
  name: string;
  description?: string;
  rateMultiplier: number;
  applicableDays?: string[];
  startTime?: string;
  endTime?: string;
}

// Expense Category
interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  unitType: 'flat' | 'per_unit' | 'per_mile' | 'per_day' | 'per_hour';
  defaultRate?: number;
  taxable?: boolean;
}

// Updated Rate Entry (now with base rate and multiplier)
interface RateEntry {
  // ... existing fields ...
  baseRate: number;              // NEW: Base hourly rate
  rateMultiplier?: number;       // NEW: Applied multiplier
  shiftTypeId?: string;          // NEW: Reference to template shift type
  // ... existing fields ...
}

// Expense Entry
interface ExpenseEntry {
  id: string;
  categoryId: string;
  categoryName: string;
  description?: string;
  unitType: 'flat' | 'per_unit' | 'per_mile' | 'per_day' | 'per_hour';
  rate: number;
  taxable: boolean;
  notes?: string;
}
```

### Firestore Collections

**New Collection:**
- `rateCardTemplates` - Stores rate card templates

**Updated Collection:**
- `rateCards` - Now includes optional `templateId`, `templateName`, and `expenses` fields

## Security

All rate card templates and rate cards are:
- **Company-scoped**: Only visible to users within the company
- **Role-protected**: Only ADMIN and MANAGER roles can create/edit
- **Delete-protected**: Only ADMIN can delete templates and rate cards

## Best Practices

1. **Start with a template**: Always create templates before creating rate cards
2. **Use descriptive names**: Make it easy to identify templates and rate cards
3. **Set a default**: Set your most common template as default
4. **Review multipliers**: Ensure multipliers match your business agreements
5. **Document special cases**: Use description fields to note any special conditions
6. **Regular updates**: Review and update rates periodically

## Troubleshooting

### Template not showing in rate card form
- Ensure the template is marked as "Active"
- Refresh the page
- Check that you're in the correct company context

### Rate calculations seem wrong
- Verify the shift type multiplier in the template
- Check that the base rate is entered correctly
- The hourly rate should be: base rate × multiplier

### Can't delete a template
- Ensure it's not set as the default template
- Set another template as default first
- Only ADMIN users can delete templates

## Support

For questions or issues with the rate card system:
1. Check this documentation
2. Review the examples above
3. Contact support with specific details about your setup

## Future Enhancements

Planned improvements:
- **Rate assignment system** (Tier 3)
- **Rate history and versioning**
- **Bulk import/export of rate cards**
- **Rate comparison tools**
- **Advanced reporting on rates**
- **API for external rate management**
