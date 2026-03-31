/**
 * Project Export Utilities
 * Export project data to CSV, XLSX, and PDF formats
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  formatCurrency, 
  formatDate,
  type TimeLogData,
  type ExpenseData,
  type ProjectTracking,
  type SubcontractorTracking 
} from './projectTrackingUtils';

interface ExportOptions {
  projectCode: string;
  projectName: string;
  location: string;
  status: string;
  projectTracking: ProjectTracking;
  timeLogs: TimeLogData[];
  expenses: ExpenseData[];
  visibility: {
    showCosts: boolean;
    showMargins: boolean;
    showSubcontractorRates: boolean;
    allowClientNotes: boolean;
    showDraftStatus: boolean;
    showRejectedStatus: boolean;
  };
  currency: string;
}

interface LineItem {
  date: string;
  type: string;
  subcontractor: string;
  description: string;
  time: string;
  notes?: string;
  qtyHours: string;
  cost?: string;
  bill: string;
  margin?: string;
  marginPct?: string;
}

const normalizeTimeframeName = (value?: string): string | undefined => {
  if (!value) return value;
  return value.replace(/\(\d{2}:\d{2}-\d{2}:\d{2}\)/g, '').replace(/\s{2,}/g, ' ').trim();
};

const getLogTimeRange = (log: TimeLogData): string => {
  const isSegment = Boolean(
    log.splitGroupId ||
    log.splitIndex ||
    log.segmentStartTime ||
    log.segmentEndTime
  );
  if (log.entryStartTime && log.entryEndTime) {
    return `${log.entryStartTime}-${log.entryEndTime}`;
  }
  if (!isSegment && log.startTime && log.endTime) {
    return `${log.startTime}-${log.endTime}`;
  }
  return '-';
};

/**
 * Filter data based on visibility settings
 */
function filterLineItems(
  timeLogs: TimeLogData[],
  expenses: ExpenseData[],
  subcontractorsMap: Map<string, string>,
  visibility: ExportOptions['visibility'],
  subcontractors?: SubcontractorTracking[]
): LineItem[] {
  const items: LineItem[] = [];

  const pushTimeLog = (log: TimeLogData, subcontractorName: string) => {
    const status = log.status.toUpperCase();

    // Filter by status visibility
    if (status === 'DRAFT' && !visibility.showDraftStatus) return;
    if (status === 'REJECTED' && !visibility.showRejectedStatus) return;

    const totalHours = (log.hoursRegular || 0) + (log.hoursOT || 0);
    const margin = (log.clientBill || 0) - (log.subCost || 0);
    const marginPct = log.clientBill && log.clientBill > 0
      ? ((margin / log.clientBill) * 100).toFixed(1)
      : '0.0';

    const item: LineItem = {
      date: formatDate(log.date),
      type: 'Time',
      subcontractor: subcontractorName,
      description: `${log.roleName}${log.timeframeName ? ` - ${normalizeTimeframeName(log.timeframeName)}` : log.shiftType ? ` - ${log.shiftType}` : ''}`,
      time: getLogTimeRange(log),
      notes: log.notes || '',
      qtyHours: `${totalHours.toFixed(1)}h${log.quantity && log.quantity > 1 ? ` x ${log.quantity}` : ''}`,
      bill: String(log.clientBill || 0),
    };

    if (visibility.showCosts) {
      item.cost = String(log.subCost || 0);
    }

    if (visibility.showMargins) {
      item.margin = String(margin);
      item.marginPct = marginPct;
    }

    items.push(item);
  };

  const pushExpense = (exp: ExpenseData, subcontractorName: string) => {
    const status = exp.status.toUpperCase();

    // Filter by status visibility
    if (status === 'DRAFT' && !visibility.showDraftStatus) return;
    if (status === 'REJECTED' && !visibility.showRejectedStatus) return;

    const billing = exp.clientBillAmount ?? exp.amount;
    const margin = billing - exp.amount;
    const marginPct = billing > 0 ? ((margin / billing) * 100).toFixed(1) : '0.0';

    const item: LineItem = {
      date: formatDate(exp.date),
      type: 'Expense',
      subcontractor: subcontractorName,
      description: exp.category,
      time: '-',
      notes: exp.description || '',
      qtyHours: exp.quantity ? `${exp.quantity.toFixed(1)}${exp.unitRate ? ` @ ${exp.unitRate}` : ''}` : '1',
      bill: String(billing),
    };

    if (visibility.showCosts) {
      item.cost = String(exp.amount);
    }

    if (visibility.showMargins) {
      item.margin = String(margin);
      item.marginPct = marginPct;
    }

    items.push(item);
  };

  if (subcontractors && subcontractors.length > 0) {
    subcontractors.forEach((sub) => {
      const subcontractorName = sub.name || subcontractorsMap.get(sub.id) || 'Unknown';
      sub.timeLogs.forEach((log) => pushTimeLog(log, subcontractorName));
      sub.expenses.forEach((exp) => pushExpense(exp, subcontractorName));
    });

    return items;
  }

  // Process time logs
  timeLogs.forEach((log) => {
    const subcontractorName = subcontractorsMap.get(log.subcontractorId) || 'Unknown';
    pushTimeLog(log, subcontractorName);
  });

  // Process expenses
  expenses.forEach((exp) => {
    const subcontractorName = subcontractorsMap.get(exp.subcontractorId) || 'Unknown';
    pushExpense(exp, subcontractorName);
  });

  // Sort by date descending
  items.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  return items;
}
/**
 * Export to CSV
 */
