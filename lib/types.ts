import { Timestamp } from 'firebase/firestore';

// ============================================
// CORE TYPES
// ============================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR' | 'CLIENT';

export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export type SubscriptionStatus = 'active' | 'trial' | 'inactive';

export type SubcontractorType = 'invited' | 'manual';

export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

// ============================================
// USER MODEL
// ============================================

export interface SubcontractorRole {
  subcontractorId: string;
  status: 'active' | 'inactive';
  joinedAt: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  
  // Company relationships (for contractors/admins/managers)
  ownCompanyId?: string;      // Their primary company (not set for CLIENT role)
  activeCompanyId?: string;   // Currently viewing company (not set for CLIENT role)
  companyId?: string;         // Legacy field (= ownCompanyId)
  
  // Role in their OWN company (or CLIENT for client portal users)
  role: UserRole;
  
  // Client organization (for CLIENT role only)
  clientOrgId?: string;       // Which client organization they belong to
  clientOrgName?: string;     // Denormalized
  contractorCompanyIds?: string[];  // Contractors they have access to (CLIENT role only)
  
  // Subcontractor relationships with OTHER companies
  subcontractorRoles?: {
    [companyId: string]: SubcontractorRole;
  };
  
  // Subscription (applies to own company only - not for CLIENT role)
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// COMPANY MODEL
// ============================================

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Timestamp;
  currency?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// SUBCONTRACTOR MODEL
// ============================================

export interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  companyId: string;
  
  // Type: invited (has account) or manual (tracking only)
  type: SubcontractorType;
  
  // For invited subcontractors
  userId?: string;
  inviteStatus?: InviteStatus | 'none';
  inviteToken?: string;
  inviteSentAt?: Timestamp;
  inviteAcceptedAt?: Timestamp;
  
  // For manual subcontractors
  companyName?: string;
  companyAddress?: string;
  taxId?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// INVITE MODEL
// ============================================

export interface Invite {
  id: string;
  email: string;
  invitingCompanyId: string;
  invitingCompanyName: string;
  subcontractorId: string;
  status: InviteStatus;
  inviteToken: string;
  sentAt: Timestamp;
  respondedAt?: Timestamp;
  expiresAt?: Timestamp;
}

// ============================================
// CLIENT MODEL (Contractor's client records)
// ============================================

export interface Client {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
  companyId: string;
  
  // Link to global client organization (optional - for multi-contractor support)
  clientOrgId?: string;
  clientOrgName?: string;  // Denormalized
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// CLIENT ORGANIZATION MODEL (Global - shared across contractors)
// ============================================

export interface ClientOrganization {
  id: string;
  name: string;                // "ABC Corporation"
  domain?: string;             // "abccorp.com" (for auto-matching invites)
  taxId?: string;
  address?: string;
  notes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;           // First contractor userId who created it
}

// ============================================
// CLIENT USER MODEL (Portal users for client companies)
// ============================================

export type ClientUserRole = 'VIEWER' | 'ADMIN';

export interface ClientUser {
  id: string;
  userId: string;              // Links to users collection
  clientOrgId: string;         // Links to clientOrganizations
  clientOrgName?: string;      // Denormalized
  email: string;
  firstName: string;
  lastName: string;
  role: ClientUserRole;        // Within their organization
  active: boolean;
  
  // Track which contractors they have access to (denormalized for quick lookup)
  contractorCompanyIds: string[];  // ["contractor-a-id", "contractor-b-id"]
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// CONTRACTOR-CLIENT RELATIONSHIP MODEL
// ============================================

export interface ContractorClientRelationship {
  id: string;  // e.g., "contractorA_clientOrgABC"
  contractorCompanyId: string;   // Main contractor's company
  contractorCompanyName: string; // Denormalized for display
  clientOrgId: string;           // Client organization
  clientOrgName: string;         // Denormalized
  
  // Default settings for this contractor-client relationship
  defaultShowCosts: boolean;
  defaultShowMargins: boolean;
  defaultShowSubcontractorRates: boolean;
  allowClientNotes: boolean;
  showDraftStatus: boolean;
  showRejectedStatus: boolean;
  
  // Which contractor's client record this maps to
  contractorClientId: string;    // Links to existing 'clients' collection
  
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;             // Contractor user who created relationship
  updatedAt: Timestamp;
}

// ============================================
// CLIENT USER INVITE MODEL
// ============================================

export interface ClientUserInvite {
  id: string;
  email: string;
  contractorCompanyId: string;
  contractorCompanyName: string;
  clientOrgId: string;
  clientOrgName: string;
  
