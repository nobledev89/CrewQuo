'use client';

import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
} from 'firebase/firestore';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Clock, 
  DollarSign, 
  FileText, 
  HourglassIcon, 
  TrendingUp, 
  Calendar,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

interface TimeLog {
  id: string;
  projectId: string;
  date: any;
  hoursRegular: number;
  hoursOT: number;
  subCost: number;
  status: string;
}

interface Expense {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  date: any;
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data();
        setUserRole(userData.role);
        const activeId = userData.activeCompanyId || userData.companyId;
        setActiveCompanyId(activeId);

        const subRole = userData.subcontractorRoles?.[activeId];
        if (!subRole) {
          setLoading(false);
          return;
        }
        setSubcontractorId(subRole.subcontractorId);

        await Promise.all([
          fetchTimeLogs(activeId, subRole.subcontractorId, currentUser.uid),
          fetchExpenses(activeId, subRole.subcontractorId, currentUser.uid),
        ]);
      } catch (err) {
        console.error('Error loading summary', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const fetchTimeLogs = async (companyId: string, subId: string, uid: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'timeLogs'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId),
        where('createdByUserId', '==', uid),
        orderBy('date', 'desc')
      )
    );
    const logs: TimeLog[] = snap.docs.map((d) => ({
      id: d.id,
      projectId: d.data().projectId,
      date: d.data().date,
      hoursRegular: d.data().hoursRegular || 0,
      hoursOT: d.data().hoursOT || 0,
      subCost: d.data().subCost || 0,
      status: d.data().status || 'DRAFT',
    }));
    setTimeLogs(logs);
  };

  const fetchExpenses = async (companyId: string, subId: string, uid: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'expenses'),
        where('companyId', '==', companyId),
        where('subcontractorId', '==', subId),
        where('createdByUserId', '==', uid),
        orderBy('date', 'desc')
      )
    );
    const exps: Expense[] = snap.docs.map((d) => ({
      id: d.id,
      projectId: d.data().projectId,
      amount: d.data().amount || 0,
      status: d.data().status || 'DRAFT',
      date: d.data().date,
    }));
    setExpenses(exps);
  };

  // Calculate stats for different periods
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Monthly stats (from 1st of current month)
    const monthlyLogs = timeLogs.filter((log) => {
      const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return logDate >= monthStart;
    });

    const monthlyHours = monthlyLogs.reduce(
      (sum, log) => sum + log.hoursRegular + log.hoursOT,
      0
    );

    const monthlyEarnings = monthlyLogs
      .filter((log) => log.status === 'APPROVED')
      .reduce((sum, log) => sum + log.subCost, 0);

    // 30-day stats
    const last30DaysLogs = timeLogs.filter((log) => {
      const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return logDate >= thirtyDaysAgo;
    });

    const last30DaysHours = last30DaysLogs.reduce(
      (sum, log) => sum + log.hoursRegular + log.hoursOT,
      0
    );

    const last30DaysEarnings = last30DaysLogs
      .filter((log) => log.status === 'APPROVED')
      .reduce((sum, log) => sum + log.subCost, 0);

    // Status counts
    const pendingCount =
      timeLogs.filter((log) => log.status === 'DRAFT').length +
      expenses.filter((exp) => exp.status === 'DRAFT').length;

    const submittedCount =
      timeLogs.filter((log) => log.status === 'SUBMITTED').length +
      expenses.filter((exp) => exp.status === 'SUBMITTED').length;

    const approvedCount =
      timeLogs.filter((log) => log.status === 'APPROVED').length +
      expenses.filter((exp) => exp.status === 'APPROVED').length;

    // All-time stats
    const totalHours = timeLogs.reduce(
      (sum, log) => sum + log.hoursRegular + log.hoursOT,
      0
    );

    const totalEarnings = timeLogs
      .filter((log) => log.status === 'APPROVED')
      .reduce((sum, log) => sum + log.subCost, 0);

    // Generate chart data for last 30 days
    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = timeLogs.filter((log) => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        return logDate.toISOString().split('T')[0] === dateStr;
      });

      const dayHours = dayLogs.reduce(
        (sum, log) => sum + log.hoursRegular + log.hoursOT,
        0
      );

      chartData.push({
        date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        hours: dayHours,
      });
    }

    return {
      monthlyHours,
      monthlyEarnings,
      last30DaysHours,
      last30DaysEarnings,
      pendingCount,
      submittedCount,
      approvedCount,
      totalHours,
      totalEarnings,
      chartData,
    };
  }, [timeLogs, expenses]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading summary...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isSubcontractor = userRole === 'SUBCONTRACTOR' || subcontractorId !== '';

  if (!isSubcontractor) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="font-semibold text-yellow-800">This view is for subcontractors.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const maxHours = Math.max(...stats.chartData.map(d => d.hours), 1);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Work Summary</h1>
            <p className="text-gray-600 mt-1">Overview of your hours, earnings, and submissions</p>
          </div>
          <Link
            href="/dashboard/my-work/projects"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View Projects
          </Link>
        </div>

        {/* Quick Stats - This Month */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">This Month (From 1st)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-blue-700 font-medium mb-1">Hours Logged</p>
              <p className="text-3xl font-bold text-blue-900">{stats.monthlyHours.toFixed(1)}h</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-green-700 font-medium mb-1">Earnings</p>
              <p className="text-3xl font-bold text-green-900">£{stats.monthlyEarnings.toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-1">Approved</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-sm border border-yellow-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                {stats.pendingCount > 0 && (
                  <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">
                    {stats.pendingCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-yellow-700 font-medium mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-900">{stats.pendingCount}</p>
              <p className="text-xs text-yellow-600 mt-1">Draft items</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <HourglassIcon className="w-6 h-6 text-white" />
                </div>
                {stats.submittedCount > 0 && (
                  <span className="px-2 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">
                    {stats.submittedCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-orange-700 font-medium mb-1">Submitted</p>
              <p className="text-3xl font-bold text-orange-900">{stats.submittedCount}</p>
              <p className="text-xs text-orange-600 mt-1">Awaiting approval</p>
            </div>
          </div>
        </div>

        {/* 30-Day Activity Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Last 30 Days Activity
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {stats.last30DaysHours.toFixed(1)} hours • £{stats.last30DaysEarnings.toFixed(2)} earned
              </p>
            </div>
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>

          {/* Simple Bar Chart */}
          <div className="space-y-1">
            <div className="flex items-end justify-between gap-1 h-48">
              {stats.chartData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all"
                    style={{ height: `${(day.hours / maxHours) * 100}%`, minHeight: day.hours > 0 ? '4px' : '0' }}
                  ></div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                    {day.date}: {day.hours.toFixed(1)}h
                  </div>
                </div>
              ))}
            </div>
            {/* X-axis labels - show every 5th day */}
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
              {stats.chartData.map((day, idx) => (
                <div key={idx} className="flex-1 text-center">
                  {idx % 5 === 0 ? day.date : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Submission Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Draft</p>
                    <p className="text-sm text-gray-600">Not yet submitted</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.pendingCount}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center">
                    <HourglassIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Submitted</p>
                    <p className="text-sm text-gray-600">Awaiting review</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-orange-900">{stats.submittedCount}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Approved</p>
                    <p className="text-sm text-gray-600">Confirmed</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-900">{stats.approvedCount}</span>
              </div>
            </div>
          </div>

          {/* All-Time Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All-Time Statistics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Hours Logged</span>
                  <span className="text-2xl font-bold text-blue-900">{stats.totalHours.toFixed(1)}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Earnings (Approved)</span>
                  <span className="text-2xl font-bold text-green-900">£{stats.totalEarnings.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Entries</span>
                  <span className="text-2xl font-bold text-purple-900">{timeLogs.length + expenses.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <p className="text-blue-600 font-semibold">{timeLogs.length}</p>
                    <p className="text-gray-600 text-xs">Time Logs</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <p className="text-green-600 font-semibold">{expenses.length}</p>
                    <p className="text-gray-600 text-xs">Expenses</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
