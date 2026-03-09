'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ArrowLeft, Activity, Clock, DollarSign, TrendingUp, MessageSquare } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import LineItemNotesModal from '@/components/LineItemNotesModal';
import { getProjectVisibilitySettings } from '@/lib/clientAccessUtils';
import {
  aggregateProjectCosts,
  formatCurrency,
  formatDate,
  getStatusColor,
  type TimeLogData,
  type ExpenseData,
  type ProjectTracking,
} from '@/lib/projectTrackingUtils';

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  clientName: string;
  companyId: string;
}

interface VisibilitySettings {
  showCosts: boolean;
  showMargins: boolean;
  showSubcontractorRates: boolean;
  allowClientNotes: boolean;
  showDraftStatus: boolean;
  showRejectedStatus: boolean;
}

export default function ClientProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientOrgId, setClientOrgId] = useState('');
  const [contractorCompanyId, setContractorCompanyId] = useState('');
  const [visibility, setVisibility] = useState<VisibilitySettings>({
    showCosts: false,
    showMargins: false,
    showSubcontractorRates: false,
    allowClientNotes: true,
    showDraftStatus: true,
    showRejectedStatus: true,
  });

  const [timeLogs, setTimeLogs] = useState<TimeLogData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [projectTracking, setProjectTracking] = useState<ProjectTracking | null>(null);
  const [currency] = useState<string>('GBP');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');

  // Notes modal state
  const [selectedLineItem, setSelectedLineItem] = useState<{
    itemId: string;
    itemType: 'timeLog' | 'expense';
    itemDescription: string;
  } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Redirect non-client users
            if (userData.role !== 'CLIENT') {
              router.push('/dashboard');
              return;
            }

            setClientOrgId(userData.clientOrgId || '');

            await fetchProject(projectId);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [projectId, router]);

  const fetchProject = async (projId: string) => {
    try {
      const projectDoc = await getDoc(doc(db, 'projects', projId));
      if (!projectDoc.exists()) {
        return;
      }

      const projectData = projectDoc.data();
      const compId = projectData.companyId;
      setContractorCompanyId(compId);

      setProject({
        id: projectDoc.id,
        projectCode: projectData.projectCode,
        name: projectData.name,
        location: projectData.location,
        status: projectData.status,
        clientName: projectData.clientName || 'Unknown Client',
        companyId: compId,
      });

      // Get visibility settings
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      const userData = userDoc.data();
      const clientOrgIdParam = userData?.clientOrgId;

      if (clientOrgIdParam) {
        const settings = await getProjectVisibilitySettings(compId, clientOrgIdParam, projId);
        setVisibility(settings);
      }

      // Fetch live tracking data
      await fetchLiveTrackingData(compId, projId);
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchLiveTrackingData = async (compId: string, projId: string) => {
    try {
      // Fetch subcontractors
      const subcontractorsQuery = query(
        collection(db, 'subcontractors'),
        where('companyId', '==', compId),
        where('active', '==', true)
      );
      const subcontractorsSnap = await getDocs(subcontractorsQuery);

      const subsMap = new Map<string, string>();
      subcontractorsSnap.docs.forEach(doc => {
        subsMap.set(doc.id, doc.data().name);
      });

      // Fetch time logs
      const logsQuery = query(
        collection(db, 'timeLogs'),
        where('companyId', '==', compId),
        where('projectId', '==', projId)
      );
      const logsSnap = await getDocs(logsQuery);

      const logsData: TimeLogData[] = logsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date?.toDate ? data.date.toDate() : data.date || null,
          roleName: data.roleName || 'Unknown Role',
          timeframeName: data.timeframeName,
          shiftType: data.shiftType,
          hoursRegular: data.hoursRegular || 0,
          hoursOT: data.hoursOT || 0,
          quantity: data.quantity || 1,
          subCost: data.subCost || 0,
          clientBill: data.clientBill || 0,
          marginValue: data.marginValue || 0,
          marginPct: data.marginPct || 0,
          status: data.status || 'DRAFT',
          subcontractorId: data.subcontractorId,
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes,
        };
      }).sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      // Fetch expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('companyId', '==', compId),
        where('projectId', '==', projId)
      );
      const expensesSnap = await getDocs(expensesQuery);

      const expensesData: ExpenseData[] = expensesSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date?.toDate ? data.date.toDate() : (data.date || null),
          category: data.category || 'Unknown',
          amount: data.amount || 0,
          quantity: data.quantity || 1,
          unitRate: data.unitRate,
          clientBillAmount: data.clientBillAmount,
          marginValue: data.marginValue,
          marginPercentage: data.marginPercentage,
          status: data.status || 'DRAFT',
          subcontractorId: data.subcontractorId,
          description: data.description,
        };
      }).sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setTimeLogs(logsData);
      setExpenses(expensesData);

      const tracking = aggregateProjectCosts(logsData, expensesData, subsMap);
      setProjectTracking(tracking);
    } catch (error) {
      console.error('Error fetching live tracking data:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading project...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project || !projectTracking) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Project not found</h3>
            <p className="text-red-600 mb-4">You may not have access to this project.</p>
            <button
              onClick={() => router.push('/dashboard/client-portal')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Projects</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/client-portal')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Projects</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h2>
              <p className="text-gray-600 font-mono">{project.projectCode}</p>
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Project Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</p>
              <p className="text-lg font-semibold text-gray-900">{project.location}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subcontractors</p>
              <p className="text-lg font-semibold text-gray-900">{projectTracking.subcontractors.length}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-blue-700">Total Hours</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{projectTracking.totals.hours.toFixed(1)}h</p>
            <p className="text-xs text-blue-600 mt-1">All logged hours</p>
          </div>

          {visibility.showCosts && (
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6">
              <div className="flex items-center space-x-3 mb-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                <p className="text-sm font-semibold text-red-700">Total Cost</p>
              </div>
              <p className="text-3xl font-bold text-red-900">{formatCurrency(projectTracking.totals.cost, currency)}</p>
              <p className="text-xs text-red-600 mt-1">Subcontractor costs</p>
            </div>
          )}

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
            <div className="flex items-center space-x-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <p className="text-sm font-semibold text-green-700">Total Billing</p>
            </div>
            <p className="text-3xl font-bold text-green-900">{formatCurrency(projectTracking.totals.billing, currency)}</p>
            <p className="text-xs text-green-600 mt-1">What you're charged</p>
          </div>

          {visibility.showMargins && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6">
              <div className="flex items-center space-x-3 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-semibold text-purple-700">Total Margin</p>
              </div>
              <p className="text-3xl font-bold text-purple-900">{formatCurrency(projectTracking.totals.margin, currency)}</p>
              <p className="text-xs text-purple-600 mt-1">{projectTracking.totals.marginPct.toFixed(1)}% margin</p>
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Draft */}
            {visibility.showDraftStatus && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-yellow-700 uppercase">🟡 DRAFT</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('DRAFT')}`}>
                    {projectTracking.byStatus.draft.count}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Hours:</span>
                    <span className="font-semibold text-yellow-900">{projectTracking.byStatus.draft.hours.toFixed(1)}h</span>
                  </div>
                  {visibility.showCosts && (
                    <div className="flex justify-between">
                      <span className="text-yellow-700">Cost:</span>
                      <span className="font-semibold text-yellow-900">{formatCurrency(projectTracking.byStatus.draft.cost, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Bill:</span>
                    <span className="font-semibold text-yellow-900">{formatCurrency(projectTracking.byStatus.draft.billing, currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submitted */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-orange-700 uppercase">🟠 SUBMITTED</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('SUBMITTED')}`}>
                  {projectTracking.byStatus.submitted.count}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-700">Hours:</span>
                  <span className="font-semibold text-orange-900">{projectTracking.byStatus.submitted.hours.toFixed(1)}h</span>
                </div>
                {visibility.showCosts && (
                  <div className="flex justify-between">
                    <span className="text-orange-700">Cost:</span>
                    <span className="font-semibold text-orange-900">{formatCurrency(projectTracking.byStatus.submitted.cost, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-orange-700">Bill:</span>
                  <span className="font-semibold text-orange-900">{formatCurrency(projectTracking.byStatus.submitted.billing, currency)}</span>
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-green-700 uppercase">🟢 APPROVED</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('APPROVED')}`}>
                  {projectTracking.byStatus.approved.count}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Hours:</span>
                  <span className="font-semibold text-green-900">{projectTracking.byStatus.approved.hours.toFixed(1)}h</span>
                </div>
                {visibility.showCosts && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Cost:</span>
                    <span className="font-semibold text-green-900">{formatCurrency(projectTracking.byStatus.approved.cost, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-green-700">Bill:</span>
                  <span className="font-semibold text-green-900">{formatCurrency(projectTracking.byStatus.approved.billing, currency)}</span>
                </div>
              </div>
            </div>

            {/* Rejected */}
            {visibility.showRejectedStatus && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-red-700 uppercase">🔴 REJECTED</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor('REJECTED')}`}>
                    {projectTracking.byStatus.rejected.count}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-700">Hours:</span>
                    <span className="font-semibold text-red-900">{projectTracking.byStatus.rejected.hours.toFixed(1)}h</span>
                  </div>
                  {visibility.showCosts && (
                    <div className="flex justify-between">
                      <span className="text-red-700">Cost:</span>
                      <span className="font-semibold text-red-900">{formatCurrency(projectTracking.byStatus.rejected.cost, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-red-700">Bill:</span>
                    <span className="font-semibold text-red-900">{formatCurrency(projectTracking.byStatus.rejected.billing, currency)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subcontractor Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Subcontractor Breakdown</h3>
            <p className="text-sm text-gray-600">
              {projectTracking.subcontractors.length} subcontractor{projectTracking.subcontractors.length !== 1 ? 's' : ''} with activity
            </p>
          </div>

          {projectTracking.subcontractors.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Activity Yet</h4>
              <p className="text-gray-600">Time logs and expenses will appear here once work begins.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projectTracking.subcontractors.map((sub) => (
                <div key={sub.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  {/* Subcontractor Header */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {sub.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{sub.name}</h4>
                          <p className="text-sm text-gray-600">
                            {sub.totalHours.toFixed(1)}h logged • {sub.timeLogs.length + sub.expenses.length} entries
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {visibility.showCosts && (
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total Cost</p>
                            <p className="text-xl font-bold text-red-600">{formatCurrency(sub.totalCost, currency)}</p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Total Bill</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(sub.totalBilling, currency)}</p>
                        </div>
                        {visibility.showMargins && (
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Margin</p>
                            <p className={`text-xl font-bold ${sub.marginPct >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {sub.marginPct.toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty/Hours</th>
                          {visibility.showCosts && (
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                          )}
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Bill</th>
                          {visibility.showMargins && (
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Margin</th>
                          )}
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                          {visibility.allowClientNotes && (
                            <th className="px-4 py-3 text-center font-semibold text-gray-700">Conversation</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* Time Logs */}
                        {sub.timeLogs.map((log) => {
                          const totalHours = (log.hoursRegular || 0) + (log.hoursOT || 0);
                          const margin = (log.clientBill || 0) - (log.subCost || 0);
                          const marginPct = log.clientBill && log.clientBill > 0
                            ? ((margin / log.clientBill) * 100).toFixed(1)
                            : '0.0';

                          // Filter by status visibility
                          const status = log.status.toUpperCase();
                          if (status === 'DRAFT' && !visibility.showDraftStatus) return null;
                          if (status === 'REJECTED' && !visibility.showRejectedStatus) return null;

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
                              {visibility.showCosts && (
                                <td className="px-4 py-3 text-right font-semibold text-red-700">
                                  {formatCurrency(log.subCost, currency)}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {formatCurrency(log.clientBill || 0, currency)}
                              </td>
                              {visibility.showMargins && (
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
                              )}
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(log.status)}`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-left">
                                {log.notes ? (
                                  <div className="max-w-xs">
                                    <p className="text-sm text-gray-700 truncate" title={log.notes}>
                                      {log.notes}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              {visibility.allowClientNotes && (
                                <td className="px-4 py-3 text-center">
                                  <button 
                                    onClick={() => setSelectedLineItem({
                                      itemId: log.id,
                                      itemType: 'timeLog',
                                      itemDescription: `${log.roleName} - ${formatDate(log.date)} - ${totalHours.toFixed(1)}h`
                                    })}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="View conversation"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {/* Expenses */}
                        {sub.expenses.map((exp) => {
                          const status = exp.status.toUpperCase();
                          if (status === 'DRAFT' && !visibility.showDraftStatus) return null;
                          if (status === 'REJECTED' && !visibility.showRejectedStatus) return null;

                          const billing = exp.clientBillAmount ?? exp.amount;
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
                              <td className="px-4 py-3 text-center text-gray-900">
                                {exp.quantity ? exp.quantity.toFixed(1) : '1'}
                                {exp.unitRate && (
                                  <span className="text-xs text-gray-500"> @ {formatCurrency(exp.unitRate, currency)}</span>
                                )}
                              </td>
                              {visibility.showCosts && (
                                <td className="px-4 py-3 text-right font-semibold text-red-700">
                                  {formatCurrency(exp.amount, currency)}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {formatCurrency(billing, currency)}
                              </td>
                              {visibility.showMargins && (
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
                              )}
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(exp.status)}`}>
                                  {exp.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-left">
                                {exp.description ? (
                                  <div className="max-w-xs">
                                    <p className="text-sm text-gray-700 truncate" title={exp.description}>
                                      {exp.description}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              {visibility.allowClientNotes && (
                                <td className="px-4 py-3 text-center">
                                  <button 
                                    onClick={() => setSelectedLineItem({
                                      itemId: exp.id,
                                      itemType: 'expense',
                                      itemDescription: `${exp.category} - ${formatDate(exp.date)} - ${formatCurrency(billing, currency)}`
                                    })}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="View conversation"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        {visibility.allowClientNotes && (
          <div className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              💬 <strong>Have questions?</strong> Click the message icon in the "Conversation" column to discuss any line item with your contractor. The "Notes" column shows subcontractor entry notes.
            </p>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {selectedLineItem && (
        <LineItemNotesModal
          itemId={selectedLineItem.itemId}
          itemType={selectedLineItem.itemType}
          itemDescription={selectedLineItem.itemDescription}
          projectId={projectId}
          clientOrgId={clientOrgId}
          contractorCompanyId={contractorCompanyId}
          onClose={() => setSelectedLineItem(null)}
          allowClientNotes={visibility.allowClientNotes}
        />
      )}
    </DashboardLayout>
  );
}