export function exportToCSV(options: ExportOptions): void {
  const { projectCode, projectName, projectTracking, timeLogs, expenses, visibility, currency } = options;
  
  // Build subcontractors map
  const subcontractorsMap = new Map<string, string>();
  projectTracking.subcontractors.forEach(sub => {
    subcontractorsMap.set(sub.id, sub.name);
  });

  // Get filtered line items
  const items = filterLineItems(timeLogs, expenses, subcontractorsMap, visibility, projectTracking.subcontractors);

  // Build CSV header
  const headers = ['Date', 'Type', 'Subcontractor', 'Description', 'Time', 'Notes', 'Qty/Hours'];
  if (visibility.showCosts) headers.push('Cost');
  headers.push('Bill');
  if (visibility.showMargins) {
    headers.push('Margin', 'Margin %');
  }

  // Build CSV rows
  const rows = items.map(item => {
    const row = [
      item.date,
      item.type,
      item.subcontractor,
      item.description,
      item.time,
      item.notes || '',
      item.qtyHours,
    ];
    
    if (visibility.showCosts) {
      row.push(formatCurrency(parseFloat(item.cost || '0'), currency));
    }
    
    row.push(formatCurrency(parseFloat(item.bill), currency));
    
    if (visibility.showMargins) {
      row.push(
        formatCurrency(parseFloat(item.margin || '0'), currency),
        `${item.marginPct}%`
      );
    }

    return row;
  });

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectCode}_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export to XLSX
 */
