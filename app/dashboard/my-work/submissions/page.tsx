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
  Send,
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
}

interface Expense {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  date: any;
  category: string;
}

interface Project {
  id: string;
  name: string;
}

export default function SubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('draft');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

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
        console.error('Error loading submissions', err);
        setError('Failed to load submissions');
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
      roleName: d.data().roleName || 'Unknown',
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
      category: d.data().category || 'Unknown',
    }));
    setExpenses(exps);
  };

  const allItems = useMemo(() => {
    return [
      ...timeLogs.map(log => ({
        id: `timeLog_${log.id}`,
        type: 'timeLog' as const,
        data: log,
        date: log.date,
        status: log.status,
      })),
      ...expenses.map(exp => ({
        id: `expense_${exp.id}`,
        type: 'expense' as const,
        data: exp,
        date: exp.date,
        status: exp.status,
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

  const draftItems = filteredItems.filter(item => item.status === 'DRAFT');

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === draftItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(draftItems.map(item => item.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to submit');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const batch = writeBatch(db);

      selectedItems.forEach(itemId => {
        const [type, id] = itemId.split('_', 1);
        const actualId = itemId.substring(type.length + 1);
        
        if (type === 'timeLog') {
          batch.update(doc(db, 'timeLogs', actualId), {
            status: 'SUBMITTED',
            updatedAt: Timestamp.now(),
          });
        } else if (type === 'expense') {
          batch.update(doc(db, 'expenses', actualId), {
            status: 'SUBMITTED',
            updatedAt: Timestamp.now(),
          });
        }
      });

      await batch.commit();
      setSuccess(`Successfully submitted ${selectedItems.size} item(s)`);
      setSelectedItems(new Set());

      // Refresh the data
      if (activeCompanyId && subcontractorId) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await Promise.all([
            fetchTimeLogs(activeCompanyId, subcontractorId, currentUser.uid),
            fetchExpenses(activeCompanyId, subcontractorId, currentUser.uid),
          ]);
        }
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error submitting items:', err);
      setError('Failed to submit items. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading submissions...</p>
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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timesheet Submissions</h1>
          <p className="text-gray-600 mt-1">Submit your hours and expenses for approval</p>
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
            {(['all', 'draft', 'submitted', 'approved'] as const).map(f => (
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

        {/* Draft Selection Bar */}
        {draftItems.length > 0 && filter === 'draft' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedItems.size === draftItems.length && draftItems.length > 0}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-blue-900">
                {selectedItems.size > 0
                  ? `${selectedItems.size} item(s) selected`
                  : `Select items to submit`}
              </span>
            </div>
            {selectedItems.size > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Selected'}
              </button>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} items</p>
              <p className="text-sm text-gray-500">When you log hours or expenses, they'll appear here</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = selectedItems.has(item.id);
              const isDraft = item.status === 'DRAFT';
              const dateObj = item.date?.toDate ? item.date.toDate() : new Date(item.date);
              const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

              if (item.type === 'timeLog') {
                const log = item.data as TimeLog;
                const projectName = projects[log.projectId]?.name || 'Unknown Project';
                const totalHours = log.hoursRegular + log.hoursOT;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl shadow-sm border transition ${
                      isDraft && isSelected
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      {isDraft && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-5 h-5 rounded border-gray-300 mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">{projectName}</h3>
                            <p className="text-sm text-gray-600 mt-1">{log.roleName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center justify-end gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">£{log.subCost.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {dateStr}
                          </span>
                          {log.hoursOT > 0 && (
                            <span className="text-orange-600 font-medium">OT: {log.hoursOT.toFixed(1)}h</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'DRAFT'
                            ? 'bg-gray-100 text-gray-700'
                            : item.status === 'SUBMITTED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const exp = item.data as Expense;
                const projectName = projects[exp.projectId]?.name || 'Unknown Project';

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl shadow-sm border transition ${
                      isDraft && isSelected
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      {isDraft && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-5 h-5 rounded border-gray-300 mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">{projectName}</h3>
                            <p className="text-sm text-gray-600 mt-1">Expense: {exp.category}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center justify-end gap-2">
                              <DollarSign className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-900">£{exp.amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {dateStr}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'DRAFT'
                            ? 'bg-gray-100 text-gray-700'
                            : item.status === 'SUBMITTED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
