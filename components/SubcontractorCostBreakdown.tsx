'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, DollarSign, TrendingUp, FileText } from 'lucide-react';
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
}

export default function SubcontractorCostBreakdown({
  subcontractor,
  currency = 'GBP',
  showLineItems = true,
}: SubcontractorCostBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
          <div className="grid grid-cols-3 gap-4">
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
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty/Hours</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Bill</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Margin</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Time Logs */}
                      {subcontractor.timeLogs.map((log) => {
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
                              {log.roleName} {log.timeframeName ? `- ${log.timeframeName}` : log.shiftType ? `- ${log.shiftType}` : ''}
                              {log.startTime && log.endTime && (
                                <span className="text-xs text-gray-500 ml-1">({log.startTime}-{log.endTime})</span>
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
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(log.status)}`}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Expenses */}
                      {subcontractor.expenses.map((exp) => {
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
                              {formatCurrency(exp.amount, currency)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-right">
                                <div className="font-semibold text-gray-700">
                                  {formatCurrency(0, currency)}
                                </div>
                                <div className="text-xs text-gray-600">
                                  0.0%
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(exp.status)}`}>
                                {exp.status}
                              </span>
                            </td>
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
