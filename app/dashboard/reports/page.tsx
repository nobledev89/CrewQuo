'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart3, TrendingUp, DollarSign, Percent, Download, Calendar, Users, Briefcase, Clock, TrendingDown } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useClientFilter } from '@/lib/ClientFilterContext';

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

interface SubcontractorStats {
  subcontractorId: string;
  subcontractorName: string;
  hours: number;
  cost: number;
  projectsCount: number;
  marginPercentage: number;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [subcontractorStats, setSubcontractorStats] = useState<SubcontractorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsSnap, setLogsSnap] = useState<any>(null);
  const [expensesSnap, setExpensesSnap] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectStats | null>(null);
  const [subsMap, setSubsMap] = useState<Map<string, string>>(new Map());
  
  // Get client filter from context
  const { selectedClient } = useClientFilter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Fetch user data
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userCompanyId = userData.activeCompanyId || userData.companyId;
            
            // Get project IDs for client filtering
            let clientProjectIds: string[] | null = null;
            if (selectedClient.clientId) {
              const clientProjectsQuery = query(
                collection(db, 'projects'),
                where('companyId', '==', userCompanyId),
                where('clientId', '==', selectedClient.clientId)
              );
              const clientProjectsSnap = await getDocs(clientProjectsQuery);
              clientProjectIds = clientProjectsSnap.docs.map(doc => doc.id);
            }
            
            // Fetch all data - filter by client if workspace is active
            let projectsQuery;
            if (selectedClient.clientId) {
              projectsQuery = query(
                collection(db, 'projects'),
                where('companyId', '==', userCompanyId),
                where('clientId', '==', selectedClient.clientId)
              );
            } else {
              projectsQuery = query(
                collection(db, 'projects'),
                where('companyId', '==', userCompanyId)
              );
            }
            const projectsSnap = await getDocs(projectsQuery);
            const activeProjects = projectsSnap.docs.filter(doc => doc.data().status === 'ACTIVE').length;
            
            const subsQuery = query(collection(db, 'subcontractors'), where('companyId', '==', userCompanyId));
            const subsSnap = await getDocs(subsQuery);
            
            const clientsQuery = query(collection(db, 'clients'), where('companyId', '==', userCompanyId));
            const clientsSnap = await getDocs(clientsQuery);
            
            const logsQuery = query(
              collection(db, 'timeLogs'),
              where('companyId', '==', userCompanyId),
              where('status', '==', 'APPROVED')
            );
            const logsSnap = await getDocs(logsQuery);
            
            const expensesQuery = query(
              collection(db, 'expenses'),
              where('companyId', '==', userCompanyId),
              where('status', '==', 'APPROVED')
            );
            const expensesSnap = await getDocs(expensesQuery);
            
            // Calculate totals
            let totalRegularHours = 0;
            let totalOTHours = 0;
            let totalSubCost = 0;
            let totalExpenses = 0;
            let totalBilling = 0;
            let totalMargin = 0;
            let currency = 'GBP';
            
            // Project stats map
            const projectStatsMap = new Map<string, { hours: number; cost: number; billing: number; margin: number }>();
            
            logsSnap.forEach(logDoc => {
              const log = logDoc.data();
              
              // Filter by client workspace if active
              if (clientProjectIds && !clientProjectIds.includes(log.projectId)) {
                return; // Skip logs not in client's projects
              }
              
              totalRegularHours += log.hoursRegular || 0;
              totalOTHours += log.hoursOT || 0;
              totalSubCost += log.subCost || 0;
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
            
            // Add expenses to totals
            expensesSnap.forEach(expDoc => {
              const exp = expDoc.data();
              
              // Filter by client workspace if active
              if (clientProjectIds && !clientProjectIds.includes(exp.projectId)) {
                return; // Skip expenses not in client's projects
              }
              
              totalExpenses += exp.amount || 0;
              currency = exp.currency || 'GBP';
              
              // Aggregate by project
              const projectId = exp.projectId;
              if (!projectStatsMap.has(projectId)) {
                projectStatsMap.set(projectId, { hours: 0, cost: 0, billing: 0, margin: 0 });
              }
              const stats = projectStatsMap.get(projectId)!;
              stats.cost += exp.amount || 0;
              // Recalculate margin as billing - cost (includes expenses now)
              stats.margin = stats.billing - stats.cost;
            });
            
            // Calculate total cost including expenses
            const totalCost = totalSubCost + totalExpenses;
            
            // Build project stats with names
            const projectsMap = new Map<string, string>();
            projectsSnap.forEach(doc => {
              projectsMap.set(doc.id, doc.data().name);
            });
            
            const projectStatsArray = Array.from(projectStatsMap.entries()).map(([projectId, stats]) => {
              // Final margin recalculation to ensure accuracy
              const finalMargin = stats.billing - stats.cost;
              return {
                projectId,
                projectName: projectsMap.get(projectId) || 'Unknown Project',
                hours: stats.hours,
                cost: stats.cost,
                billing: stats.billing,
                margin: finalMargin,
              };
            }).sort((a, b) => b.billing - a.billing);
            
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
            
            // Build subcontractor stats
            const subsMap = new Map<string, string>();
            subsSnap.forEach(doc => {
              subsMap.set(doc.id, doc.data().name);
            });
            
            const subcontractorStatsMap = new Map<string, { hours: number; cost: number; billing: number; projects: Set<string> }>();
            
            // Aggregate time logs by subcontractor
            logsSnap.forEach(logDoc => {
              const log = logDoc.data();
              
              // Filter by client workspace if active
              if (clientProjectIds && !clientProjectIds.includes(log.projectId)) {
                return; // Skip logs not in client's projects
              }
              
              const subId = log.subcontractorId;
              
              if (!subcontractorStatsMap.has(subId)) {
                subcontractorStatsMap.set(subId, { hours: 0, cost: 0, billing: 0, projects: new Set() });
              }
              
              const stats = subcontractorStatsMap.get(subId)!;
              stats.hours += (log.hoursRegular || 0) + (log.hoursOT || 0);
              stats.cost += log.subCost || 0;
              stats.billing += log.clientBill || 0;
              stats.projects.add(log.projectId);
            });
            
            // Add expenses to subcontractor costs if they have a subcontractorId
            expensesSnap.forEach(expDoc => {
              const exp = expDoc.data();
              
              // Filter by client workspace if active
              if (clientProjectIds && !clientProjectIds.includes(exp.projectId)) {
                return; // Skip expenses not in client's projects
              }
              
              // Only add expenses that are attributed to a specific subcontractor
              if (exp.subcontractorId) {
                const subId = exp.subcontractorId;
                
                if (!subcontractorStatsMap.has(subId)) {
                  subcontractorStatsMap.set(subId, { hours: 0, cost: 0, billing: 0, projects: new Set() });
                }
                
                const stats = subcontractorStatsMap.get(subId)!;
                stats.cost += exp.amount || 0;
                // Note: Expenses don't add to billing, they just increase cost
                stats.projects.add(exp.projectId);
              }
            });
            
            const subcontractorStatsArray = Array.from(subcontractorStatsMap.entries())
              .map(([subId, stats]) => {
                const margin = stats.billing - stats.cost;
                return {
                  subcontractorId: subId,
                  subcontractorName: subsMap.get(subId) || 'Unknown',
                  hours: stats.hours,
                  cost: stats.cost,
                  projectsCount: stats.projects.size,
                  marginPercentage: stats.billing > 0 ? (margin / stats.billing) * 100 : 0,
                };
              })
              .sort((a, b) => b.hours - a.hours);
            
            setSubcontractorStats(subcontractorStatsArray);
            setProjectStats(projectStatsArray);
            setLogsSnap(logsSnap);
            setExpensesSnap(expensesSnap);
            setSubsMap(subsMap);
          }
        } catch (error) {
          console.error('Error fetching report data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedClient.clientId]);

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
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedClient.clientId ? `Reports for ${selectedClient.clientName}` : 'Business Overview'}
          </h2>
          <p className="text-gray-600 mt-1">
            {selectedClient.clientId 
              ? `Client-specific analytics and insights` 
              : 'Comprehensive analytics and insights'}
          </p>
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

        {/* Subcontractor Breakdown */}
        {subcontractorStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Subcontractor Performance</h3>
            </div>
            
            <div className="space-y-4">
              {subcontractorStats.map((sub, index) => (
                <div key={sub.subcontractorId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-600">#{index + 1}</span>
                      </div>
                      <h4 className="font-bold text-gray-900">{sub.subcontractorName}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{sub.projectsCount} {sub.projectsCount === 1 ? 'project' : 'projects'}</span>
                      <span className="text-sm font-semibold text-gray-900">{sub.hours}h</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                      <p className="text-xs text-red-600 mb-1">Cost to Company</p>
                      <p className="text-lg font-bold text-red-900">{formatCurrency(sub.cost, reportData.currency)}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <p className="text-xs text-indigo-600 mb-1">Projects Active</p>
                      <p className="text-lg font-bold text-indigo-900">{sub.projectsCount}</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${sub.marginPercentage >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      <p className={`text-xs mb-1 ${sub.marginPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>Margin %</p>
                      <p className={`text-lg font-bold ${sub.marginPercentage >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                        {sub.marginPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Breakdown */}
        {projectStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Briefcase className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Project Breakdown</h3>
            </div>
            
            <div className="space-y-4">
              {projectStats.map((project, index) => (
                <div key={project.projectId} className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 transition cursor-pointer" onClick={() => setSelectedProject(project)}>
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
                  <p className="text-xs text-blue-600 mt-3 font-medium">Click to view detailed breakdown →</p>
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

        {/* Project Details Modal */}
        {selectedProject && reportData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProject.projectName}</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedProject.hours.toFixed(1)} hours tracked</p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Subcontractor</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Qty</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Cost</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Billing</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Margin</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {logsSnap && logsSnap.docs.map((logDoc: any) => {
                          const log = logDoc.data();
                          if (log.projectId !== selectedProject.projectId) return null;
                          const dateObj = log.date?.toDate ? log.date.toDate() : new Date(log.date);
                          const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          const totalHours = (log.hoursRegular || 0) + (log.hoursOT || 0);
                          const margin = (log.clientBill || 0) - (log.subCost || 0);
                          const marginPct = (log.clientBill || 0) > 0 ? (margin / (log.clientBill || 1)) * 100 : 0;
                          
                          return (
                            <tr key={logDoc.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 text-sm text-gray-600">{dateStr}</td>
                              <td className="px-6 py-3 text-sm font-medium text-gray-900">Time Log</td>
                              <td className="px-6 py-3 text-sm text-gray-900">{subsMap.get(log.subcontractorId) || log.subcontractorName || 'Unknown'}</td>
                              <td className="px-6 py-3 text-sm text-gray-900">{log.roleName || 'Unknown Role'} - {log.shiftType || 'Standard'}</td>
                              <td className="px-6 py-3 text-center text-sm text-gray-900">{totalHours.toFixed(1)}h</td>
                              <td className="px-6 py-3 text-right text-sm text-gray-900">£{(log.subCost || 0).toFixed(2)}</td>
                              <td className="px-6 py-3 text-right text-sm text-gray-900">£{(log.clientBill || 0).toFixed(2)}</td>
                              <td className="px-6 py-3 text-right text-sm font-semibold">
                                <span className={margin > 0 ? 'text-green-700' : 'text-red-700'}>
                                  £{margin.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right text-sm font-semibold">
                                <span className={marginPct > 0 ? 'text-green-700' : 'text-red-700'}>
                                  {marginPct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {expensesSnap && expensesSnap.docs.map((expDoc: any) => {
                          const exp = expDoc.data();
                          if (exp.projectId !== selectedProject.projectId) return null;
                          const dateObj = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date);
                          const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          const margin = 0; // Expenses have zero margin (cost and billing are equal)
                          
                          return (
                            <tr key={expDoc.id} className="hover:bg-gray-50 bg-gray-50">
                              <td className="px-6 py-3 text-sm text-gray-600">{dateStr}</td>
                              <td className="px-6 py-3 text-sm font-medium text-gray-900">Expense</td>
                              <td className="px-6 py-3 text-sm text-gray-900">—</td>
                              <td className="px-6 py-3 text-sm text-gray-900">{exp.category}</td>
                              <td className="px-6 py-3 text-center text-sm text-gray-900">{(exp.quantity || 1).toFixed(1)}</td>
                              <td className="px-6 py-3 text-right text-sm text-gray-900">£{(exp.amount || 0).toFixed(2)}</td>
                              <td className="px-6 py-3 text-right text-sm text-gray-900">£{(exp.amount || 0).toFixed(2)}</td>
                              <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                                £{margin.toFixed(2)}
                              </td>
                              <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                                0.0%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Project Subtotal */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Subtotal</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Cost</p>
                      <p className="text-2xl font-bold text-gray-900">£{selectedProject.cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Billing</p>
                      <p className="text-2xl font-bold text-gray-900">£{selectedProject.billing.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Margin</p>
                      <p className="text-2xl font-bold text-green-700">£{selectedProject.margin.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Margin %</p>
                      <p className="text-2xl font-bold text-green-700">
                        {selectedProject.billing > 0 ? ((selectedProject.margin / selectedProject.billing) * 100).toFixed(1) : '0.0'}%
                      </p>
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