  invitedBy: string;             // Contractor userId
  inviteToken: string;
  status: InviteStatus;
  
  sentAt: Timestamp;
  acceptedAt?: Timestamp;
  expiresAt: Timestamp;
}

// ============================================
// CLIENT PROJECT ACCESS MODEL
// ============================================

export interface ClientProjectAccess {
  id: string;
  contractorCompanyId: string;   // Which contractor owns the project
  clientOrgId: string;           // Which client org has access
  projectId: string;
  projectName?: string;          // Denormalized
  
  grantedBy: string;             // Contractor userId
  grantedAt: Timestamp;
  
  // Per-project visibility overrides (optional, falls back to relationship defaults)
  overrideShowCosts?: boolean;
  overrideShowMargins?: boolean;
  overrideShowSubcontractorRates?: boolean;
  
  // Collaboration settings (per-project)
  allowSubcontractorNotes?: boolean;  // Let subcontractors join conversations on this project
  
  active: boolean;
}

// ============================================
// LINE ITEM NOTE MODEL (Client collaboration)
// ============================================

export type NoteCreatorRole = 'CLIENT' | 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';

export interface LineItemNote {
  id: string;
  itemId: string;              // timeLog or expense ID
  itemType: 'timeLog' | 'expense';
  projectId: string;
  clientOrgId: string;         // Which client org (not contractor's clientId)
  contractorCompanyId: string;
  
  // Who added the note
  createdBy: string;           // userId
  createdByRole: NoteCreatorRole;
  createdByName: string;
  
  note: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// PROJECT MODEL
// ============================================

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: ProjectStatus;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  notes: string;
  clientId: string;
  clientName?: string; // Denormalized for display
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// PROJECT ASSIGNMENT MODEL
// ============================================

export interface ProjectAssignment {
  id: string;
  projectId: string;
  companyId: string;
  userId: string;
  subcontractorId: string;
  assignedAt: Timestamp;
  assignedBy: string; // userId who made the assignment
}

// ============================================
// SUBSCRIPTION LIMITS
// ============================================

export interface PlanLimits {
  clients: number;        // -1 = unlimited
  subcontractors: number; // -1 = unlimited
  projects: number;       // -1 = unlimited
  canInviteSubcontractors: boolean;
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    clients: 1,
    subcontractors: 1,
    projects: 5,
    canInviteSubcontractors: false,
  },
  starter: {
    clients: 10,
    subcontractors: 5,
    projects: 50,
    canInviteSubcontractors: true,
  },
  professional: {
    clients: -1,
    subcontractors: 25,
    projects: -1,
    canInviteSubcontractors: true,
  },
  enterprise: {
    clients: -1,
    subcontractors: -1,
    projects: -1,
    canInviteSubcontractors: true,
  },
};

// ============================================
// RATE CARD TEMPLATE MODEL (TIER 1)
// ============================================

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TimeframeDefinition {
  id: string;
  name: string;                    // e.g., "Day Rate Mon-Fri", "Night Rate", "Weekend"
  description?: string;
  startTime: string;               // e.g., "08:00" (24-hour format)
  endTime: string;                 // e.g., "17:00" (24-hour format)
  applicableDays: DayOfWeek[];    // e.g., ['monday', 'tuesday', 'wednesday']
}

export type ExpenseRateType = 'CAPPED' | 'FIXED';

export interface ExpenseCategory {
  id: string;
  name: string;                    // e.g., "Accommodation", "Mileage", "Parking Fees"
  description?: string;
  unitType: 'flat' | 'per_unit' | 'per_mile' | 'per_day' | 'per_hour';
  defaultRate?: number;
  rateType?: ExpenseRateType;      // CAPPED = max rate per unit, FIXED = exact rate per unit (default: CAPPED for backward compatibility)
  taxable?: boolean;
}

export interface RateCardTemplate {
  id: string;
  name: string;                    // e.g., "Standard UK Construction Rates"
  description: string;
  
  // Timeframe definitions (replaces shift types)
  timeframeDefinitions: TimeframeDefinition[];
  
  // Legacy field for backward compatibility
  shiftTypes?: TimeframeDefinition[]; // Old data may still have this
  
  // Custom expense categories
  expenseCategories: ExpenseCategory[];
  
