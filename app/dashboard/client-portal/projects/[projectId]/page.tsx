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
import { ArrowLeft, Activity, Clock, DollarSign, TrendingUp, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import LineItemNotesModal from '@/components/LineItemNotesModal';
import DownloadProgressBar from '@/components/DownloadProgressBar';
import SubcontractorCostBreakdown from '@/components/SubcontractorCostBreakdown';
import { getProjectVisibilitySettings } from '@/lib/clientAccessUtils';
import { exportToCSV, exportToXLSX, exportToPDF } from '@/lib/projectExportUtils';
import { getUnresolvedNotesCounts } from '@/lib/lineItemNotesUtils';
import {
  aggregateProjectCosts,
  formatCurrency,
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

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'CSV' | 'XLSX' | 'PDF' | null>(null);

  // Notes conversation state
  const [unresolvedNotesMap, setUnresolvedNotesMap] = useState<Map<string, number>>(new Map());

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

  const handleDownload = async (format: 'CSV' | 'XLSX' | 'PDF') => {
    if (!project || !projectTracking) return;

    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      // Small delay to show the loading indicator
      await new Promise(resolve => setTimeout(resolve, 500));

      const exportOptions = {
        projectCode: project.projectCode,
        projectName: project.name,
        location: project.location,
        status: project.status,
        projectTracking,
        timeLogs,
        expenses,
        visibility,
        currency,
      };

      switch (format) {
        case 'CSV':
          exportToCSV(exportOptions);
          break;
        case 'XLSX':
          exportToXLSX(exportOptions);
          break;
        case 'PDF':
          exportToPDF(exportOptions);
          break;
      }
    } catch (error) {
      console.error('Error exporting project:', error);
      alert('Failed to export project. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  };

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
          entryStartTime: data.entryStartTime,
          entryEndTime: data.entryEndTime,
          segmentStartTime: data.segmentStartTime,
          segmentEndTime: data.segmentEndTime,
          createdAt: data.createdAt,
          unitSubCost: data.unitSubCost,
          unitClientBill: data.unitClientBill,
          timeframeId: data.timeframeId,
          payRateCardId: data.payRateCardId,
          billRateCardId: data.billRateCardId,
          splitGroupId: data.splitGroupId,
          splitIndex: data.splitIndex,
          splitTotal: data.splitTotal,
          projectId: data.projectId,
          createdByUserId: data.createdByUserId,
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

      // Fetch unresolved notes counts for all line items
      const allItemIds = [...logsData.map(log => log.id), ...expensesData.map(exp => exp.id)];
      if (allItemIds.length > 0) {
        const notesCountsMap = await getUnresolvedNotesCounts(allItemIds);
        setUnresolvedNotesMap(notesCountsMap);
      }
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
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload('XLSX')}
                  disabled={isDownloading}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download as Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>XLSX</span>
                </button>
                <button
                  onClick={() => handleDownload('CSV')}
                  disabled={isDownloading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download as CSV"
                >
                  <FileText className="w-4 h-4" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleDownload('PDF')}
                  disabled={isDownloading}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download as PDF"
                >
                  <FileDown className="w-4 h-4" />
                  <span>PDF</span>
                </button>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
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
                <div className="mb-3">
                  <span className="text-xs font-semibold text-yellow-700 uppercase">🟡 DRAFT</span>
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
              <div className="mb-3">
                <span className="text-xs font-semibold text-orange-700 uppercase">🟠 SUBMITTED</span>
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
              <div className="mb-3">
                <span className="text-xs font-semibold text-green-700 uppercase">🟢 APPROVED</span>
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
                <div className="mb-3">
                  <span className="text-xs font-semibold text-red-700 uppercase">🔴 REJECTED</span>
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
                <SubcontractorCostBreakdown
                  key={sub.id}
                  subcontractor={sub}
                  currency={currency}
                  showLineItems={true}
                  showCosts={visibility.showCosts}
                  showMargins={visibility.showMargins}
                  showDraftStatus={visibility.showDraftStatus}
                  showRejectedStatus={visibility.showRejectedStatus}
                  unresolvedNotesMap={visibility.allowClientNotes ? unresolvedNotesMap : undefined}
                  onOpenConversation={
                    visibility.allowClientNotes
                      ? (itemId, itemType, description) => {
                          setSelectedLineItem({
                            itemId,
                            itemType,
                            itemDescription: description,
                          });
                        }
                      : undefined
                  }
                />
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

      {/* Download Progress Bar */}
      <DownloadProgressBar format={downloadFormat} isVisible={isDownloading} />
    </DashboardLayout>
  );
}

