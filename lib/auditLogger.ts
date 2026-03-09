import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import type { 
  AuditAction, 
  AuditEntityType, 
  AuditFieldChange,
  UserRole,
  TimeLog,
  Expense
} from './types';

/**
 * Field formatters for common data types
 */
const fieldFormatters: Record<string, (value: any) => string> = {
  // Time-related
  hoursRegular: (v) => v ? `${v}h` : '0h',
  hoursOT: (v) => v ? `${v}h` : '0h',
  quantity: (v) => v || 1,
  
  // Money
  subCost: (v) => `£${(v || 0).toFixed(2)}`,
  clientBill: (v) => `£${(v || 0).toFixed(2)}`,
  marginValue: (v) => `£${(v || 0).toFixed(2)}`,
  marginPct: (v) => `${(v || 0).toFixed(1)}%`,
  amount: (v) => `£${(v || 0).toFixed(2)}`,
  clientBillAmount: (v) => `£${(v || 0).toFixed(2)}`,
  marginPercentage: (v) => `${(v || 0).toFixed(1)}%`,
  unitSubCost: (v) => `£${(v || 0).toFixed(2)}/hr`,
  unitClientBill: (v) => `£${(v || 0).toFixed(2)}/hr`,
  unitRate: (v) => `£${(v || 0).toFixed(2)}`,
  subcontractorRate: (v) => `£${(v || 0).toFixed(2)}/hr`,
  clientRate: (v) => `£${(v || 0).toFixed(2)}/hr`,
  
  // Dates
  date: (v) => {
    if (!v) return 'N/A';
    const date = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  
  // Booleans
  active: (v) => v ? 'Active' : 'Inactive',
  isDefault: (v) => v ? 'Yes' : 'No',
  visibleToClient: (v) => v ? 'Yes' : 'No',
  
  // Status
  status: (v) => v || 'N/A',
};

/**
 * Field labels for display
 */
const fieldLabels: Record<string, string> = {
  hoursRegular: 'Regular Hours',
  hoursOT: 'Overtime Hours',
  quantity: 'Quantity',
  subCost: 'Subcontractor Cost',
  clientBill: 'Client Bill',
  marginValue: 'Margin',
  marginPct: 'Margin %',
  amount: 'Amount',
  clientBillAmount: 'Client Bill Amount',
  marginPercentage: 'Margin %',
  roleName: 'Role',
  timeframeName: 'Timeframe',
  shiftType: 'Shift Type',
  date: 'Date',
  notes: 'Notes',
  description: 'Description',
  category: 'Category',
  unitRate: 'Unit Rate',
  unitType: 'Unit Type',
  unitSubCost: 'Unit Sub Cost',
  unitClientBill: 'Unit Client Bill',
  payRateCardId: 'Pay Rate Card',
  billRateCardId: 'Bill Rate Card',
  status: 'Status',
  name: 'Name',
  active: 'Active',
  isDefault: 'Default',
  subcontractorRate: 'Subcontractor Rate',
  clientRate: 'Client Rate',
};

/**
 * Calculate field-level changes between old and new objects
 */
export function calculateFieldChanges(
  oldData: Record<string, any> | null,
  newData: Record<string, any>,
  trackedFields?: string[]
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  
  // If no old data, it's a creation - track all fields
  if (!oldData) {
    const fieldsToTrack = trackedFields || Object.keys(newData).filter(k => 
      !['id', 'createdAt', 'updatedAt', 'companyId', 'createdByUserId'].includes(k)
    );
    
    fieldsToTrack.forEach(field => {
      if (newData[field] !== undefined && newData[field] !== null && newData[field] !== '') {
        const formatter = fieldFormatters[field];
        changes.push({
          field: fieldLabels[field] || field,
          oldValue: null,
          newValue: newData[field],
          displayOld: 'N/A',
          displayNew: formatter ? formatter(newData[field]) : String(newData[field]),
        });
      }
    });
    
    return changes;
  }
  
  // Compare old and new data
  const fieldsToCheck = trackedFields || Object.keys(newData).filter(k => 
    !['id', 'createdAt', 'updatedAt', 'companyId', 'createdByUserId'].includes(k)
  );
  
  fieldsToCheck.forEach(field => {
    const oldVal = oldData[field];
    const newVal = newData[field];
    
    // Skip if values are the same
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      return;
    }
    
    // Skip if both are null/undefined/empty
    if ((oldVal === null || oldVal === undefined || oldVal === '') && 
        (newVal === null || newVal === undefined || newVal === '')) {
      return;
    }
    
    const formatter = fieldFormatters[field];
    changes.push({
      field: fieldLabels[field] || field,
      oldValue: oldVal,
      newValue: newVal,
      displayOld: formatter ? formatter(oldVal) : String(oldVal || 'N/A'),
      displayNew: formatter ? formatter(newVal) : String(newVal || 'N/A'),
    });
  });
  
  return changes;
}

