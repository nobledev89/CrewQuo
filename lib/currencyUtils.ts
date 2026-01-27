/**
 * Currency utility functions for consistent rounding and calculations
 */

/**
 * Round a currency value to 2 decimal places
 * @param value The value to round
 * @returns The rounded value
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate margin value
 * @param clientBill The client billing amount
 * @param cost The cost amount
 * @returns The margin value (clientBill - cost)
 */
export function calculateMarginValue(clientBill: number, cost: number): number {
  return roundCurrency(clientBill - cost);
}

/**
 * Calculate margin percentage
 * @param clientBill The client billing amount
 * @param cost The cost amount
 * @returns The margin percentage ((clientBill - cost) / clientBill * 100)
 */
export function calculateMarginPercentage(clientBill: number, cost: number): number {
  if (clientBill <= 0) return 0;
  const margin = clientBill - cost;
  return roundCurrency((margin / clientBill) * 100);
}

/**
 * Validate that a rate is within acceptable bounds
 * @param rate The rate to validate
 * @returns True if valid, false otherwise
 */
export function isValidRate(rate: number): boolean {
  return rate >= 0 && rate <= 10000;
}

/**
 * Format currency for display
 * @param amount The amount to format
 * @param currency The currency code (default: GBP)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