  // Base resource categories (can be customized)
  resourceCategories: string[];    // e.g., ['Labour', 'Vehicle', 'Equipment', 'Specialist Service']
  
  companyId: string;
  isDefault: boolean;              // One default template per company
  active: boolean;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================
// RATE CARD MODEL (TIER 2) - COMPREHENSIVE
// ============================================

export type ResourceCategory = string; // Now dynamic based on template

export type ShiftType = string; // Now dynamic based on template

export interface RateEntry {
  // 1. Role / Resource Details
  roleName: string;              // e.g., Supervisor, Fitter, Driver, Porter, Vehicle
  category: ResourceCategory;    // Dynamic from template
  description?: string;          // Optional notes or description
  
  // 2. Timeframe Reference (NEW - simplified)
  timeframeId: string;           // References TimeframeDefinition from template
  timeframeName?: string;        // Denormalized for display
  
  // 3. Pricing Fields (SIMPLIFIED)
  subcontractorRate: number;     // What you pay the subcontractor (hourly)
  clientRate: number;            // What you charge the client (hourly)
  marginValue?: number;          // Auto-calculated: clientRate - subcontractorRate
  marginPercentage?: number;     // Auto-calculated: (marginValue / clientRate) * 100
  
  // 4. Additional Charges
  congestionChargeApplicable: boolean;
  congestionChargeAmount?: number;    // Default £15
  additionalPerPersonCharge?: number;
  dropOffCharge?: number;
  vehicleIncluded: boolean;
  driverIncluded: boolean;
  
  // 5. Comments & Rules
  overtimeRules?: string;
  specialConditions?: string;
  invoicingNotes?: string;
  
  // ===== LEGACY FIELDS (for backward compatibility) =====
  shiftType?: string;            // Old field
  shiftTypeId?: string;          // Old field
  rateMultiplier?: number;       // Old field
  startTime?: string;            // Old field
  endTime?: string;              // Old field
  totalHours?: number;           // Old field
  timeBasedRates?: TimeBasedRate[];  // Old field
  baseRate?: number;             // Old field
  hourlyRate?: number | null;    // Old field
  rate4Hours?: number | null;    // Old field
  rate8Hours?: number | null;    // Old field
  rate9Hours?: number | null;    // Old field
  rate10Hours?: number | null;   // Old field
  rate12Hours?: number | null;   // Old field
  flatShiftRate?: number | null; // Old field
}

// ============================================
// TIME-BASED RATE MODEL (LEGACY)
// ============================================

export interface TimeBasedRate {
  id: string;                    // Unique identifier for this time range
  startTime: string;             // e.g., "08:00" (24-hour format)
  endTime: string;               // e.g., "17:00" (24-hour format)
  subcontractorRate: number;     // Hourly rate for subcontractor during this time range
  clientRate: number;            // Hourly rate for client during this time range
  description?: string;          // e.g., "Day rate", "Evening rate", "Night rate"
  applicableDays?: DayOfWeek[];  // Days this rate applies to (empty = all days)
}

export interface ExpenseEntry {
  id: string;
  categoryId: string;            // References template expense category
  categoryName: string;          // Denormalized for display
  description?: string;
  unitType: 'flat' | 'per_unit' | 'per_mile' | 'per_day' | 'per_hour';
  
  // Pricing fields
  rate: number;                  // Legacy field (= subcontractorRate for backward compatibility)
  subcontractorRate?: number;    // What you pay the subcontractor (per unit)
  clientRate?: number;           // What you charge the client (per unit)
  marginValue?: number;          // Auto-calculated: clientRate - subcontractorRate
  marginPercentage?: number;     // Auto-calculated: (marginValue / clientRate) * 100
  
  rateType: ExpenseRateType;     // CAPPED = max rate per unit, FIXED = exact rate per unit
  taxable: boolean;
  notes?: string;
}

export interface RateCard {
  id: string;
  name: string;                  // e.g., "Standard Labour Rates 2024"
  description: string;           // General description of the rate card
  // Card type: PAY = subcontractor pay rates, BILL = client billing rates
  cardType?: 'PAY' | 'BILL';
  
  // Reference to template used (optional - for new system)
  templateId?: string;
  templateName?: string;         // Denormalized
  
  effectiveFrom?: Timestamp;     // When these rates become effective
  effectiveTo?: Timestamp;       // When these rates expire (optional)
  
