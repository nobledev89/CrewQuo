# Time-Based Rate Card System Implementation

## Overview

This document describes the implementation of a time-based rate card system where administrators can configure different hourly rates for specific time ranges, and subcontractors can simply select a date and time range using time pickers. The system automatically calculates hours and costs based on the configured rates.

## Features

### 1. **Admin Configuration** (Rate Card Settings)
- **Time-Based Rate Ranges**: Admins can define multiple time ranges with different rates for each role
- **Example Configuration**:
  - 08:00-17:00 (Day rate): £20/hr subcontractor, £28/hr client
  - 17:00-23:00 (Evening rate): £25/hr subcontractor, £35/hr client  
  - 23:00-08:00 (Night rate): £30/hr subcontractor, £42/hr client

### 2. **Subcontractor Time Logging** (Simple UI)
- Select date (date picker)
- Select start time (time picker)
- Select end time (time picker)
- Select role/shift type (dropdown)
- System automatically:
  - Calculates total hours
  - Determines which rate(s) apply based on time ranges
  - Computes total cost
  - Shows breakdown if multiple rates apply

### 3. **Automatic Calculation**
- Handles overnight shifts (e.g., 23:00 to 06:00)
- Splits hours across multiple rate ranges automatically
- Provides detailed breakdown of calculations
- Supports both time-based and legacy flat-rate systems

## Technical Implementation

### 1. Type Definitions (`lib/types.ts`)

```typescript
export interface TimeBasedRate {
  id: string;
  startTime: string;             // e.g., "08:00"
  endTime: string;               // e.g., "17:00"
  subcontractorRate: number;     // Hourly rate for subcontractor
  clientRate: number;            // Hourly rate for client
  description?: string;          // e.g., "Day rate"
}

export interface RateEntry {
  // ... existing fields ...
  
  // NEW: Time-based rate configuration
  timeBasedRates?: TimeBasedRate[];  // Array of time ranges with rates
}
```

### 2. Rate Calculation Logic (`lib/timeBasedRateCalculator.ts`)

**Key Functions**:

- `calculateTimeBasedCost()`: Main function that calculates costs across time ranges
  - Input: start time, end time, time-based rates, fallback rates
  - Output: total hours, costs, and detailed breakdown

- `calculateSimpleCost()`: Legacy calculation for flat rates
  - Input: hours, rates, quantity
  - Output: subcontractor cost and client bill

**Algorithm**:
1. Convert times to minutes since midnight
2. Handle overnight shifts (add 24 hours if end < start)
3. Sort time-based rates by start time
4. Iterate through work period:
   - Find applicable rate for current time segment
   - Calculate hours and cost for that segment
   - Move to next segment
5. Sum all segments for totals

**Example Calculation**:
```
Work Period: 16:00 - 20:00 (4 hours)

Rate Configuration:
- 08:00-17:00: £20/hr (Day rate)
- 17:00-23:00: £25/hr (Evening rate)

Breakdown:
- 16:00-17:00 (1 hour) @ £20/hr = £20
- 17:00-20:00 (3 hours) @ £25/hr = £75
Total: 4 hours, £95
```

### 3. Admin UI (`components/RateCardForm.tsx`)

**New Section: "3a. Time-Based Rates"**

- Button to add time ranges
- For each time range:
  - Description field
  - Start time picker (HH:MM)
  - End time picker (HH:MM)
  - Subcontractor rate (£/hr)
  - Client rate (£/hr)
- Remove button for each range
- Visual indication when time-based rates are configured

**UI Features**:
- Indigo color scheme to distinguish from standard rates
- Helpful tooltip explaining the feature
- Optional/advanced feature (backward compatible)
- Empty state message when no ranges configured

### 4. Subcontractor UI (To be implemented in `components/ProjectModal.tsx`)

**Proposed Changes**:

```typescript
// Add time picker mode toggle
const [useTimePicker, setUseTimePicker] = useState(false);
const [logForm, setLogForm] = useState({
  date: '',
  rateKey: '',
  startTime: '',      // NEW: for time picker mode
  endTime: '',        // NEW: for time picker mode
  hoursRegular: 8,    // Used in manual mode
  hoursOT: 0,
  quantity: 1,
  notes: '',
});

// Automatic calculation when using time pickers
useEffect(() => {
  if (useTimePicker && logForm.startTime && logForm.endTime && selectedRateEntry) {
    const timeBasedRates = selectedRateEntry.timeBasedRates;
    
    if (timeBasedRates && timeBasedRates.length > 0) {
      // Use time-based calculation
      const result = calculateTimeBasedCost(
        logForm.startTime,
        logForm.endTime,
        timeBasedRates,
        selectedRateEntry.subcontractorRate,
        selectedRateEntry.clientRate
      );
      
      // Update hours and cost automatically
      setLogForm(prev => ({
        ...prev,
        hoursRegular: result.totalHours,
        hoursOT: 0
      }));
      
      // Show breakdown to user
      setCalculationBreakdown(result.breakdown);
    }
  }
}, [useTimePicker, logForm.startTime, logForm.endTime, selectedRateEntry]);
```

