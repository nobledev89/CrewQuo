'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart3, ArrowLeft, TrendingUp, DollarSign, Percent } from 'lucide-react';
import Link from 'next/link';

interface ReportData {
  totalProjects: number;
  activeProjects: number;
  totalSubcontractors: number;
  totalClients: number;
  totalTimeLogs: number;
  totalRegularHours: number;
  totalOTHours: number;
  totalCost: number;
  totalBilling: number;
  totalMargin: number;
  marginPercentage: number;
  currency: string;
}

interface ProjectStats {
  projectId: string;
  projectName: string;
  hours: number;
  cost: number;
  billing: number;
  margin: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Fetch user data
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userCompanyId = userData.companyId;
            
            // Fetch all data
            const projectsQuery = query(collection(db, 'projects'), where('companyId', '==', userCompanyId));
            const projectsSnap = await getDocs(projectsQuery);
            const activeProjects = projectsSnap.docs.filter(doc => doc.data().status === 'ACTIVE').length;
            
            const subsQuery = query(collection(db, 'subcontractors'), where('companyId', '==', userCompanyId));
            const subsSnap = await getDocs(subsQuery);
            
            const clientsQuery = query(collection(db, 'clients'), where('companyId', '==', userCompanyId));
            const clientsSnap = await getDocs(clientsQuery);
            
            const logsQuery = query(collection(db, 'timeLogs'), where('companyId', '==', userCompanyId));
            const logsSnap = await getDocs(logsQuery);
            
            // Calculate totals
            let totalRegularHours = 0;
            let totalOTHours = 0;
            let totalCost = 0;
            let totalBilling = 0;
            let totalMargin = 0;
            let currency = 'GBP';
            
            // Project stats map
            const projectStatsMap = new Map<string, { hours: number; cost: number; billing: number; margin: number }>();
            
            logsSnap.forEach(logDoc => {
              const log = logDoc.data();
              totalRegularHours += log.hoursRegular || 0;
              totalOTHours += log.hoursOT || 0;
              totalCost += log.subCost || 0;
              totalBilling += log.clientBill || 0;
              totalMargin += log.marginValue || 0;
              currency = log.currency || 'GBP';
              
              // Aggregate by project
              const projectId = log.projectId;
              if (!projectStatsMap.has(projectId)) {
                projectStatsMap.set(projectId, { hours: 0, cost: 0, billing: 0, margin: 0 });
              }
              const stats = projectStatsMap.get(projectId)!;
              stats.hours += (log.hoursRegular || 0) + (log.hoursOT || 0);
              stats.cost += log.subCost || 0;
              stats.billing += log.clientBill || 0;
              stats.margin += log.marginValue || 0;
            });
            
            // Build project stats with names
            const projectsMap = new Map<string, string>();
            projectsSnap.forEach(doc => {
              projectsMap.set(doc.id, doc.data().name);
            });
            
            const projectStatsArray = Array.from(projectStatsMap.entries()).map(([projectId, stats]) => ({
              projectId,
              projectName: projectsMap.get(projectId) || 'Unknown Project',
              hours: stats.hours,
              cost: stats.cost,
              billing: stats.billing,
              margin: stats.margin,
            })).sort((a, b) => b.billing - a.billing);
            
            setReportData({
              totalProjects: projectsSnap.size,
              activeProjects,
              totalSubcontractors: subsSnap.size,
              totalClients: clientsSnap.size,
              totalTimeLogs: logsSnap.size,
              totalRegularHours,
              totalOTHours,
              totalCost,
              totalBilling,
              totalMargin,
              marginPercentage: totalBilling > 0 ? (totalMargin / totalBilling) * 100 : 0,
              currency,
            });
            
            setProjectStats(projectStatsArray);
          }
        } catch (error) {
          console.error('Error fetching report data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Reports
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Business Overview</h2>
          <p className="text-gray-600 mt-1">Comprehensive analytics and insights</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Projects</p>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {reportData.activeProjects} active
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{reportData.totalProjects}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Subcontractors</p>
            <p className="text-3xl font-bold text-gray-900">{reportData.totalSubcontractors}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Clients</p>
            <p className="text-3xl font-bold text-gray-900">{reportData.totalClients}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Time Logs</p>
            <p className="text-3xl font-bold text-gray-900">{reportData.totalTimeLogs}</p>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-lg p-8 text-white mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <DollarSign className="w-8 h-8" />
            <h3 className="text-2xl font-bold">Financial Overview</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-green-100 text-sm mb-2">Total Hours</p>
              <p className="text-3xl font-bold">{reportData.totalRegularHours + reportData.totalOTHours}h</p>
              <p className="text-green-100 text-xs mt-1">
                {reportData.totalRegularHours}h regular + {reportData.totalOTHours}h OT
              </p>
            </div>
            
            <div>
              <p className="text-green-100 text-sm mb-2">Total Cost</p>
              <p className="text-3xl font-bold">{formatCurrency(reportData.totalCost, reportData.currency)}</p>
              <p className="text-green-100 text-xs mt-1">Subcontractor costs</p>
            </div>
            
            <div>
              <p className="text-green-100 text-sm mb-2">Total Billing</p>
              <p className="text-3xl font-bold">{formatCurrency(reportData.totalBilling, reportData.currency)}</p>
              <p className="text-green-100 text-xs mt-1">Client billing</p>
            </div>
            
            <div>
              <p className="text-green-100 text-sm mb-2">Total Margin</p>
              <p className="text-3xl font-bold">{formatCurrency(reportData.totalMargin, reportData.currency)}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Percent className="w-4 h-4 text-green-100" />
                <p className="text-green-100 text-xs">{reportData.marginPercentage.toFixed(1)}% margin</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        {projectStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Project Breakdown</h3>
            </div>
            
            <div className="space-y-4">
              {projectStats.map((project, index) => (
                <div key={project.projectId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <h4 className="font-bold text-gray-900">{project.projectName}</h4>
                    </div>
                    <span className="text-sm text-gray-600">{project.hours}h total</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                      <p className="text-xs text-red-600 mb-1">Cost</p>
                      <p className="text-lg font-bold text-red-900">{formatCurrency(project.cost, reportData.currency)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 mb-1">Billing</p>
                      <p className="text-lg font-bold text-green-900">{formatCurrency(project.billing, reportData.currency)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-600 mb-1">Margin</p>
                      <p className="text-lg font-bold text-blue-900">{formatCurrency(project.margin, reportData.currency)}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {((project.margin / project.billing) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reportData.totalTimeLogs === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No data yet</h3>
            <p className="text-gray-600">Reports will be generated once time logs are created.</p>
          </div>
        )}
      </main>
    </div>
  );
}
