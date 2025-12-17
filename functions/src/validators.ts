import {z} from 'zod';

// Enums
export const ShiftTypeEnum = z.enum(['WEEKDAY_DAY', 'NIGHT', 'SUNDAY', 'SHIFT', 'DAILY']);
export const StatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
export const ExpenseCategoryEnum = z.enum(['PARKING', 'ACCOMMODATION', 'PARTS', 'TRAVEL', 'OTHER']);

// Time Log Schemas
export const CreateTimeLogSchema = z.object({
  projectId: z.string(),
  subcontractorId: z.string(),
  roleId: z.string(),
  date: z.string(), // ISO date string
  shiftType: ShiftTypeEnum,
  hoursRegular: z.number().min(0).max(24),
  hoursOT: z.number().min(0).max(24).default(0),
  notes: z.string().optional(),
  expenses: z.array(z.object({
    category: ExpenseCategoryEnum,
    description: z.string(),
    amount: z.number().min(0),
    date: z.string(), // ISO date string
  })).optional(),
});

export const UpdateTimeLogSchema = z.object({
  timeLogId: z.string(),
  roleId: z.string().optional(),
  date: z.string().optional(),
  shiftType: ShiftTypeEnum.optional(),
  hoursRegular: z.number().min(0).max(24).optional(),
  hoursOT: z.number().min(0).max(24).optional(),
  notes: z.string().optional(),
});

export const TimeLogStatusSchema = z.object({
  timeLogId: z.string(),
  notes: z.string().optional(),
});

// Expense Schemas
export const CreateExpenseSchema = z.object({
  projectId: z.string(),
  timeLogId: z.string().optional(),
  date: z.string(),
  category: ExpenseCategoryEnum,
  description: z.string(),
  amount: z.number().min(0),
});

export const UpdateExpenseSchema = z.object({
  expenseId: z.string(),
  date: z.string().optional(),
  category: ExpenseCategoryEnum.optional(),
  description: z.string().optional(),
  amount: z.number().min(0).optional(),
});

export const ExpenseStatusSchema = z.object({
  expenseId: z.string(),
  notes: z.string().optional(),
});

// Invite User Schema
export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['ADMIN', 'MANAGER', 'SUBCONTRACTOR']),
  subcontractorId: z.string().optional(),
});

// Project Summary Schema
export const ProjectSummarySchema = z.object({
  projectId: z.string(),
  includeSubmitted: z.boolean().default(false),
});

// Type exports
export type CreateTimeLogInput = z.infer<typeof CreateTimeLogSchema>;
export type UpdateTimeLogInput = z.infer<typeof UpdateTimeLogSchema>;
export type TimeLogStatusInput = z.infer<typeof TimeLogStatusSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type ExpenseStatusInput = z.infer<typeof ExpenseStatusSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type ProjectSummaryInput = z.infer<typeof ProjectSummarySchema>;
