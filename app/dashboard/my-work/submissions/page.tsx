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
  Trash2,
  Building2,
  TrendingUp,
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
  clientId?: string;
}

interface Client {
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

interface ProjectSummary {
  projectId: string;
  projectName: string;
  clientId?: string;
  clientName?: string;
  totalCost: number;
  totalHours: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  itemCount: number;
  items: GroupedItem[];
}

export default function SubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved'>('draft');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<ProjectSummary | null>(null);

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
    
    // Fetch project and client details
    const projectIds = [...new Set(logs.map(l => l.projectId))];
    const clientsMap: Record<string, Client> = {};
    
    for (const projectId of projectIds) {
      const projDoc = await getDoc(doc(db, 'projects', projectId));
      if (projDoc.exists()) {
        const projData = projDoc.data();
        setProjects(prev => ({ 
          ...prev, 
          [projectId]: { 
            id: projectId, 
            name: projData.name,
            clientId: projData.clientId,
          } as Project 
        }));
        
        // Fetch client details if clientId exists
        if (projData.clientId) {
          const clientDoc = await getDoc(doc(db, 'clients', projData.clientId));
          if (clientDoc.exists()) {
            clientsMap[projData.clientId] = {
              id: projData.clientId,
              name: clientDoc.data().name,
            };
          }
        }
      }
    }
    
    // Update clients state
    if (Object.keys(clientsMap).length > 0) {
      setClients(prev => ({ ...prev, ...clientsMap }));
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

  // Build project summaries
  const projectSummaries = useMemo(() => {
    const summaries: ProjectSummary[] = [];
    
    Object.entries(groupedByProject).forEach(([projectId, items]) => {
      const projectName = projects[projectId]?.name || 'Unknown Project';
      const clientId = projects[projectId]?.clientId;
      const clientName = clientId && clients[clientId] ? clients[clientId].name : undefined;
      
      const totalCost = items.reduce((sum, i) => {
        if (i.type === 'timeLog') {
          return sum + (i.data as TimeLog).subCost;
        } else {
          return sum + (i.data as Expense).amount;
        }
      }, 0);

      const totalHours = items
        .filter(i => i.type === 'timeLog')
        .reduce((sum, i) => {
          const log = i.data as TimeLog;
          return sum + log.hoursRegular + (log.hoursOT || 0);
        }, 0);

      // Get the status - prefer APPROVED > SUBMITTED > DRAFT
      let status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT';
      if (items.some(i => i.status === 'APPROVED')) {
        status = 'APPROVED';
      } else if (items.some(i => i.status === 'SUBMITTED')) {
        status = 'SUBMITTED';
      }

      summaries.push({
        projectId,
        projectName,
        clientId,
        clientName,
        totalCost,
        totalHours,
        status,
        itemCount: items.length,
        items,
      });
    });

    return summaries;
  }, [groupedByProject, projects, clients]);

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
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('User not authenticated');
        setSubmitting(false);
        return;
      }

