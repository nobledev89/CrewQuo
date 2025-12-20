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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText,
  Check,
  X,
  AlertCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  ChevronDown,
} from 'lucide-react';

interface TimeLog {
  id: string;
  projectId: string;
  date: any;
  hoursRegular: number;
  hoursOT: number;
  subCost: number;
  status: string;
  roleName: string;
  subcontractorId: string;
  createdByUserId: string;
}

interface Expense {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  date: any;
  category: string;
  subcontractorId: string;
  createdByUserId: string;
}

interface Subcontractor {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

export default function TimesheetsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subcontractors, setSubcontractors] = useState<Record<string, Subcontractor>>({});
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [filter, setFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedSubcontractor, setExpandedSubcontractor] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

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

        // Only allow ADMIN and MANAGER roles
        if (userData.role !== 'ADMIN' && userData.role !== 'MANAGER') {
          setLoading(false);
          return;
        }

        await Promise.all([
          fetchTimeLogs(activeId),
          fetchExpenses(activeId),
          fetchSubcontractors(activeId),
        ]);
      } catch (err) {
        console.error('Error loading timesheets', err);
        setError('Failed to load timesheets');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const fetchTimeLogs = async (companyId: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'timeLogs'),
        where('companyId', '==', companyId),
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
      roleName: d.data().roleName || 'Unknown',
      subcontractorId: d.data().subcontractorId,
      createdByUserId: d.data().createdByUserId,
    }));
    setTimeLogs(logs);
    
    // Fetch project details
    const projectIds = [...new Set(logs.map(l => l.projectId))];
    for (const projectId of projectIds) {
      const projDoc = await getDoc(doc(db, 'projects', projectId));
      if (projDoc.exists()) {
        setProjects(prev => ({ ...prev, [projectId]: { id: projectId, name: projDoc.data().name } as Project }));
      }
    }
  };

  const fetchExpenses = async (companyId: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'expenses'),
        where('companyId', '==', companyId),
        orderBy('date', 'desc')
      )
    );
    const exps: Expense[] = snap.docs.map((d) => ({
      id: d.id,
      projectId: d.data().projectId,
      amount: d.data().amount || 0,
      status: d.data().status || 'DRAFT',
      date: d.data().date,
      category: d.data().category || 'Unknown',
      subcontractorId: d.data().subcontractorId,
      createdByUserId: d.data().createdByUserId,
    }));
    setExpenses(exps);
  };

  const fetchSubcontractors = async (companyId: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'subcontractors'),
        where('companyId', '==', companyId)
      )
    );
    const subs: Record<string, Subcontractor> = {};
    snap.docs.forEach((d) => {
      subs[d.id] = {
        id: d.id,
        name: d.data().name,
        email: d.data().email,
      };
    });
    setSubcontractors(subs);
  };

  const allItems = useMemo(() => {
    return [
      ...timeLogs.map(log => ({
        id: `timeLog_${log.id}`,
        type: 'timeLog' as const,
        data: log,
        date: log.date,
        status: log.status,
        subcontractorId: log.subcontractorId,
      })),
      ...expenses.map(exp => ({
        id: `expense_${exp.id}`,
        type: 'expense' as const,
        data: exp,
        date: exp.date,
        status: exp.status,
        subcontractorId: exp.subcontractorId,
      })),
    ].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [timeLogs, expenses]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (filter === 'all') return true;
      return item.status.toUpperCase() === filter.toUpperCase();
    });
  }, [allItems, filter]);

  const groupedBySubcontractor = useMemo(() => {
    const grouped: Record<string, typeof filteredItems> = {};
    filteredItems.forEach(item => {
      if (!grouped[item.subcontractorId]) {
        grouped[item.subcontractorId] = [];
      }
      grouped[item.subcontractorId].push(item);
    });
    return grouped;
  }, [filteredItems]);

  const handleApprove = async (itemId: string) => {
    setProcessingId(itemId);
    setError('');

    try {
      const [type, id] = itemId.split('_', 1);
      const actualId = itemId.substring(type.length + 1);

      if (type === 'timeLog') {
        await writeBatch(db).update(doc(db, 'timeLogs', actualId), {
          status: 'APPROVED',
          updatedAt: Timestamp.now(),
        }).commit();
      } else if (type === 'expense') {
        await writeBatch(db).update(doc(db, 'expenses', actualId), {
          status: 'APPROVED',
          updatedAt: Timestamp.now(),
        }).commit();
      }

      setSuccess(`Item approved successfully`);

      // Refresh the data
      if (activeCompanyId) {
        await Promise.all([
          fetchTimeLogs(activeCompanyId),
          fetchExpenses(activeCompanyId),
        ]);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error approving item:', err);
      setError('Failed to approve item. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (itemId: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    setProcessingId(itemId);
    setError('');

    try {
      const [type, id] = itemId.split('_', 1);
      const actualId = itemId.substring(type.length + 1);

      if (type === 'timeLog') {
        await writeBatch(db).update(doc(db, 'timeLogs', actualId), {
          status: 'REJECTED',
          rejectionReason: rejectionReason,
          updatedAt: Timestamp.now(),
        }).commit();
      } else if (type === 'expense') {
        await writeBatch(db).update(doc(db, 'expenses', actualId), {
          status: 'REJECTED',
          rejectionReason: rejectionReason,
          updatedAt: Timestamp.now(),
        }).commit();
      }

      setSuccess(`Item rejected`);
      setRejectionReason('');
      setRejectingId(null);

      // Refresh the data
      if (activeCompanyId) {
        await Promise.all([
          fetchTimeLogs(activeCompanyId),
          fetchExpenses(activeCompanyId),
        ]);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error rejecting item:', err);
      setError('Failed to reject item. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading timesheets...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="font-semibold text-red-800">Access Denied: Only admins and managers can access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timesheet Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve subcontractor timesheets and expenses</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'submitted', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Items by Subcontractor */}
        <div className="space-y-4">
          {Object.keys(groupedBySubcontractor).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} items</p>
              <p className="text-sm text-gray-500">Subcontractors haven't submitted any timesheets yet</p>
            </div>
          ) : (
            Object.entries(groupedBySubcontractor).map(([subcontractorId, items]) => {
              const subcontractor = subcontractors[subcontractorId];
              const isExpanded = expandedSubcontractor === subcontractorId;
              const submittedCount = items.filter(i => i.status === 'SUBMITTED').length;

              return (
                <div key={subcontractorId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Subcontractor Header */}
                  <button
                    onClick={() => setExpandedSubcontractor(isExpanded ? null : subcontractorId)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{subcontractor?.name || 'Unknown'}</h3>
                        <p className="text-sm text-gray-600">{subcontractor?.email || 'No email'}</p>
                      </div>
                      {submittedCount > 0 && (
                        <span className="ml-auto mr-4 px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                          {submittedCount} pending
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                      {items.map(item => {
                        const dateObj = item.date?.toDate ? item.date.toDate() : new Date(item.date);
                        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                        if (item.type === 'timeLog') {
                          const log = item.data as TimeLog;
                          const projectName = projects[log.projectId]?.name || 'Unknown Project';
                          const totalHours = log.hoursRegular + log.hoursOT;
                          const isRejecting = rejectingId === item.id;

                          return (
                            <div key={item.id} className="p-6">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{projectName}</h4>
                                  <p className="text-sm text-gray-600 mt-1">{log.roleName}</p>
                                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {dateStr}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {totalHours.toFixed(1)}h
                                    </span>
                                    {log.hoursOT > 0 && (
                                      <span className="text-orange-600 font-medium">OT: {log.hoursOT.toFixed(1)}h</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm text-gray-600">Cost</p>
                                  <p className="text-2xl font-bold text-gray-900">£{log.subCost.toFixed(2)}</p>
                                </div>
                              </div>

                              {/* Rejection Reason - Show if rejected */}
                              {log.status === 'REJECTED' && (log as any).rejectionReason && (
                                <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                                  <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                                  <p className="text-sm text-red-700 mt-1">{(log as any).rejectionReason}</p>
                                </div>
                              )}

                              {/* Actions */}
                              {item.status === 'SUBMITTED' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    disabled={processingId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                  >
                                    <Check className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(isRejecting ? null : item.id)}
                                    disabled={processingId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              )}

                              {/* Rejection Reason Input */}
                              {isRejecting && item.status === 'SUBMITTED' && (
                                <div className="mt-4 p-4 bg-red-50 rounded border border-red-200">
                                  <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Reason for rejection
                                  </label>
                                  <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                                    rows={3}
                                    placeholder="Please explain why this submission is being rejected..."
                                  />
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => handleReject(item.id)}
                                      disabled={processingId !== null || !rejectionReason.trim()}
                                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                    >
                                      <Check className="w-4 h-4" />
                                      Confirm Rejection
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingId(null);
                                        setRejectionReason('');
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Status Badge */}
                              {item.status !== 'SUBMITTED' && (
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    item.status === 'APPROVED'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          const exp = item.data as Expense;
                          const projectName = projects[exp.projectId]?.name || 'Unknown Project';
                          const isRejecting = rejectingId === item.id;

                          return (
                            <div key={item.id} className="p-6">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{projectName}</h4>
                                  <p className="text-sm text-gray-600 mt-1">Expense: {exp.category}</p>
                                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {dateStr}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm text-gray-600">Amount</p>
                                  <p className="text-2xl font-bold text-gray-900">£{exp.amount.toFixed(2)}</p>
                                </div>
                              </div>

                              {/* Rejection Reason - Show if rejected */}
                              {exp.status === 'REJECTED' && (exp as any).rejectionReason && (
                                <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                                  <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                                  <p className="text-sm text-red-700 mt-1">{(exp as any).rejectionReason}</p>
                                </div>
                              )}

                              {/* Actions */}
                              {item.status === 'SUBMITTED' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    disabled={processingId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                  >
                                    <Check className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(isRejecting ? null : item.id)}
                                    disabled={processingId !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              )}

                              {/* Rejection Reason Input */}
                              {isRejecting && item.status === 'SUBMITTED' && (
                                <div className="mt-4 p-4 bg-red-50 rounded border border-red-200">
                                  <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Reason for rejection
                                  </label>
                                  <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                                    rows={3}
                                    placeholder="Please explain why this submission is being rejected..."
                                  />
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => handleReject(item.id)}
                                      disabled={processingId !== null || !rejectionReason.trim()}
                                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                    >
                                      <Check className="w-4 h-4" />
                                      Confirm Rejection
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingId(null);
                                        setRejectionReason('');
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Status Badge */}
                              {item.status !== 'SUBMITTED' && (
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    item.status === 'APPROVED'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