  // Rate entries for labour/resources
  rates: RateEntry[];
  
  // Expense entries
  expenses?: ExpenseEntry[];
  
  companyId: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;             // userId
}

// Legacy types for backward compatibility
export type RateCardCategory = 'service' | 'expense' | 'equipment' | 'material';

// ============================================
// SUBCONTRACTOR RATE ASSIGNMENT MODEL (TIER 3)
// ============================================

export interface SubcontractorRateAssignment {
  id: string;
  subcontractorId: string;
  subcontractorName?: string;    // Denormalized
  // Pay and bill cards are now stored separately; rateCardId kept for backward compatibility
  payRateCardId?: string;
  payRateCardName?: string;      // Denormalized
  billRateCardId?: string;
  billRateCardName?: string;
  rateCardId?: string;
  rateCardName?: string;         // Legacy denormalized
  clientId: string;
  clientName?: string;           // Denormalized
  projectId?: string;            // Optional: specific to a project
  projectName?: string;          // Denormalized
  companyId: string;
  assignedAt: Timestamp;
  assignedBy: string;            // userId
  notes?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface CompanyContext {
  companyId: string;
  companyName: string;
  role: UserRole;
  isOwnCompany: boolean;
}

// ============================================
// TIME LOG MODEL
// ============================================

export interface TimeLog {
  id: string;
  companyId: string;
  projectId: string;
  clientId: string;
  subcontractorId: string;
  createdByUserId: string;

  // Work details
  date: Timestamp;
  roleName: string;

  // Timeframe reference (NEW - preferred)
  timeframeId?: string;      // References TimeframeDefinition from template
  timeframeName?: string;    // Denormalized for display

  // Legacy field (for backward compatibility)
  shiftType?: string;        // Old field - still supported for existing logs

  hoursRegular: number;
  hoursOT?: number;

  // Quantity support (NEW)
  quantity: number;        // Number of people (default: 1)

  // Financial details
  subCost: number;         // What we pay the subcontractor (total: quantity × hoursRegular × unitSubCost + quantity × hoursOT × unitSubCost)
  clientBill?: number;     // What we bill the client (optional)
  marginValue?: number;    // clientBill - subCost
  marginPct?: number;      // (marginValue / clientBill) * 100

  // Unit rates (NEW) - for reference/calculation
  unitSubCost?: number;    // Per person hourly cost (before multiplying by quantity & hours)
  unitClientBill?: number; // Per person hourly billing (before multiplying by quantity & hours)

  // Rate card references - tracks which cards were used for calculation
  payRateCardId: string;   // Card used to calculate subCost (what we pay subcontractor)
  billRateCardId?: string; // Card used to calculate clientBill (what we charge client)

  // Additional details
  notes?: string;          // Optional notes/description for this time entry
  splitGroupId?: string;   // Groups split segments from one logged entry
  splitIndex?: number;     // 1-based index within the split group
  splitTotal?: number;     // Total segments in the split group

  // Metadata
  currency: string;        // e.g., 'GBP'
  status?: string;         // e.g., 'DRAFT', 'SUBMITTED', 'APPROVED'

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// EXPENSE MODEL
// ============================================

export interface Expense {
  id: string;
  companyId: string;
  projectId: string;
  clientId?: string;
  subcontractorId: string;
  createdByUserId: string;
  
  // Expense details
  date: Timestamp;
  category: string;        // Expense category label
  amount: number;          // What we pay the subcontractor (cost)
  description?: string;    // Optional notes/description (e.g., hotel name, details, etc.)
  
  // Quantity support (NEW) - allows flexible expense logging
  quantity: number;        // Number of units (miles, nights, rooms, etc.) - default: 1
  unitRate?: number;       // Rate per unit from rate card (e.g., £0.45 per mile, £50 per night)
  unitType?: string;       // Unit type from rate card (per_mile, per_day, per_unit, per_hour, flat)
  
  // Billing & Margin (NEW) - support for expense markups
  clientBillAmount?: number;    // What we charge the client
  marginValue?: number;         // clientBillAmount - amount
  marginPercentage?: number;    // (marginValue / clientBillAmount) * 100
  
  // Rate card references
  payRateCardId: string;
  billRateCardId?: string;
  
