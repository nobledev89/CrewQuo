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

interface GroupedItem {
  id: string;
  type: 'timeLog' | 'expense';
  data: TimeLog | Expense;
  date: any;
  status: string;
  projectId: string;
}

export default function SubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('draft');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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
        projectId: log.projectId,
      })),
      ...expenses.map(exp => ({
        id: `expense_${exp.id}`,
        type: 'expense' as const,
        data: exp,
        date: exp.date,
        status: exp.status,
        projectId: exp.projectId,
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

  // Group by project
  const groupedByProject = useMemo(() => {
    const grouped: Record<string, GroupedItem[]> = {};
    filteredItems.forEach(item => {
      if (!grouped[item.projectId]) {
        grouped[item.projectId] = [];
      }
      grouped[item.projectId].push(item);
    });
    return grouped;
  }, [filteredItems]);

  // Get draft projects (only DRAFT items)
  const draftProjects = useMemo(() => {
    const projects = new Set<string>();
    allItems.forEach(item => {
      if (item.status === 'DRAFT') {
        projects.add(item.projectId);
      }
    });
    return projects;
  }, [allItems]);

  const handleSelectProject = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAllProjects = () => {
    if (selectedProjects.size === draftProjects.size) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(draftProjects));
    }
  };

  const handleSubmit = async () => {
    if (selectedProjects.size === 0) {
      setError('Please select at least one project to submit');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const batch = writeBatch(db);
      let itemCount = 0;

      selectedProjects.forEach(projectId => {
        const projectItems = groupedByProject[projectId] || [];
        
        projectItems.forEach(item => {
          const [type, id] = item.id.split('_', 1);
          const actualId = item.id.substring(type.length + 1);
          
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
          itemCount++;
        });
      });

      await batch.commit();
      setSuccess(`Successfully submitted ${selectedProjects.size} project timesheet(s) with ${itemCount} item(s)`);
      setSelectedProjects(new Set());

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
      console.error('Error submitting projects:', err);
      setError('Failed to submit projects. Please try again.');
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
          <p className="text-gray-600 mt-1">Submit your hours and expenses by project for approval</p>
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
        {draftProjects.size > 0 && filter === 'draft' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedProjects.size === draftProjects.size && draftProjects.size > 0}
                onChange={handleSelectAllProjects}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-blue-900">
                {selectedProjects.size > 0
                  ? `${selectedProjects.size} project timesheet(s) selected`
                  : `Select projects to submit`}
              </span>
            </div>
            {selectedProjects.size > 0 && (
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

        {/* Projects List */}
        <div className="space-y-3">
          {Object.keys(groupedByProject).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} items</p>
              <p className="text-sm text-gray-500">When you log hours or expenses, they'll appear here</p>
            </div>
          ) : (
            Object.entries(groupedByProject).map(([projectId, items]) => {
              const projectName = projects[projectId]?.name || 'Unknown Project';
              const isExpanded = expandedProjects.has(projectId);
              const isDraftProject = draftProjects.has(projectId);
              const isSelected = selectedProjects.has(projectId);

              const totalHours = items
                .filter(i => i.type === 'timeLog')
                .reduce((sum, i) => {
                  const log = i.data as TimeLog;
                  return sum + log.hoursRegular + (log.hoursOT || 0);
                }, 0);

              const totalCost = items.reduce((sum, i) => {
                if (i.type === 'timeLog') {
                  return sum + (i.data as TimeLog).subCost;
                } else {
                  return sum + (i.data as Expense).amount;
                }
              }, 0);

              return (
                <div
                  key={projectId}
                  className={`bg-white rounded-xl shadow-sm border transition ${
                    isDraftProject && isSelected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Project Header */}
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedProjects);
                      if (newExpanded.has(projectId)) {
                        newExpanded.delete(projectId);
                      } else {
                        newExpanded.add(projectId);
                      }
                      setExpandedProjects(newExpanded);
                    }}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      {isDraftProject && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectProject(projectId);
                          }}
                          className="w-5 h-5 rounded border-gray-300"
                        />
                      )}
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{projectName}</h3>
                        <p className="text-sm text-gray-600 mt-1">{items.length} item(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center justify-end gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">£{totalCost.toFixed(2)}</p>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                      {items.map(item => {
                        const dateObj = item.date?.toDate ? item.date.toDate() : new Date(item.date);
                        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                        if (item.type === 'timeLog') {
                          const log = item.data as TimeLog;
                          const totalHours = log.hoursRegular + (log.hoursOT || 0);

                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{log.roleName}</h4>
                                  <p className="text-sm text-gray-600 mt-1">Time Log</p>
                                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {dateStr}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {totalHours.toFixed(1)}h
                                    </span>
                                    {log.hoursOT && log.hoursOT > 0 && (
                                      <span className="text-orange-600 font-medium">OT: {log.hoursOT.toFixed(1)}h</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm text-gray-600">Cost</p>
                                  <p className="text-lg font-bold text-gray-900">£{log.subCost.toFixed(2)}</p>
                                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
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

                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{exp.category}</h4>
                                  <p className="text-sm text-gray-600 mt-1">Expense</p>
                                  <div className="mt-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {dateStr}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm text-gray-600">Amount</p>
                                  <p className="text-lg font-bold text-gray-900">£{exp.amount.toFixed(2)}</p>
                                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
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