      selectedProjects.forEach(projectId => {
        const projectItems = groupedByProject[projectId] || [];
        const timeLogIds: string[] = [];
        const expenseIds: string[] = [];
        let totalHours = 0;
        let totalCost = 0;

        // First pass: collect IDs and calculate totals, update item statuses
        projectItems.forEach(item => {
          const [type, id] = item.id.split('_', 1);
          const actualId = item.id.substring(type.length + 1);
          
          if (type === 'timeLog') {
            const log = item.data as TimeLog;
            timeLogIds.push(actualId);
            totalHours += log.hoursRegular + (log.hoursOT || 0);
            totalCost += log.subCost;
            
            batch.update(doc(db, 'timeLogs', actualId), {
              status: 'SUBMITTED',
              updatedAt: Timestamp.now(),
            });
          } else if (type === 'expense') {
            const exp = item.data as Expense;
            expenseIds.push(actualId);
            totalCost += exp.amount;
            
            batch.update(doc(db, 'expenses', actualId), {
              status: 'SUBMITTED',
              updatedAt: Timestamp.now(),
            });
          }
          itemCount++;
        });

        // Create projectSubmissions document
        const submissionId = `${activeCompanyId}_${projectId}_${subcontractorId}`;
        batch.set(doc(db, 'projectSubmissions', submissionId), {
          id: submissionId,
          companyId: activeCompanyId,
          projectId: projectId,
          subcontractorId: subcontractorId,
          createdByUserId: currentUser.uid,
          timeLogIds: timeLogIds,
          expenseIds: expenseIds,
          status: 'SUBMITTED',
          submittedAt: Timestamp.now(),
          totalHours: totalHours,
          totalCost: totalCost,
          totalExpenses: expenseIds.length,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      });

      await batch.commit();
      setSuccess(`Successfully submitted ${selectedProjects.size} project timesheet(s) with ${itemCount} item(s)`);
      setSelectedProjects(new Set());

      // Refresh the data
      if (activeCompanyId && subcontractorId) {
        await Promise.all([
          fetchTimeLogs(activeCompanyId, subcontractorId, currentUser.uid),
          fetchExpenses(activeCompanyId, subcontractorId, currentUser.uid),
        ]);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error submitting projects:', err);
      setError('Failed to submit projects. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmission = async (projectId: string) => {
    setCancelling(true);
    setError('');
    setSuccess('');

    try {
      const batch = writeBatch(db);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('User not authenticated');
        setCancelling(false);
        return;
      }

      const projectItems = groupedByProject[projectId] || [];
      
      // Revert all items back to DRAFT status
      projectItems.forEach(item => {
        const [type, id] = item.id.split('_', 1);
        const actualId = item.id.substring(type.length + 1);
        
        if (type === 'timeLog') {
          batch.update(doc(db, 'timeLogs', actualId), {
            status: 'DRAFT',
            updatedAt: Timestamp.now(),
          });
        } else if (type === 'expense') {
          batch.update(doc(db, 'expenses', actualId), {
            status: 'DRAFT',
            updatedAt: Timestamp.now(),
          });
        }
      });

      // Delete the submission document
      const submissionId = `${activeCompanyId}_${projectId}_${subcontractorId}`;
      batch.delete(doc(db, 'projectSubmissions', submissionId));

      await batch.commit();
      setSuccess('Submission cancelled successfully');

      // Refresh the data
      if (activeCompanyId && subcontractorId) {
        await Promise.all([
          fetchTimeLogs(activeCompanyId, subcontractorId, currentUser.uid),
          fetchExpenses(activeCompanyId, subcontractorId, currentUser.uid),
        ]);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error cancelling submission:', err);
      setError('Failed to cancel submission. Please try again.');
    } finally {
      setCancelling(false);
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

        {/* Projects Grid */}
        <div>
          {projectSummaries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} items</p>
              <p className="text-sm text-gray-500">When you log hours or expenses, they'll appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectSummaries.map(project => {
                const isDraftProject = draftProjects.has(project.projectId);
                const isSelected = selectedProjects.has(project.projectId);
                const statusColors = {
                  DRAFT: 'bg-gray-100 text-gray-700',
                  SUBMITTED: 'bg-yellow-100 text-yellow-700',
                  APPROVED: 'bg-green-100 text-green-700',
                };

                return (
                  <div
                    key={project.projectId}
                    onClick={() => setSelectedProjectForModal(project)}
                    className={`rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                      isDraftProject && isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Card Header with Checkbox */}
                    <div className="flex items-start justify-between mb-4">
                      {isDraftProject && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectProject(project.projectId);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded border-gray-300 mt-1"
                        />
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-semibold ml-auto ${statusColors[project.status]}`}>
                        {project.status}
                      </span>
                    </div>

                    {/* Project Name */}
                    <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2">{project.projectName}</h3>

                    {/* Client */}
                    {project.clientName && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <Building2 className="w-4 h-4" />
                        <span className="line-clamp-1">{project.clientName}</span>
                      </div>
                    )}

                    {/* Total Cost - Prominent Display */}
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-gray-600 mb-1">Total Cost</p>
                      <p className="text-2xl font-bold text-blue-900">£{project.totalCost.toFixed(2)}</p>
                    </div>

                    {/* Hours and Items */}
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Hours Logged
                        </span>
                        <span className="font-semibold text-gray-900">{project.totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Items
                        </span>
                        <span className="font-semibold text-gray-900">{project.itemCount}</span>
                      </div>
                    </div>

                    {/* Click to View */}
                    <p className="text-xs text-blue-600 font-medium">Click to view breakdown →</p>

                    {/* Cancel Button for Submitted/Approved */}
                    {(project.status === 'SUBMITTED' || project.status === 'APPROVED') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to cancel this submission? This will revert all items back to draft status.')) {
                            handleCancelSubmission(project.projectId);
                          }
                        }}
                        disabled={cancelling}
                        className="mt-4 w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Cancel Submission
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal - Project Details */}
        {selectedProjectForModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProjectForModal.projectName}</h2>
                  {selectedProjectForModal.clientName && (
                    <p className="text-sm text-gray-600 mt-1">Client: {selectedProjectForModal.clientName}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedProjectForModal(null)}
                  className="text-gray-500 hover:text-gray-700 transition text-2xl font-light"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Entries Table */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Hours</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedProjectForModal.items.map((item) => {
                          const dateObj = item.date?.toDate ? item.date.toDate() : new Date(item.date);
                          const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          
                          if (item.type === 'timeLog') {
                            const log = item.data as TimeLog;
                            const totalHours = log.hoursRegular + (log.hoursOT || 0);
                            
                            return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm text-gray-600">{dateStr}</td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900">Time Log</td>
                                <td className="px-6 py-3 text-sm text-gray-900">
                                  <div>{log.roleName}</div>
                                  <div className="text-xs text-gray-500">Regular: {log.hoursRegular}h {log.hoursOT > 0 ? `/ OT: ${log.hoursOT}h` : ''}</div>
                                </td>
                                <td className="px-6 py-3 text-center text-sm text-gray-900">{totalHours.toFixed(1)}h</td>
                                <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">£{log.subCost.toFixed(2)}</td>
                              </tr>
                            );
                          } else {
                            const exp = item.data as Expense;
                            
                            return (
                              <tr key={item.id} className="hover:bg-gray-50 bg-gray-50">
                                <td className="px-6 py-3 text-sm text-gray-600">{dateStr}</td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900">Expense</td>
                                <td className="px-6 py-3 text-sm text-gray-900">{exp.category}</td>
                                <td className="px-6 py-3 text-center text-sm text-gray-600">—</td>
                                <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">£{exp.amount.toFixed(2)}</td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Project Total */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Total Hours</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedProjectForModal.totalHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Cost</p>
                      <p className="text-2xl font-bold text-blue-900">£{selectedProjectForModal.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
