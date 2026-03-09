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
  let dateObj: Date | null = null;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  if (date) {
    dateObj = typeof date === 'string' ? new Date(date) : date;
    const dayIndex = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
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
      const rateEndMinutes = timeToMinutes(rate.endTime);
      
      // Check if this is an overnight rate (crosses midnight)
      const isOvernightRate = rateEndMinutes <= rateStartMinutes;
      
      // Check if current time falls within this rate's range
      let timeInRange = false;
      if (isOvernightRate) {
        // For overnight rates, check BOTH portions:
        // Evening portion (>= start time) OR morning portion (< end time)
        timeInRange = (normalizedCurrent >= rateStartMinutes) || (normalizedCurrent < rateEndMinutes);
      } else {
        // Standard same-day rate
        timeInRange = (normalizedCurrent >= rateStartMinutes && normalizedCurrent < rateEndMinutes);
      }
      
      // Check if current time falls within this rate's range
      if (timeInRange) {
        // If this rate has day restrictions
        if (rate.applicableDays && rate.applicableDays.length > 0) {
          // Date must be provided when rates have day restrictions
          if (!dayOfWeek || !dateObj) {
            // Skip this rate if no date provided but day restrictions exist
            continue;
          }
          
          // FOOLPROOF OVERNIGHT LOGIC:
          // For overnight rates (spanning midnight), check if the rate applies to
          // EITHER the current day OR the previous day
          
          const isOvernightRate = rateEndMinutes > 24 * 60;
          const isAfterMidnight = currentMinute >= 24 * 60;
          
          let dayMatches = false;
          
          if (isOvernightRate && isAfterMidnight) {
            // We're in the "next day" portion of work that started yesterday
            // Check if rate applies to YESTERDAY (the day the shift started)
            const prevDayIndex = (dateObj.getDay() - 1 + 7) % 7;
            const prevDay = dayNames[prevDayIndex];
            
            // Rate applies if it's valid for EITHER today OR yesterday
            dayMatches = rate.applicableDays.includes(dayOfWeek as any) || 
                        rate.applicableDays.includes(prevDay as any);
          } else if (isOvernightRate && !isAfterMidnight) {
            // We're in the "before midnight" portion of an overnight rate
            // Check if rate applies to today OR tomorrow
            const nextDayIndex = (dateObj.getDay() + 1) % 7;
            const nextDay = dayNames[nextDayIndex];
            
            dayMatches = rate.applicableDays.includes(dayOfWeek as any) || 
                        rate.applicableDays.includes(nextDay as any);
          } else {
            // Standard same-day rate, or we're working within a single day
            dayMatches = rate.applicableDays.includes(dayOfWeek as any);
          }
          
          if (dayMatches) {
            applicableRate = rate;
            break;
          }
          // If day doesn't match, continue to next rate
        } else {
          // No day restriction, apply the rate
          applicableRate = rate;
          break;
        }
      }
    }

    if (applicableRate) {
      // Calculate minutes in this rate range
      const rateStartMinutes = timeToMinutes(applicableRate.startTime);
      const rateEndMinutes = timeToMinutes(applicableRate.endTime);
      const isOvernightRate = rateEndMinutes <= rateStartMinutes;
      
      // How many minutes until this rate range ends?
      let minutesUntilRateEnd: number;
      
      if (isOvernightRate) {
        // For overnight rates, check which portion we're in
        if (normalizedCurrent >= rateStartMinutes) {
          // We're in the evening portion (e.g., 22:00-23:59)
          // Calculate to midnight, then add the morning portion
          const toMidnight = (24 * 60) - normalizedCurrent;
          minutesUntilRateEnd = toMidnight + rateEndMinutes;
        } else {
          // We're in the morning portion (e.g., 00:00-06:00)
          minutesUntilRateEnd = rateEndMinutes - normalizedCurrent;
        }
      } else {
        // Standard same-day rate
        minutesUntilRateEnd = rateEndMinutes - normalizedCurrent;
      }
      
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