/**
 * Generate human-readable description of the action
 */
function generateDescription(
  action: AuditAction,
  entityType: AuditEntityType,
  entityName: string | undefined,
  changes: AuditFieldChange[]
): string {
  const entityLabel = entityType.toLowerCase().replace('_', ' ');
  const name = entityName || 'item';
  
  switch (action) {
    case 'CREATE':
      return `Created ${entityLabel} "${name}"`;
    case 'DELETE':
      return `Deleted ${entityLabel} "${name}"`;
    case 'UPDATE':
      if (changes.length === 0) {
        return `Updated ${entityLabel} "${name}"`;
      }
      if (changes.length === 1) {
        return `Updated ${changes[0].field} for ${entityLabel} "${name}"`;
      }
      return `Updated ${changes.length} fields for ${entityLabel} "${name}"`;
    case 'APPROVE':
      return `Approved ${entityLabel} "${name}"`;
    case 'REJECT':
      return `Rejected ${entityLabel} "${name}"`;
    case 'SUBMIT':
      return `Submitted ${entityLabel} "${name}"`;
    case 'SYNC':
      return `Synchronized ${entityLabel} "${name}"`;
    default:
      return `Modified ${entityLabel} "${name}"`;
  }
}

/**
 * Main audit logging interface
 */
export interface AuditLogParams {
  companyId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  
  userId: string;
  userName: string;
  userRole: UserRole;
  
  // Context
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  subcontractorId?: string;
  subcontractorName?: string;
  
  // Changes
  oldData?: Record<string, any> | null;
  newData?: Record<string, any>;
  trackedFields?: string[];
  customChanges?: AuditFieldChange[];
  customDescription?: string;
  
  // Client visibility
  visibleToClient?: boolean;
}

/**
 * Log an audit entry (async - non-blocking)
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    // Calculate changes
    const changes = params.customChanges || 
      (params.oldData !== undefined ? 
        calculateFieldChanges(params.oldData, params.newData || {}, params.trackedFields) : 
        []);
    
    // Generate description
    const description = params.customDescription || 
      generateDescription(params.action, params.entityType, params.entityName, changes);
    
    // Calculate expiry (90 days from now)
    const now = Timestamp.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    const expiresAt = Timestamp.fromDate(expiryDate);
    
    // Create audit log entry
    const auditLog = {
      companyId: params.companyId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName || null,
      
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      
      projectId: params.projectId || null,
      projectName: params.projectName || null,
      clientId: params.clientId || null,
      clientName: params.clientName || null,
      subcontractorId: params.subcontractorId || null,
      subcontractorName: params.subcontractorName || null,
      
      changes,
      description,
      
      timestamp: now,
      expiresAt,
      
      visibleToClient: params.visibleToClient || false,
    };
    
    // Write to Firestore (async)
    await addDoc(collection(db, 'auditLogs'), auditLog);
  } catch (error) {
    console.error('Error logging audit entry:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Helper: Log time log creation
 */
export async function logTimeLogCreate(
  timeLog: TimeLog,
  userId: string,
  userName: string,
  userRole: UserRole,
  contextData: {
    projectName?: string;
    clientName?: string;
    subcontractorName?: string;
  }
): Promise<void> {
  const entityName = `${timeLog.roleName} - ${contextData.subcontractorName || 'Unknown'}`;
  
  await logAudit({
    companyId: timeLog.companyId,
    action: 'CREATE',
    entityType: 'TIME_LOG',
    entityId: timeLog.id,
    entityName,
    
    userId,
    userName,
    userRole,
    
    projectId: timeLog.projectId,
    projectName: contextData.projectName,
    clientId: timeLog.clientId,
    clientName: contextData.clientName,
    subcontractorId: timeLog.subcontractorId,
    subcontractorName: contextData.subcontractorName,
    
    newData: timeLog as any,
    trackedFields: ['date', 'roleName', 'timeframeName', 'shiftType', 'hoursRegular', 'hoursOT', 
                    'quantity', 'subCost', 'clientBill', 'notes', 'status'],
    
    visibleToClient: false,
  });
}

/**
 * Helper: Log time log update
 */
