'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, DollarSign, TrendingUp, FileText, MessageSquare } from 'lucide-react';
import {
  SubcontractorTracking,
  formatCurrency,
  formatDate,
  getStatusColor,
} from '@/lib/projectTrackingUtils';

interface SubcontractorCostBreakdownProps {
  subcontractor: SubcontractorTracking;
  currency?: string;
  showLineItems?: boolean;
  unresolvedNotesMap?: Map<string, number>;
  onOpenConversation?: (itemId: string, itemType: 'timeLog' | 'expense', description: string) => void;
}

export default function SubcontractorCostBreakdown({
  subcontractor,
  currency = 'GBP',
  showLineItems = true,
  unresolvedNotesMap,
  onOpenConversation,
}: SubcontractorCostBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const showConversations = unresolvedNotesMap && onOpenConversation;
  const normalizeTimeframeName = (value?: string): string | undefined => {
    if (!value) return value;
    return value.replace(/\(\d{2}:\d{2}-\d{2}:\d{2}\)/g, '').replace(/\s{2,}/g, ' ').trim();
  };
  const groupedTimeLogs = useMemo(() => {
    const GROUP_WINDOW_MS = 10000;

    const toMillis = (value: any): number | null => {
      if (!value) return null;
      if (typeof value === 'number') return value;
      if (value.toMillis && typeof value.toMillis === 'function') return value.toMillis();
      if (value.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
      if (value instanceof Date) return value.getTime();
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    };

    const dateKey = (value: any): string => {
      if (!value) return '';
      let date: Date | null = null;
      if (value.toDate && typeof value.toDate === 'function') {
        date = value.toDate();
      } else if (value instanceof Date) {
        date = value;
      } else {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
      if (!date) return '';
      return date.toISOString().slice(0, 10);
    };

    const buildKey = (log: any): string => {
      return [
        log.projectId || '',
        log.subcontractorId || '',
        log.createdByUserId || '',
        dateKey(log.date),
        log.roleName || '',
        log.quantity ?? 1,
        log.status || 'DRAFT',
        log.notes || '',
        log.payRateCardId || '',
        log.billRateCardId || '',
      ].join('|');
    };

    const hashString = (value: string): string => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(36).toUpperCase();
    };

    const shortLabel = (value: string): string => {
      if (!value) return 'GRP';
      const cleaned = value.replace(/[^a-zA-Z0-9]/g, '');
      const label = cleaned.slice(-4).toUpperCase();
      return label || 'GRP';
    };

    const hasSegmentVariance = (logs: any[]): boolean => {
      const sigs = new Set<string>();
      logs.forEach((log) => {
        sigs.add([
          log.timeframeId || '',
          log.timeframeName || log.shiftType || '',
          `${log.startTime || ''}-${log.endTime || ''}`,
          log.unitSubCost ?? '',
          log.unitClientBill ?? '',
        ].join('|'));
      });
      return sigs.size > 1;
    };

    const groupInfo = new Map<string, { label: string; index: number; total: number }>();

    // Prefer stored split groups when available
    const storedGroups = new Map<string, any[]>();
    subcontractor.timeLogs.forEach((log) => {
      if (log.splitGroupId) {
        const existing = storedGroups.get(log.splitGroupId) || [];
        existing.push(log);
        storedGroups.set(log.splitGroupId, existing);
      }
    });

    storedGroups.forEach((logs, groupId) => {
      const sorted = [...logs].sort((a, b) => {
        const idxDiff = (a.splitIndex || 0) - (b.splitIndex || 0);
        if (idxDiff !== 0) return idxDiff;
        const aMs = toMillis(a.createdAt) ?? 0;
        const bMs = toMillis(b.createdAt) ?? 0;
        return aMs - bMs;
      });
      const total = logs[0]?.splitTotal || logs.length;
      sorted.forEach((log, idx) => {
        groupInfo.set(log.id, {
          label: shortLabel(groupId),
          index: log.splitIndex || (idx + 1),
          total: log.splitTotal || total,
        });
      });
    });

    // Heuristic grouping for older entries (no stored group id)
    const byKey = new Map<string, any[]>();
    subcontractor.timeLogs.forEach((log) => {
      if (log.splitGroupId) return;
      const createdAtMs = toMillis(log.createdAt);
      if (createdAtMs === null) return;
      const key = buildKey(log);
      const existing = byKey.get(key) || [];
      existing.push(log);
      byKey.set(key, existing);
    });

    byKey.forEach((logs, key) => {
      const sorted = [...logs].sort((a, b) => {
        const aMs = toMillis(a.createdAt) ?? 0;
        const bMs = toMillis(b.createdAt) ?? 0;
        return aMs - bMs;
      });

      let cluster: any[] = [];
      let clusterStartMs: number | null = null;
      let lastMs: number | null = null;

      const flushCluster = () => {
        if (cluster.length < 2) {
          cluster = [];
          return;
        }
        if (!hasSegmentVariance(cluster)) {
          cluster = [];
          return;
        }

        const label = hashString(`${key}|${clusterStartMs ?? ''}`).slice(0, 4) || 'GRP';
        cluster.forEach((log, idx) => {
          if (!groupInfo.has(log.id)) {
            groupInfo.set(log.id, {
              label,
              index: idx + 1,
              total: cluster.length,
            });
          }
        });
        cluster = [];
      };

      sorted.forEach((log) => {
        const currentMs = toMillis(log.createdAt);
        if (currentMs === null) return;

        if (cluster.length === 0) {
          cluster = [log];
          clusterStartMs = currentMs;
          lastMs = currentMs;
          return;
        }

        if (lastMs !== null && currentMs - lastMs <= GROUP_WINDOW_MS) {
          cluster.push(log);
          lastMs = currentMs;
          return;
        }

        flushCluster();
        cluster = [log];
        clusterStartMs = currentMs;
        lastMs = currentMs;
      });

      flushCluster();
    });

    return subcontractor.timeLogs.map((log) => ({
      ...log,
      __groupInfo: groupInfo.get(log.id),
    }));
  }, [subcontractor.timeLogs]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div
        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {subcontractor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{subcontractor.name}</h3>
              <p className="text-sm text-gray-600">
                {subcontractor.totalHours.toFixed(1)}h logged • {subcontractor.timeLogs.length + subcontractor.expenses.length} entries
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(subcontractor.totalCost, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Bill</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(subcontractor.totalBilling, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Margin</p>
              <p className={`text-xl font-bold ${subcontractor.marginPct >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {subcontractor.marginPct.toFixed(1)}%
              </p>
            </div>
            <button className="p-2 hover:bg-blue-100 rounded-lg transition">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Status Breakdown */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Draft */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-yellow-700 uppercase">Draft</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('DRAFT')}`}>
                  {subcontractor.byStatus.draft.count}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-700">Hours:</span>
                  <span className="font-semibold text-yellow-900">{subcontractor.byStatus.draft.hours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-700">Cost:</span>
                  <span className="font-semibold text-yellow-900">{formatCurrency(subcontractor.byStatus.draft.cost, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-700">Bill:</span>
                  <span className="font-semibold text-yellow-900">{formatCurrency(subcontractor.byStatus.draft.billing, currency)}</span>
                </div>
              </div>
            </div>

            {/* Submitted */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-orange-700 uppercase">Submitted</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('SUBMITTED')}`}>
                  {subcontractor.byStatus.submitted.count}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">Hours:</span>
                  <span className="font-semibold text-orange-900">{subcontractor.byStatus.submitted.hours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">Cost:</span>
                  <span className="font-semibold text-orange-900">{formatCurrency(subcontractor.byStatus.submitted.cost, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">Bill:</span>
                  <span className="font-semibold text-orange-900">{formatCurrency(subcontractor.byStatus.submitted.billing, currency)}</span>
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-700 uppercase">Approved</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('APPROVED')}`}>
                  {subcontractor.byStatus.approved.count}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Hours:</span>
                  <span className="font-semibold text-green-900">{subcontractor.byStatus.approved.hours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Cost:</span>
                  <span className="font-semibold text-green-900">{formatCurrency(subcontractor.byStatus.approved.cost, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Bill:</span>
                  <span className="font-semibold text-green-900">{formatCurrency(subcontractor.byStatus.approved.billing, currency)}</span>
                </div>
              </div>
            </div>

            {/* Rejected */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-red-700 uppercase">Rejected</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('REJECTED')}`}>
                  {subcontractor.byStatus.rejected.count}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-red-700">Hours:</span>
                  <span className="font-semibold text-red-900">{subcontractor.byStatus.rejected.hours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-700">Cost:</span>
                  <span className="font-semibold text-red-900">{formatCurrency(subcontractor.byStatus.rejected.cost, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-700">Bill:</span>
                  <span className="font-semibold text-red-900">{formatCurrency(subcontractor.byStatus.rejected.billing, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          {showLineItems && (subcontractor.timeLogs.length > 0 || subcontractor.expenses.length > 0) && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Detailed Line Items</span>
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Time</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty/Hours</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Bill</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Margin</th>
                        {showConversations && (
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Conversation</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Time Logs */}
                      {groupedTimeLogs.map((log) => {
                        const totalHours = (log.hoursRegular || 0) + (log.hoursOT || 0);
                        const margin = (log.clientBill || 0) - (log.subCost || 0);
                        const marginPct = log.clientBill && log.clientBill > 0
                          ? ((margin / log.clientBill) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <tr key={`log-${log.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{formatDate(log.date)}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center space-x-1 text-blue-700">
                                <Clock className="w-3 h-3" />
                                <span className="font-medium">Time</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {log.roleName}
                              {log.timeframeName ? ` - ${normalizeTimeframeName(log.timeframeName)}` : log.shiftType ? ` - ${log.shiftType}` : ''}
                              {log.__groupInfo && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold border border-indigo-200">
                                  Group {log.__groupInfo.label} {log.__groupInfo.index}/{log.__groupInfo.total}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 text-xs">
                              {log.startTime && log.endTime ? `${log.startTime}-${log.endTime}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {log.notes ? (
                                <span className="italic">{log.notes}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900">
                              {totalHours.toFixed(1)}h
                              {log.quantity && log.quantity > 1 && (
                                <span className="text-xs text-gray-500"> × {log.quantity}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-red-700">
                              {formatCurrency(log.subCost, currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              {formatCurrency(log.clientBill || 0, currency)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-right">
                                <div className={`font-semibold ${margin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                  {formatCurrency(margin, currency)}
                                </div>
                                <div className={`text-xs ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {marginPct}%
                                </div>
                              </div>
                            </td>
                            {showConversations && (
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const unresolvedCount = unresolvedNotesMap!.get(log.id) || 0;
                                  const hasConversation = unresolvedCount > 0;
                                  return (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenConversation!(log.id, 'timeLog', `${log.roleName} - ${formatDate(log.date)} - ${totalHours.toFixed(1)}h`);
                                      }}
                                      className={`relative p-2 rounded-lg transition ${
                                        hasConversation 
                                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                      }`}
                                      title={hasConversation ? `${unresolvedCount} unresolved message${unresolvedCount !== 1 ? 's' : ''}` : "View conversation"}
                                    >
                                      <MessageSquare className="w-4 h-4" fill={hasConversation ? 'currentColor' : 'none'} />
                                      {hasConversation && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                          {unresolvedCount}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })()}
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Expenses */}
                      {subcontractor.expenses.map((exp) => {
                        const billing = exp.clientBillAmount ?? exp.amount; // Fall back to cost for backward compatibility
                        const margin = billing - exp.amount;
                        const marginPct = billing > 0 ? ((margin / billing) * 100) : 0;

                        return (
                          <tr key={`exp-${exp.id}`} className="hover:bg-gray-50 bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center space-x-1 text-green-700">
                                <DollarSign className="w-3 h-3" />
                                <span className="font-medium">Expense</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900">{exp.category}</td>
                            <td className="px-4 py-3 text-center text-gray-600 text-xs">-</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {exp.description ? (
                                <span className="italic">{exp.description}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-900">
                              {exp.quantity ? exp.quantity.toFixed(1) : '1'}
                              {exp.unitRate && (
                                <span className="text-xs text-gray-500"> @ {formatCurrency(exp.unitRate, currency)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-red-700">
                              {formatCurrency(exp.amount, currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              {formatCurrency(billing, currency)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-right">
                                <div className={`font-semibold ${margin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                  {formatCurrency(margin, currency)}
                                </div>
                                <div className={`text-xs ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {marginPct.toFixed(1)}%
                                </div>
                              </div>
                            </td>
                            {showConversations && (
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const unresolvedCount = unresolvedNotesMap!.get(exp.id) || 0;
                                  const hasConversation = unresolvedCount > 0;
                                  return (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenConversation!(exp.id, 'expense', `${exp.category} - ${formatDate(exp.date)} - ${formatCurrency(exp.amount, currency)}`);
                                      }}
                                      className={`relative p-2 rounded-lg transition ${
                                        hasConversation 
                                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                      }`}
                                      title={hasConversation ? `${unresolvedCount} unresolved message${unresolvedCount !== 1 ? 's' : ''}` : "View conversation"}
                                    >
                                      <MessageSquare className="w-4 h-4" fill={hasConversation ? 'currentColor' : 'none'} />
                                      {hasConversation && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                          {unresolvedCount}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })()}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Summary Row */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-indigo-700 mb-1">Total Hours</p>
                <p className="text-xl font-bold text-indigo-900">{subcontractor.totalHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-xs text-red-700 mb-1">Total Cost</p>
                <p className="text-xl font-bold text-red-900">{formatCurrency(subcontractor.totalCost, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-green-700 mb-1">Total Billing</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(subcontractor.totalBilling, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 mb-1">Total Margin</p>
                <p className={`text-xl font-bold ${subcontractor.marginPct >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
                  {formatCurrency(subcontractor.totalMargin, currency)}
                  <span className="text-sm ml-1">({subcontractor.marginPct.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
