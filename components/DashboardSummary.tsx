'use client';

import Link from 'next/link';
import { Clock, FileText, HourglassIcon, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

interface DashboardSummaryProps {
  monthlyHours: number;
  pendingCount: number;
  submittedCount: number;
  monthlyEarnings: number;
  loading?: boolean;
}

export default function DashboardSummary({
  monthlyHours,
  pendingCount,
  submittedCount,
  monthlyEarnings,
  loading = false,
}: DashboardSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Hours */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-blue-700 font-medium mb-1">This Month's Hours</p>
          <p className="text-3xl font-bold text-blue-900">{monthlyHours.toFixed(1)}h</p>
          <p className="text-xs text-blue-600 mt-2">From 1st to date</p>
        </div>

        {/* Pending Submissions */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-sm border border-yellow-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            {pendingCount > 0 && (
              <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-sm text-yellow-700 font-medium mb-1">Pending Submissions</p>
          <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
          <p className="text-xs text-yellow-600 mt-2">Draft items</p>
        </div>

        {/* Awaiting Approval */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
              <HourglassIcon className="w-6 h-6 text-white" />
            </div>
            {submittedCount > 0 && (
              <span className="px-2 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">
                {submittedCount}
              </span>
            )}
          </div>
          <p className="text-sm text-orange-700 font-medium mb-1">Awaiting Approval</p>
          <p className="text-3xl font-bold text-orange-900">{submittedCount}</p>
          <p className="text-xs text-orange-600 mt-2">Submitted items</p>
        </div>

        {/* Monthly Earnings */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-green-700 font-medium mb-1">This Month's Earnings</p>
          <p className="text-3xl font-bold text-green-900">£{monthlyEarnings.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-2">Approved amount</p>
        </div>
      </div>

      {/* View Full Reports Link */}
      <div className="flex justify-end">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="font-medium">View Full Reports</span>
        </Link>
      </div>
    </div>
  );
}