export async function logTimeLogUpdate(
  oldTimeLog: TimeLog,
  newTimeLog: TimeLog,
  userId: string,
  userName: string,
  userRole: UserRole,
  contextData: {
    projectName?: string;
    clientName?: string;
    subcontractorName?: string;
  }
): Promise<void> {
  const entityName = `${newTimeLog.roleName} - ${contextData.subcontractorName || 'Unknown'}`;
  
  await logAudit({
    companyId: newTimeLog.companyId,
    action: 'UPDATE',
    entityType: 'TIME_LOG',
    entityId: newTimeLog.id,
    entityName,
    
    userId,
    userName,
    userRole,
    
    projectId: newTimeLog.projectId,
    projectName: contextData.projectName,
    clientId: newTimeLog.clientId,
    clientName: contextData.clientName,
    subcontractorId: newTimeLog.subcontractorId,
    subcontractorName: contextData.subcontractorName,
    
    oldData: oldTimeLog as any,
    newData: newTimeLog as any,
    trackedFields: ['date', 'roleName', 'timeframeName', 'shiftType', 'hoursRegular', 'hoursOT', 
                    'quantity', 'subCost', 'clientBill', 'notes', 'status'],
    
    visibleToClient: false,
  });
}

/**
 * Helper: Log time log deletion
 */
export async function logTimeLogDelete(
  timeLog: TimeLog,
  userId: string,
  userName: string,
  userRole: UserRole,
  contextData: {
    projectName?: string;
    clientName?: string;
    subcontractorName?: string;
  }
): Promise<void> {
  const entityName = `${timeLog.roleName} - ${contextData.subcontractorName || 'Unknown'}`;
  
  await logAudit({
    companyId: timeLog.companyId,
    action: 'DELETE',
    entityType: 'TIME_LOG',
    entityId: timeLog.id,
    entityName,
    
    userId,
    userName,
    userRole,
    
    projectId: timeLog.projectId,
    projectName: contextData.projectName,
    clientId: timeLog.clientId,
    clientName: contextData.clientName,
    subcontractorId: timeLog.subcontractorId,
    subcontractorName: contextData.subcontractorName,
    
    customChanges: [],
    customDescription: `Deleted time log: ${entityName} (${fieldFormatters.date(timeLog.date)})`,
    
    visibleToClient: false,
  });
}

/**
 * Helper: Log timesheet approval
 */
export async function logTimesheetApproval(
  timesheetId: string,
  projectId: string,
  projectName: string,
  subcontractorId: string,
  subcontractorName: string,
  companyId: string,
  userId: string,
  userName: string,
  userRole: UserRole,
  timeLogIds: string[],
  expenseIds: string[]
): Promise<void> {
  await logAudit({
    companyId,
    action: 'APPROVE',
    entityType: 'TIMESHEET',
    entityId: timesheetId,
    entityName: `${subcontractorName} - ${projectName}`,
    
    userId,
    userName,
    userRole,
    
    projectId,
    projectName,
    subcontractorId,
    subcontractorName,
    
    customChanges: [
      {
        field: 'Status',
        oldValue: 'SUBMITTED',
        newValue: 'APPROVED',
        displayOld: 'Submitted',
        displayNew: 'Approved',
      },
      {
        field: 'Time Logs',
        oldValue: timeLogIds.length,
        newValue: timeLogIds.length,
        displayOld: `${timeLogIds.length} entries`,
        displayNew: `${timeLogIds.length} entries`,
      },
      {
        field: 'Expenses',
        oldValue: expenseIds.length,
        newValue: expenseIds.length,
        displayOld: `${expenseIds.length} entries`,
        displayNew: `${expenseIds.length} entries`,
      },
    ],
    
    visibleToClient: false,
  });
}

/**
 * Helper: Log timesheet rejection
 */
export async function logTimesheetRejection(
  timesheetId: string,
  projectId: string,
  projectName: string,
  subcontractorId: string,
  subcontractorName: string,
  companyId: string,
  userId: string,
  userName: string,
  userRole: UserRole,
  rejectionReason: string
): Promise<void> {
  await logAudit({
    companyId,
    action: 'REJECT',
    entityType: 'TIMESHEET',
    entityId: timesheetId,
    entityName: `${subcontractorName} - ${projectName}`,
    
    userId,
    userName,
    userRole,
    
    projectId,
    projectName,
    subcontractorId,
    subcontractorName,
    
    customChanges: [
      {
        field: 'Status',
        oldValue: 'SUBMITTED',
        newValue: 'REJECTED',
        displayOld: 'Submitted',
        displayNew: 'Rejected',
      },
      {
        field: 'Rejection Reason',
        oldValue: null,
        newValue: rejectionReason,
        displayOld: 'N/A',
        displayNew: rejectionReason,
      },
    ],
    
    visibleToClient: false,
  });
}
