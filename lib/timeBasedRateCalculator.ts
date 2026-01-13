import { TimeBasedRate } from './types';

/**
 * Calculate hours and cost based on time ranges with different rates
 */
export interface TimeRangeCalculation {
  totalHours: number;
  subcontractorCost: number;
  clientBill: number;
  breakdown: {
    timeRange: string;
    hours: number;
    subRate: number;
    clientRate: number;
    subCost: number;
    clientCost: number;
  }[];
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to hours (decimal)
 */
function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Format minutes to HH:MM
 */
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate cost for a time period based on configured time-based rates
 * @param startTime Start time in HH:MM format
 * @param endTime End time in HH:MM format
 * @param timeBasedRates Array of time-based rate configurations
 * @param fallbackSubRate Fallback subcontractor rate if no time-based rate matches
 * @param fallbackClientRate Fallback client rate if no time-based rate matches
 * @param date Optional date to check day-of-week applicability (Date object or ISO string)
 * @returns Calculation details including total hours and costs
 */
export function calculateTimeBasedCost(
  startTime: string,
  endTime: string,
  timeBasedRates: TimeBasedRate[],
  fallbackSubRate: number,
  fallbackClientRate: number,
  date?: Date | string
): TimeRangeCalculation {
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);

  // Handle overnight shifts (end time is next day)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }

  const totalMinutesWorked = endMinutes - startMinutes;
  const breakdown: TimeRangeCalculation['breakdown'] = [];

  // Get day of week from date if provided
  let dayOfWeek: string | null = null;
  if (date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dayIndex = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    dayOfWeek = dayNames[dayIndex];
  }

  // Sort time-based rates by start time
  const sortedRates = [...timeBasedRates].sort((a, b) => 
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  let currentMinute = startMinutes;
  let remainingMinutes = totalMinutesWorked;

  while (remainingMinutes > 0 && currentMinute < endMinutes) {
    // Normalize current minute for comparison (handle overnight)
    const normalizedCurrent = currentMinute % (24 * 60);
    
    // Find applicable rate for current time
    let applicableRate: TimeBasedRate | null = null;
    
    for (const rate of sortedRates) {
      const rateStartMinutes = timeToMinutes(rate.startTime);
      let rateEndMinutes = timeToMinutes(rate.endTime);
      
      // Handle overnight rate ranges
      if (rateEndMinutes <= rateStartMinutes) {
        rateEndMinutes += 24 * 60;
      }
      
      // Check if current time falls within this rate's range
      if (normalizedCurrent >= rateStartMinutes && normalizedCurrent < rateEndMinutes) {
        // Also check day of week if applicable
        if (dayOfWeek && rate.applicableDays && rate.applicableDays.length > 0) {
          // Only apply this rate if the day matches
          if (rate.applicableDays.includes(dayOfWeek as any)) {
            applicableRate = rate;
            break;
          }
          // If day doesn't match, continue to next rate
        } else {
          // No day restriction or no date provided, apply the rate
          applicableRate = rate;
          break;
        }
      }
    }

    if (applicableRate) {
      // Calculate minutes in this rate range
      const rateStartMinutes = timeToMinutes(applicableRate.startTime);
      let rateEndMinutes = timeToMinutes(applicableRate.endTime);
      
      if (rateEndMinutes <= rateStartMinutes) {
        rateEndMinutes += 24 * 60;
      }
      
      // How many minutes until this rate range ends?
      const minutesUntilRateEnd = rateEndMinutes - normalizedCurrent;
      const minutesInThisRange = Math.min(remainingMinutes, minutesUntilRateEnd);
      
      const hoursInThisRange = minutesToHours(minutesInThisRange);
      const subCost = hoursInThisRange * applicableRate.subcontractorRate;
      const clientCost = hoursInThisRange * applicableRate.clientRate;
      
      breakdown.push({
        timeRange: `${applicableRate.startTime}-${applicableRate.endTime} (${applicableRate.description || 'Rate'})`,
        hours: hoursInThisRange,
        subRate: applicableRate.subcontractorRate,
        clientRate: applicableRate.clientRate,
        subCost,
        clientCost,
      });
      
      currentMinute += minutesInThisRange;
      remainingMinutes -= minutesInThisRange;
    } else {
      // No matching rate found, use fallback rate for remaining time
      const hoursRemaining = minutesToHours(remainingMinutes);
      const subCost = hoursRemaining * fallbackSubRate;
      const clientCost = hoursRemaining * fallbackClientRate;
      
      breakdown.push({
        timeRange: `${minutesToTimeString(normalizedCurrent)}-${minutesToTimeString(normalizedCurrent + remainingMinutes)} (Standard)`,
        hours: hoursRemaining,
        subRate: fallbackSubRate,
        clientRate: fallbackClientRate,
        subCost,
        clientCost,
      });
      
      break; // Exit loop
    }
  }

  // Calculate totals
  const totalHours = minutesToHours(totalMinutesWorked);
  const subcontractorCost = breakdown.reduce((sum, item) => sum + item.subCost, 0);
  const clientBill = breakdown.reduce((sum, item) => sum + item.clientCost, 0);

  return {
    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
    subcontractorCost: Math.round(subcontractorCost * 100) / 100,
    clientBill: Math.round(clientBill * 100) / 100,
    breakdown,
  };
}

/**
 * Simple calculation without time-based rates (fallback)
 */
export function calculateSimpleCost(
  hours: number,
  subRate: number,
  clientRate: number,
  quantity: number = 1
): { subcontractorCost: number; clientBill: number } {
  const subcontractorCost = Math.round(hours * subRate * quantity * 100) / 100;
  const clientBill = Math.round(hours * clientRate * quantity * 100) / 100;
  
  return { subcontractorCost, clientBill };
}
