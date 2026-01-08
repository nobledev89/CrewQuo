import { Timestamp } from 'firebase/firestore';

// ============================================
// CORE TYPES
// ============================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'SUBCONTRACTOR';

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
  
  // Company relationships
  ownCompanyId: string;      // Their primary company
  activeCompanyId: string;   // Currently viewing company
  companyId: string;         // Legacy field (= ownCompanyId)
  
  // Role in their OWN company
  role: UserRole;
  
  // Subcontractor relationships with OTHER companies
  subcontractorRoles: {
    [companyId: string]: SubcontractorRole;
  };
  
  // Subscription (applies to own company only)
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  
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
// CLIENT MODEL
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

export interface ExpenseCategory {
  id: string;
  name: string;                    // e.g., "Accommodation", "Mileage", "Parking Fees"
  description?: string;
  unitType: 'flat' | 'per_unit' | 'per_mile' | 'per_day' | 'per_hour';
  defaultRate?: number;
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
  rate: number;
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
  amount: number;
  
  // Quantity support (NEW) - allows flexible expense logging
  quantity: number;        // Number of units (miles, nights, rooms, etc.) - default: 1
  unitRate?: number;       // Rate per unit from rate card (e.g., £0.45 per mile, £50 per night)
  unitType?: string;       // Unit type from rate card (per_mile, per_day, per_unit, per_hour, flat)
  
  // Rate card references
  payRateCardId: string;
  billRateCardId?: string;
  
  // Metadata
  currency: string;        // e.g., 'GBP'
  
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
// CUSTOM CLAIMS
// ============================================

export interface CustomClaims {
  ownCompanyId: string;
  activeCompanyId: string;
  role: UserRole;
  subcontractorRoles?: {
    [companyId: string]: {
      subcontractorId: string;
      status: string;
    };
  };
}