  // Metadata
  currency: string;        // e.g., 'GBP'
  status?: string;         // e.g., 'DRAFT', 'SUBMITTED', 'APPROVED'
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// PROJECT SUBMISSION MODEL
// ============================================

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

// Line item rejection note (for individual time logs/expenses within a timesheet)
export interface LineItemRejectionNote {
  itemId: string;          // timeLog or expense ID
  itemType: 'timeLog' | 'expense';
  note: string;            // Admin's reason for rejection
  addedAt: Timestamp;
}

export interface ProjectSubmission {
  id: string;
  companyId: string;
  projectId: string;
  subcontractorId: string;
  createdByUserId: string;
  
  // Submission details
  timeLogIds: string[];    // Array of timeLog document IDs
  expenseIds: string[];    // Array of expense document IDs
  
  // Submission metadata
  status: SubmissionStatus;
  submittedAt?: Timestamp; // When submitted for approval
  approvedAt?: Timestamp;  // When approved
  approvedBy?: string;     // userId who approved
  rejectionReason?: string; // If rejected (whole timesheet)
  lineItemRejectionNotes?: LineItemRejectionNote[]; // Per-line rejection notes
  
  // Summary totals (denormalized for quick access)
  totalHours: number;
  totalCost: number;
  totalExpenses: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// AUDIT LOG MODEL
// ============================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'SYNC';
export type AuditEntityType = 'TIME_LOG' | 'EXPENSE' | 'TIMESHEET' | 'RATE_TEMPLATE' | 'RATE_CARD' | 'RATE_ASSIGNMENT';

export interface AuditFieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  displayOld?: string; // Formatted for display
  displayNew?: string; // Formatted for display
}

export interface AuditLog {
  id: string;
  companyId: string;
  
  // What happened
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  
  // Who did it
  userId: string;
  userName: string;
  userRole: UserRole;
  
  // Context (for time logs/expenses)
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  subcontractorId?: string;
  subcontractorName?: string;
  
  // Field-level changes
  changes: AuditFieldChange[];
  
  description: string; // Human-readable summary
  
  // Timestamps
  timestamp: Timestamp;
  expiresAt: Timestamp; // Auto-delete after 90 days
  
  // Client visibility control
  visibleToClient: boolean; // Default: false
}

// ============================================
// CLIENT AUDIT SETTINGS MODEL
// ============================================

export interface ClientAuditSettings {
  id: string;
  clientOrgId: string;
  contractorCompanyId: string;
  
  // Audit log visibility (master toggle)
  showAuditLogs: boolean;
  
  // What types of changes they can see
  showTimeLogChanges: boolean;
  showExpenseChanges: boolean;
  showTimesheetActions: boolean;
  
  // What details they can see
  showUserNames: boolean;     // Show who made changes
  showOldValues: boolean;     // Show before/after comparison
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// CUSTOM CLAIMS
// ============================================

export interface CustomClaims {
  ownCompanyId?: string;       // Not set for CLIENT role
  activeCompanyId?: string;    // Not set for CLIENT role
  role: UserRole;
  isSuperAdmin?: boolean;
  
  // For CLIENT role
  clientOrgId?: string;        // Which client organization
  contractorCompanyIds?: string[];  // Contractors they can access
  
  // For SUBCONTRACTOR role
  subcontractorRoles?: {
    [companyId: string]: {
      subcontractorId: string;
      status: string;
    };
  };
}

// ============================================
// PRICING CONFIGURATION (SUPER ADMIN)
// ============================================

export interface PlanPricing {
  price: number;
  name: string;
  description?: string;
  features?: string[];
}

export interface PricingConfig {
  plans: {
    free: PlanPricing;
    starter: PlanPricing;
    professional: PlanPricing;
    enterprise: PlanPricing;
  };
  trialDurationDays: number;
  currency: string;
  updatedAt: Timestamp;
  updatedBy: string; // Super admin user ID
}

// ============================================
// SUPER ADMIN TYPES
// ============================================

export interface UserWithCompany extends User {
  companyName?: string;
  trialDaysRemaining?: number;
}

export interface CompanyWithStats extends Company {
  ownerEmail?: string;
  userCount?: number;
  projectCount?: number;
  clientCount?: number;
  subcontractorCount?: number;
  trialDaysRemaining?: number;
}

export interface SystemStats {
  totalUsers: number;
  totalCompanies: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  inactiveSubscriptions: number;
  monthlyRecurringRevenue: number;
  subscriptionsByPlan: {
    free: number;
    starter: number;
    professional: number;
    enterprise: number;
  };
}
