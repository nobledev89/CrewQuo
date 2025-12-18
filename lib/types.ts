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
// RATE CARD MODEL - COMPREHENSIVE
// ============================================

export type ResourceCategory = 'Labour' | 'Vehicle' | 'Specialist Service' | 'Other';

export type ShiftType = 
  | 'Mon–Fri (1st 8 hours)'
  | 'Friday & Saturday nights'
  | 'Saturday & Mon–Thurs nights'
  | 'Sunday';

export interface RateEntry {
  // 1. Role / Resource Details
  roleName: string;              // e.g., Supervisor, Fitter, Driver, Porter, Vehicle
  category: ResourceCategory;    // Labour / Vehicle / Specialist Service / Other
  description?: string;          // Optional notes or description
  
  // 2. Shift Type
  shiftType: ShiftType;
  
  // 3. Time & Duration (for reference/calculation)
  startTime?: string;            // e.g., "09:00"
  endTime?: string;              // e.g., "17:00"
  totalHours?: number;           // Total hours worked
  
  // 4. Pricing Fields
  hourlyRate?: number | null;    // Rate per hour
  rate4Hours?: number | null;    // 4-hour rate
  rate8Hours?: number | null;    // 8-hour rate
  rate9Hours?: number | null;    // 9-hour rate
  rate10Hours?: number | null;   // 10-hour rate
  flatShiftRate?: number | null; // Flat shift rate (if applicable)
  
  // 5. Additional Charges
  congestionChargeApplicable: boolean;
  congestionChargeAmount?: number;    // Default £15
  additionalPerPersonCharge?: number;
  dropOffCharge?: number;
  vehicleIncluded: boolean;
  driverIncluded: boolean;
  
  // 6. Comments & Rules
  overtimeRules?: string;
  specialConditions?: string;
  invoicingNotes?: string;
}

export interface RateCard {
  id: string;
  name: string;                  // e.g., "Standard Labour Rates 2024"
  description: string;           // General description of the rate card
  effectiveFrom?: Timestamp;     // When these rates become effective
  effectiveTo?: Timestamp;       // When these rates expire (optional)
  rates: RateEntry[];            // Array of comprehensive rate entries
  companyId: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;             // userId
}

// Legacy types for backward compatibility
export type RateCardCategory = 'service' | 'expense' | 'equipment' | 'material';

// ============================================
// SUBCONTRACTOR RATE ASSIGNMENT MODEL
// ============================================

export interface SubcontractorRateAssignment {
  id: string;
  subcontractorId: string;
  rateCardId: string;
  clientId: string;
  projectId?: string;  // Optional: specific to a project
  companyId: string;
  assignedAt: Timestamp;
  assignedBy: string;  // userId
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
