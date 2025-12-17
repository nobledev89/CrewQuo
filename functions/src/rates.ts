import {Firestore, Timestamp} from 'firebase-admin/firestore';

export type TargetType = 'SUBCONTRACTOR' | 'CLIENT';
export type RateMode = 'HOURLY' | 'SHIFT' | 'DAILY';
export type RateLabel = 'Mon–Fri Day' | 'Fri & Sat Night' | 'Mon–Thurs Night' | 'Sunday' | 'Shift' | 'Daily';
export type ShiftType = 'WEEKDAY_DAY' | 'NIGHT' | 'SUNDAY' | 'SHIFT' | 'DAILY';

export interface RateCard {
  id: string;
  companyId: string;
  targetType: TargetType;
  targetId: string;
  roleId: string;
  rateMode: RateMode;
  rateLabel: RateLabel;
  hourlyRate?: number;
  otHourlyRate?: number;
  shiftRate?: number;
  dailyRate?: number;
  minHours?: number;
  weekendMultiplier?: number;
  nightMultiplier?: number;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  currency: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ResolvedRate {
  rateLabel: string;
  baseRate: number;
  otRate: number;
  currency: string;
  rateCardId: string;
}

export interface PriceCalculation {
  subRateLabel: string;
  clientRateLabel: string;
  subBaseRate: number;
  subOTRate: number;
  clientBillRate: number;
  clientOTBillRate: number;
  subCost: number;
  clientBill: number;
  marginValue: number;
  marginPct: number;
  currency: string;
}

/**
 * Maps ShiftType to RateLabel for rate card lookup
 */
export function shiftTypeToRateLabel(shiftType: ShiftType): RateLabel {
  const mapping: Record<ShiftType, RateLabel> = {
    WEEKDAY_DAY: 'Mon–Fri Day',
    NIGHT: 'Mon–Thurs Night',
    SUNDAY: 'Sunday',
    SHIFT: 'Shift',
    DAILY: 'Daily',
  };
  return mapping[shiftType];
}

/**
 * Rate Resolver: finds the best matching rate card for a given context
 */
export class RateResolver {
  constructor(private db: Firestore) {}

  /**
   * Resolve rate for a specific target (subcontractor or client)
   */
  async resolveRate(
    companyId: string,
    targetType: TargetType,
    targetId: string,
    roleId: string,
    shiftType: ShiftType,
    date: Date
  ): Promise<ResolvedRate | null> {
    const rateLabel = shiftTypeToRateLabel(shiftType);
    
    // Query rate cards matching criteria, ordered by effectiveFrom desc
    const snapshot = await this.db
      .collection('rateCards')
      .where('companyId', '==', companyId)
      .where('targetType', '==', targetType)
      .where('targetId', '==', targetId)
      .where('roleId', '==', roleId)
      .where('rateLabel', '==', rateLabel)
      .where('effectiveFrom', '<=', Timestamp.fromDate(date))
      .orderBy('effectiveFrom', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const dateTs = Timestamp.fromDate(date);

    // Find the most recent rate card where effectiveTo is null or >= date
    for (const doc of snapshot.docs) {
      const card = doc.data() as RateCard;
      if (!card.effectiveTo || card.effectiveTo >= dateTs) {
        return this.extractRate(card, doc.id);
      }
    }

    return null;
  }

  private extractRate(card: RateCard, cardId: string): ResolvedRate {
    let baseRate = 0;
    let otRate = 0;

    switch (card.rateMode) {
      case 'HOURLY':
        baseRate = card.hourlyRate || 0;
        otRate = card.otHourlyRate || baseRate * 1.5;
        break;
      case 'SHIFT':
        baseRate = card.shiftRate || 0;
        otRate = 0; // Shift rate doesn't have OT
        break;
      case 'DAILY':
        baseRate = card.dailyRate || 0;
        otRate = 0; // Daily rate doesn't have OT
        break;
    }

    return {
      rateLabel: card.rateLabel,
      baseRate,
      otRate,
      currency: card.currency,
      rateCardId: cardId,
    };
  }
}

/**
 * Price Calculator: computes costs and margins from resolved rates
 */
export class PriceCalculator {
  /**
   * Calculate pricing from resolved rates and hours
   */
  static calculate(
    subRate: ResolvedRate,
    clientRate: ResolvedRate,
    shiftType: ShiftType,
    hoursRegular: number,
    hoursOT: number
  ): PriceCalculation {
    let subCost = 0;
    let clientBill = 0;

    // For SHIFT and DAILY, treat as units not hours
    if (shiftType === 'SHIFT' || shiftType === 'DAILY') {
      // hoursRegular = 1 means 1 shift/day
      subCost = subRate.baseRate * hoursRegular;
      clientBill = clientRate.baseRate * hoursRegular;
    } else {
      // HOURLY calculation
      subCost = (subRate.baseRate * hoursRegular) + (subRate.otRate * hoursOT);
      clientBill = (clientRate.baseRate * hoursRegular) + (clientRate.otRate * hoursOT);
    }

    const marginValue = clientBill - subCost;
    const marginPct = clientBill > 0 ? (marginValue / clientBill) * 100 : 0;

    return {
      subRateLabel: subRate.rateLabel,
      clientRateLabel: clientRate.rateLabel,
      subBaseRate: subRate.baseRate,
      subOTRate: subRate.otRate,
      clientBillRate: clientRate.baseRate,
      clientOTBillRate: clientRate.otRate,
      subCost: Math.round(subCost * 100) / 100,
      clientBill: Math.round(clientBill * 100) / 100,
      marginValue: Math.round(marginValue * 100) / 100,
      marginPct: Math.round(marginPct * 100) / 100,
      currency: clientRate.currency,
    };
  }

  /**
   * Apply minimum hours if applicable (for hourly rates)
   */
  static applyMinHours(
    hoursRegular: number,
    hoursOT: number,
    minHours?: number
  ): { regular: number; ot: number } {
    if (!minHours) return { regular: hoursRegular, ot: hoursOT };

    const totalHours = hoursRegular + hoursOT;
    if (totalHours >= minHours) {
      return { regular: hoursRegular, ot: hoursOT };
    }

    // Add difference to regular hours
    const diff = minHours - totalHours;
    return { regular: hoursRegular + diff, ot: hoursOT };
  }
}