export function exportToXLSX(options: ExportOptions): void {
  const { projectCode, projectName, location, status, projectTracking, timeLogs, expenses, visibility, currency } = options;

  const workbook = XLSX.utils.book_new();

  // Build subcontractors map
  const subcontractorsMap = new Map<string, string>();
  projectTracking.subcontractors.forEach(sub => {
    subcontractorsMap.set(sub.id, sub.name);
  });

  // ===== SHEET 1: Summary =====
  const summaryData: any[][] = [
    ['Project Report'],
    [''],
    ['Project Code:', projectCode],
    ['Project Name:', projectName],
    ['Location:', location],
    ['Status:', status],
    ['Generated:', new Date().toLocaleDateString()],
    [''],
    ['Summary Totals'],
    [''],
  ];

  // Add totals based on visibility
  summaryData.push(['Total Hours:', projectTracking.totals.hours.toFixed(1)]);
  if (visibility.showCosts) {
    summaryData.push(['Total Cost:', formatCurrency(projectTracking.totals.cost, currency)]);
  }
  summaryData.push(['Total Billing:', formatCurrency(projectTracking.totals.billing, currency)]);
  if (visibility.showMargins) {
    summaryData.push(['Total Margin:', formatCurrency(projectTracking.totals.margin, currency)]);
    summaryData.push(['Margin %:', `${projectTracking.totals.marginPct.toFixed(1)}%`]);
  }

  // Add status breakdown
  summaryData.push([''], ['Status Breakdown'], ['']);
  const statusHeaders = ['Status', 'Count', 'Hours'];
  if (visibility.showCosts) statusHeaders.push('Cost');
  statusHeaders.push('Billing');
  if (visibility.showMargins) statusHeaders.push('Margin');
  summaryData.push(statusHeaders);

  // Add each status
  const statusKeys = ['approved', 'submitted', 'draft', 'rejected'] as const;
  const statusLabels = { approved: 'Approved', submitted: 'Submitted', draft: 'Draft', rejected: 'Rejected' };
  
  statusKeys.forEach(key => {
    if (key === 'draft' && !visibility.showDraftStatus) return;
    if (key === 'rejected' && !visibility.showRejectedStatus) return;

    const statusData = projectTracking.byStatus[key];
    const row = [
      statusLabels[key],
      statusData.count,
      statusData.hours.toFixed(1),
    ];
    if (visibility.showCosts) row.push(formatCurrency(statusData.cost, currency));
    row.push(formatCurrency(statusData.billing, currency));
    if (visibility.showMargins) row.push(formatCurrency(statusData.margin, currency));
    summaryData.push(row);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // ===== SHEET 2: All Line Items =====
  const items = filterLineItems(timeLogs, expenses, subcontractorsMap, visibility, projectTracking.subcontractors);
  
  const itemsHeaders = ['Date', 'Type', 'Subcontractor', 'Description', 'Time', 'Notes', 'Qty/Hours'];
  if (visibility.showCosts) itemsHeaders.push('Cost');
  itemsHeaders.push('Bill');
  if (visibility.showMargins) itemsHeaders.push('Margin', 'Margin %');

  const itemsData = items.map(item => {
    const row: any[] = [
      item.date,
      item.type,
      item.subcontractor,
      item.description,
      item.time,
      item.notes || '',
      item.qtyHours,
    ];
    
    if (visibility.showCosts) {
      row.push(formatCurrency(parseFloat(item.cost || '0'), currency));
    }
    
    row.push(formatCurrency(parseFloat(item.bill), currency));
    
    if (visibility.showMargins) {
      row.push(
        formatCurrency(parseFloat(item.margin || '0'), currency),
        `${item.marginPct}%`
      );
    }

    return row;
  });

  const itemsSheet = XLSX.utils.aoa_to_sheet([itemsHeaders, ...itemsData]);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Line Items');

  // ===== SHEET 3: Subcontractors =====
  const subHeaders = ['Subcontractor', 'Hours'];
  if (visibility.showCosts) subHeaders.push('Cost');
  subHeaders.push('Billing');
  if (visibility.showMargins) subHeaders.push('Margin', 'Margin %');

  const subData = projectTracking.subcontractors.map(sub => {
    const row: any[] = [sub.name, sub.totalHours.toFixed(1)];
    if (visibility.showCosts) row.push(formatCurrency(sub.totalCost, currency));
    row.push(formatCurrency(sub.totalBilling, currency));
    if (visibility.showMargins) {
      row.push(formatCurrency(sub.totalMargin, currency), `${sub.marginPct.toFixed(1)}%`);
    }
    return row;
  });

  const subSheet = XLSX.utils.aoa_to_sheet([subHeaders, ...subData]);
  XLSX.utils.book_append_sheet(workbook, subSheet, 'Subcontractors');

  // Export workbook
  XLSX.writeFile(workbook, `${projectCode}_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export to PDF (Landscape)
 */
export function exportToPDF(options: ExportOptions): void {
  const { projectCode, projectName, location, status, projectTracking, timeLogs, expenses, visibility, currency } = options;

  // Create PDF in landscape mode
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Build subcontractors map
  const subcontractorsMap = new Map<string, string>();
  projectTracking.subcontractors.forEach(sub => {
    subcontractorsMap.set(sub.id, sub.name);
  });

  // ===== HEADER =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Report', 15, yPosition);
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 15, yPosition);
  
  yPosition += 15;

  // ===== PROJECT DETAILS =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Information', 15, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const projectDetails = [
    ['Project Code:', projectCode],
    ['Project Name:', projectName],
    ['Location:', location],
    ['Status:', status],
  ];

  projectDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 15, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 55, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // ===== SUMMARY TOTALS =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Totals', 15, yPosition);
  yPosition += 2;

  const summaryHeaders: string[] = ['Hours'];
  if (visibility.showCosts) summaryHeaders.push('Total Cost');
  summaryHeaders.push('Total Billing');
  if (visibility.showMargins) summaryHeaders.push('Total Margin', 'Margin %');

  const summaryData: (string | number)[][] = [[
    projectTracking.totals.hours.toFixed(1),
  ]];
  if (visibility.showCosts) summaryData[0].push(formatCurrency(projectTracking.totals.cost, currency));
  summaryData[0].push(formatCurrency(projectTracking.totals.billing, currency));
  if (visibility.showMargins) {
    summaryData[0].push(
      formatCurrency(projectTracking.totals.margin, currency),
      `${projectTracking.totals.marginPct.toFixed(1)}%`
    );
  }

  autoTable(doc, {
    startY: yPosition,
    head: [summaryHeaders],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ===== STATUS BREAKDOWN =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Breakdown by Status', 15, yPosition);
  yPosition += 2;

  const statusHeaders: string[] = ['Status', 'Count', 'Hours'];
  if (visibility.showCosts) statusHeaders.push('Cost');
  statusHeaders.push('Billing');
  if (visibility.showMargins) statusHeaders.push('Margin');

  const statusData: (string | number)[][] = [];
  const statusKeys = ['approved', 'submitted', 'draft', 'rejected'] as const;
  const statusLabels = { approved: '✓ Approved', submitted: '⟳ Submitted', draft: '○ Draft', rejected: '✗ Rejected' };

  statusKeys.forEach(key => {
    if (key === 'draft' && !visibility.showDraftStatus) return;
    if (key === 'rejected' && !visibility.showRejectedStatus) return;

    const statusInfo = projectTracking.byStatus[key];
    const row: (string | number)[] = [
      statusLabels[key],
      statusInfo.count,
      statusInfo.hours.toFixed(1),
    ];
    if (visibility.showCosts) row.push(formatCurrency(statusInfo.cost, currency));
    row.push(formatCurrency(statusInfo.billing, currency));
    if (visibility.showMargins) row.push(formatCurrency(statusInfo.margin, currency));
    statusData.push(row);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [statusHeaders],
    body: statusData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ===== SUBCONTRACTOR BREAKDOWN =====
  // Check if we need a new page
  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Subcontractor Breakdown', 15, yPosition);
  yPosition += 2;

  projectTracking.subcontractors.forEach((sub, index) => {
    // Check if we need a new page before each subcontractor section
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    // Subcontractor header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sub.name, 15, yPosition);
    yPosition += 6;

    // Subcontractor summary
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let summary = `${sub.totalHours.toFixed(1)}h`;
    if (visibility.showCosts) summary += ` | Cost: ${formatCurrency(sub.totalCost, currency)}`;
    summary += ` | Bill: ${formatCurrency(sub.totalBilling, currency)}`;
    if (visibility.showMargins) summary += ` | Margin: ${sub.marginPct.toFixed(1)}%`;
    doc.text(summary, 15, yPosition);
    yPosition += 2;

    // Get line items for this subcontractor
    const subItems = filterLineItems(
      sub.timeLogs,
      sub.expenses,
      subcontractorsMap,
      visibility,
      [sub]
    );

    if (subItems.length === 0) {
      yPosition += 8;
      return;
    }

    // Build table headers
    const headers: string[] = ['Date', 'Type', 'Description', 'Time', 'Notes', 'Qty/Hours'];
    if (visibility.showCosts) headers.push('Cost');
    headers.push('Bill');
    if (visibility.showMargins) headers.push('Margin %');

    // Build table data
    const tableData = subItems.slice(0, 20).map(item => { // Limit to first 20 items per subcontractor
      const row: (string | number)[] = [
        item.date,
        item.type,
        item.description.length > 40 ? item.description.substring(0, 37) + '...' : item.description,
        item.time,
        (item.notes || '').length > 40 ? (item.notes || '').substring(0, 37) + '...' : (item.notes || ''),
        item.qtyHours,
      ];
      if (visibility.showCosts) row.push(formatCurrency(parseFloat(item.cost || '0'), currency));
      row.push(formatCurrency(parseFloat(item.bill), currency));
      if (visibility.showMargins) row.push(`${item.marginPct}%`);
      return row;
    });

    autoTable(doc, {
      startY: yPosition,
      head: [headers],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Add page numbers
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth - 20,
          pageHeight - 10
        );
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    if (subItems.length > 20) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Note: Showing first 20 of ${subItems.length} line items`, 15, yPosition);
      yPosition += 8;
    }
  });

  // Add footer to last page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${projectCode} - ${projectName}`,
    15,
    pageHeight - 10
  );

  // Save PDF
  doc.save(`${projectCode}_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

