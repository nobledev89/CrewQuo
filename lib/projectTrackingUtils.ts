/**
 * Utility functions for real-time project tracking and cost aggregation
 */

import { Timestamp } from 'firebase/firestore';

export interface TimeLogData {
  id: string;
  date: any;
  roleName: string;
  timeframeName?: string;
  shiftType?: string;
  hoursRegular: number;
  hoursOT?: number;
  quantity?: number;
  subCost: number;
  clientBill?: number;
  marginValue?: number;
  marginPct?: number;
  status: string;
  subcontractorId: string;
  startTime?: string;
  endTime?: string;
}

export interface ExpenseData {
  id: string;
  date: any;
  category: string;
  amount: number;
  quantity?: number;
  unitRate?: number;
  status: string;
  subcontractorId: string;
}

export interface StatusBreakdown {
  hours: number;
  cost: number;
  billing: number;
  margin: number;
  count: number;
}

export interface SubcontractorTracking {
  id: string;
  name: string;
  totalHours: number;
  totalCost: number;
  totalBilling: number;
  totalMargin: number;
  marginPct: number;
  byStatus: {
    draft: StatusBreakdown;
    submitted: StatusBreakdown;
    approved: StatusBreakdown;
  };
  timeLogs: TimeLogData[];
  expenses: ExpenseData[];
}

export interface ProjectTracking {
  totals: {
    hours: number;
    cost: number;
    billing: number;
    margin: number;
    marginPct: number;
  };
  byStatus: {
    draft: StatusBreakdown;
    submitted: StatusBreakdown;
    approved: StatusBreakdown;
  };
  subcontractors: SubcontractorTracking[];
}

/**
 * Calculate aggregate project costs across all statuses
 */
export function aggregateProjectCosts(
  timeLogs: TimeLogData[],
  expenses: ExpenseData[],
  subcontractorsMap: Map<string, string>
): ProjectTracking {
  // Initialize totals
  const totals = {
    hours: 0,
    cost: 0,
    billing: 0,
    margin: 0,
    marginPct: 0,
  };

  const byStatus: ProjectTracking['byStatus'] = {
    draft: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
    submitted: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
    approved: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
  };

  // Group by subcontractor
  const subcontractorMap = new Map<string, SubcontractorTracking>();

  // Process time logs
  timeLogs.forEach((log) => {
    const hours = (log.hoursRegular || 0) + (log.hoursOT || 0);
    const cost = log.subCost || 0;
    const billing = log.clientBill || 0;
    const margin = billing - cost;
    const status = (log.status || 'DRAFT').toLowerCase() as 'draft' | 'submitted' | 'approved';

    // Update totals
    totals.hours += hours;
    totals.cost += cost;
    totals.billing += billing;
    totals.margin += margin;

    // Update by status
    if (byStatus[status]) {
      byStatus[status].hours += hours;
      byStatus[status].cost += cost;
      byStatus[status].billing += billing;
      byStatus[status].margin += margin;
      byStatus[status].count += 1;
    }

    // Update subcontractor tracking
    const subId = log.subcontractorId;
    if (!subcontractorMap.has(subId)) {
      subcontractorMap.set(subId, {
        id: subId,
        name: subcontractorsMap.get(subId) || 'Unknown Subcontractor',
        totalHours: 0,
        totalCost: 0,
        totalBilling: 0,
        totalMargin: 0,
        marginPct: 0,
        byStatus: {
          draft: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
          submitted: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
          approved: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
        },
        timeLogs: [],
        expenses: [],
      });
    }

    const subTracking = subcontractorMap.get(subId)!;
    subTracking.totalHours += hours;
    subTracking.totalCost += cost;
    subTracking.totalBilling += billing;
    subTracking.totalMargin += margin;
    subTracking.byStatus[status].hours += hours;
    subTracking.byStatus[status].cost += cost;
    subTracking.byStatus[status].billing += billing;
    subTracking.byStatus[status].margin += margin;
    subTracking.byStatus[status].count += 1;
    subTracking.timeLogs.push(log);
  });

  // Process expenses
  expenses.forEach((exp) => {
    const cost = exp.amount || 0;
    const billing = cost; // Expenses are pass-through (no markup)
    const margin = 0; // No margin on expenses
    const status = (exp.status || 'DRAFT').toLowerCase() as 'draft' | 'submitted' | 'approved';

    // Update totals
    totals.cost += cost;
    totals.billing += billing;
    totals.margin += margin;

    // Update by status
    if (byStatus[status]) {
      byStatus[status].cost += cost;
      byStatus[status].billing += billing;
      byStatus[status].margin += margin;
      byStatus[status].count += 1;
    }

    // Update subcontractor tracking
    const subId = exp.subcontractorId;
    if (!subcontractorMap.has(subId)) {
      subcontractorMap.set(subId, {
        id: subId,
        name: subcontractorsMap.get(subId) || 'Unknown Subcontractor',
        totalHours: 0,
        totalCost: 0,
        totalBilling: 0,
        totalMargin: 0,
        marginPct: 0,
        byStatus: {
          draft: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
          submitted: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
          approved: { hours: 0, cost: 0, billing: 0, margin: 0, count: 0 },
        },
        timeLogs: [],
        expenses: [],
      });
    }

    const subTracking = subcontractorMap.get(subId)!;
    subTracking.totalCost += cost;
    subTracking.totalBilling += billing;
    subTracking.totalMargin += margin;
    subTracking.byStatus[status].cost += cost;
    subTracking.byStatus[status].billing += billing;
    subTracking.byStatus[status].margin += margin;
    subTracking.byStatus[status].count += 1;
    subTracking.expenses.push(exp);
  });

  // Calculate margin percentages
  totals.marginPct = totals.billing > 0 ? (totals.margin / totals.billing) * 100 : 0;

  // Calculate margin percentages for subcontractors
  subcontractorMap.forEach((sub) => {
    sub.marginPct = sub.totalBilling > 0 ? (sub.totalMargin / sub.totalBilling) * 100 : 0;
  });

  return {
    totals,
    byStatus,
    subcontractors: Array.from(subcontractorMap.values()).sort((a, b) => b.totalCost - a.totalCost),
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(timestamp: any): string {
  if (!timestamp) return 'N/A';

  try {
    let date: Date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Invalid Date';
    }

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'SUBMITTED':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'APPROVED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