**UI Layout**:
```
┌─────────────────────────────────────────────┐
│ Add Time Log                                │
├─────────────────────────────────────────────┤
│ Date: [2024-01-15]                          │
│ Role & Shift: [Fitter - Day Shift]         │
│                                             │
│ ○ Manual Entry                              │
│   Regular Hours: [8] OT Hours: [0]         │
│                                             │
│ ● Time Picker (Automatic Calculation)      │
│   Start Time: [08:00]                      │
│   End Time: [17:00]                        │
│                                             │
│   📊 Calculation:                          │
│   08:00-17:00 (Day rate): 9h @ £20 = £180 │
│   Total: 9.0 hours • £180                  │
│                                             │
│ Men: [1]                                    │
│ Cost Preview: £180.00                      │
│ [Add] [Cancel]                             │
└─────────────────────────────────────────────┘
```

## Database Schema

### RateCard Document (Firestore)
```json
{
  "id": "ratecard123",
  "name": "Standard Labour Rates 2024",
  "rates": [
    {
      "roleName": "Fitter",
      "category": "Labour",
      "shiftType": "Day Shift",
      "subcontractorRate": 20,
      "clientRate": 28,
      
      // NEW: Time-based rates configuration
      "timeBasedRates": [
        {
          "id": "uuid-1",
          "startTime": "08:00",
          "endTime": "17:00",
          "subcontractorRate": 20,
          "clientRate": 28,
          "description": "Day rate"
        },
        {
          "id": "uuid-2",
          "startTime": "17:00",
          "endTime": "23:00",
          "subcontractorRate": 25,
          "clientRate": 35,
          "description": "Evening rate"
        },
        {
          "id": "uuid-3",
          "startTime": "23:00",
          "endTime": "08:00",
          "subcontractorRate": 30,
          "clientRate": 42,
          "description": "Night rate"
        }
      ]
    }
  ]
}
```

### TimeLog Document (Firestore)
```json
{
  "id": "log123",
  "date": "2024-01-15",
  "roleName": "Fitter",
  "shiftType": "Day Shift",
  
  // Standard fields (still used)
  "hoursRegular": 9,
  "hoursOT": 0,
  "subCost": 180,
  "clientBill": 252,
  
  // NEW: Optional fields for time-based tracking
  "startTime": "08:00",
  "endTime": "17:00",
  "timeBasedCalculation": {
    "totalHours": 9,
    "breakdown": [
      {
        "timeRange": "08:00-17:00 (Day rate)",
        "hours": 9,
        "subRate": 20,
        "clientRate": 28,
        "subCost": 180,
        "clientCost": 252
      }
    ]
  }
}
```

## User Workflows

### Admin Workflow: Configure Time-Based Rates

1. Navigate to **Rate Cards** section
2. Create or edit a rate card
3. Add a rate entry for a role (e.g., "Fitter")
4. Scroll to **"3a. Time-Based Rates"** section
5. Click **"Add Time Range"**
6. Configure each time range:
   - Description: "Day rate"
   - Start Time: 08:00
   - End Time: 17:00
   - Sub Rate: £20/hr
   - Client Rate: £28/hr
7. Add additional ranges as needed
8. Save rate card
9. Assign rate card to subcontractor

### Subcontractor Workflow: Log Time

1. Navigate to **My Work > Projects**
2. Select a project
3. Go to **Time Logs** tab
4. Fill in time log form:
   - Date: Select date
   - Role & Shift: Select from dropdown
   - **Choose input method:**
     - **Option A**: Manual entry (hours only)
     - **Option B**: Time picker (start/end time) ← NEW
5. If using time picker:
   - Select start time (e.g., 14:00)
   - Select end time (e.g., 22:00)
   - System shows automatic calculation:
     ```
     14:00-17:00 (Day rate): 3h @ £20 = £60
     17:00-22:00 (Evening rate): 5h @ £25 = £125
     Total: 8.0 hours • £185
     ```
6. Enter number of men if applicable
7. Click **Add** to save
8. Time log appears in the list with calculated cost

## Benefits

### For Admins:
✅ Precise rate control based on time of day
✅ Automatic premium rate application (evenings, nights, weekends)
✅ Reduced errors in rate calculations
✅ Better cost tracking and reporting

### For Subcontractors:
✅ Simple, intuitive interface (just pick times)
✅ No manual hour calculations needed
✅ Immediate feedback on earnings
✅ Transparent breakdown of rates applied

### For the System:
✅ Backward compatible (works with existing flat-rate system)
✅ Handles complex scenarios (overnight shifts, multiple rate ranges)
✅ Consistent calculation logic across the platform
✅ Detailed audit trail of calculations

## Implementation Status

### ✅ Completed:
- [x] Type definitions for time-based rates
- [x] Rate calculation algorithm
- [x] Admin UI for configuring time-based rates
- [x] Utility functions for time calculations

### 🚧 In Progress:
- [ ] Update ProjectModal with time picker UI
- [ ] Integrate calculation logic with time log creation
- [ ] Add breakdown display in time log list
- [ ] Store calculation details in Firestore

### 📋 Pending:
- [ ] Testing with various time scenarios
- [ ] Mobile responsive design for time pickers
- [ ] Admin reports showing time-based rate usage
- [ ] Export functionality with rate breakdowns
- [ ] Documentation for end users

## Testing Scenarios

### Test Case 1: Simple Day Shift
- Start: 08:00, End: 17:00
- Expected: 9 hours @ day rate
- Breakdown: 1 segment

### Test Case 2: Cross Two Rate Ranges
- Start: 15:00, End: 20:00
- Expected: 
  - 15:00-17:00: 2 hours @ day rate
  - 17:00-20:00: 3 hours @ evening rate
- Breakdown: 2 segments

### Test Case 3: Overnight Shift
- Start: 22:00, End: 06:00
- Expected:
  - 22:00-23:00: 1 hour @ evening rate
  - 23:00-06:00: 7 hours @ night rate
- Breakdown: 2 segments

### Test Case 4: Full 24-Hour Period
- Start: 08:00, End: 08:00 (next day)
- Expected: 24 hours split across all rate ranges

### Test Case 5: Multiple Workers
- Start: 08:00, End: 17:00
- Quantity: 3 men
- Expected: 9 hours × 3 = 27 man-hours total

## Migration Strategy

### Phase 1: Soft Launch (Current)
- Feature is optional
- Existing rate cards continue to work
- New time-based rates can be added to any rate card
- No changes to existing timesheets

### Phase 2: Gradual Adoption
- Admin enables time-based rates for specific roles
- Subcontractors can choose between manual or time picker entry
- System supports both methods simultaneously

### Phase 3: Full Rollout
- Encourage use of time-based rates
- Provide training materials
- Monitor usage and gather feedback

## Support & Troubleshooting

### Common Issues:

**Q: What if a subcontractor works during a time not covered by any rate range?**
A: The system falls back to the base subcontractorRate and clientRate defined for the role.

**Q: How are breaks handled?**
A: Breaks are not automatically deducted. Subcontractors should enter actual working time (e.g., if shift is 08:00-17:00 with 1-hour lunch, enter 08:00-12:00 and 13:00-17:00 as two separate entries).

**Q: Can overnight shifts be logged?**
A: Yes! If end time is earlier than start time, the system automatically treats it as next-day (e.g., 23:00-06:00 = 7 hours).

**Q: Can I edit time-based rates after they're configured?**
A: Yes, but existing time logs retain their original calculation. Only new logs will use updated rates.

## Future Enhancements

- **Break deductions**: Automatically subtract unpaid break time
- **Weekly patterns**: Define different rates for different days of the week
- **Holiday rates**: Special rates for public holidays
- **Overtime thresholds**: Automatic overtime rate after X hours
- **GPS tracking**: Optional location verification for remote work
- **Bulk import**: Import time-based rate configurations from CSV
- **Rate history**: Track rate changes over time
- **Predictive costing**: Estimate costs before logging time

## Conclusion

The time-based rate card system provides a flexible, accurate, and user-friendly way to manage varying hourly rates based on work timing. The implementation is backward compatible, well-documented, and ready for gradual rollout across the platform.

---

**Last Updated**: January 8, 2026
**Version**: 1.0
**Author**: Development Team
