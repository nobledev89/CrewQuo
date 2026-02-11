'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Clock, ArrowLeft, Calendar, DollarSign, Briefcase, Users } from 'lucide-react';
import Link from 'next/link';
import { useClientFilter } from '@/lib/ClientFilterContext';
import DashboardLayout from '@/components/DashboardLayout';

interface TimeLog {
  id: string;
  projectId: string;
  projectName?: string;
  subcontractorId: string;
  subcontractorName?: string;
  roleId: string;
  roleName?: string;
  date: any;
  hoursRegular: number;
  hoursOT: number;
  subCost: number;
  clientBill: number;
  marginValue: number;
  marginPct: number;
  currency: string;
  status: string;
  notes: string;
}

export default function LogsPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get client filter from context
  const { selectedClient } = useClientFilter();

  // Redirect subcontractors to their workspace
  useEffect(() => {
    if (!authLoading && userData && userData.role === 'SUBCONTRACTOR') {
      router.push('/dashboard/my-work/summary');
    }
  }, [authLoading, userData, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Fetch user data
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userCompanyId = userData.companyId;
            
            // Get project IDs for client filtering if in client workspace
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
            
            // Fetch time logs
            const logsQuery = query(
              collection(db, 'timeLogs'),
              where('companyId', '==', userCompanyId),
              orderBy('date', 'desc')
            );
            const logsSnap = await getDocs(logsQuery);
            
            // Fetch related data
            const projectsQuery = query(collection(db, 'projects'), where('companyId', '==', userCompanyId));
            const projectsSnap = await getDocs(projectsQuery);
            const projectsMap = new Map();
            projectsSnap.forEach(doc => projectsMap.set(doc.id, doc.data().name));
            
            const subsQuery = query(collection(db, 'subcontractors'), where('companyId', '==', userCompanyId));
            const subsSnap = await getDocs(subsQuery);
            const subsMap = new Map();
            subsSnap.forEach(doc => subsMap.set(doc.id, doc.data().name));
            
            const rolesSnap = await getDocs(collection(db, 'roleCatalog'));
            const rolesMap = new Map();
            rolesSnap.forEach(doc => rolesMap.set(doc.id, doc.data().name));
            
            const logsData = logsSnap.docs
              .map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  projectId: data.projectId,
                  projectName: projectsMap.get(data.projectId) || 'Unknown',
                  subcontractorId: data.subcontractorId,
                  subcontractorName: subsMap.get(data.subcontractorId) || 'Unknown',
                  roleId: data.roleId,
                  roleName: rolesMap.get(data.roleId) || 'Unknown',
                  date: data.date,
                  hoursRegular: data.hoursRegular,
                  hoursOT: data.hoursOT,
                  subCost: data.subCost,
                  clientBill: data.clientBill,
                  marginValue: data.marginValue,
                  marginPct: data.marginPct,
                  currency: data.currency,
                  status: data.status,
                  notes: data.notes || '',
                };
              })
              .filter(log => {
                // Filter by client workspace if active
                if (clientProjectIds) {
                  return clientProjectIds.includes(log.projectId);
                }
                return true; // Show all logs if no client filter
              });
            
            setLogs(logsData);
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, selectedClient.clientId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading || authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading time logs...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Don't render if subcontractor (will be redirected)
  if (userData && userData.role === 'SUBCONTRACTOR') {
    return null;
  }

  const totalRegularHours = logs.reduce((sum, log) => sum + log.hoursRegular, 0);
  const totalOTHours = logs.reduce((sum, log) => sum + log.hoursOT, 0);
  const totalCost = logs.reduce((sum, log) => sum + log.subCost, 0);
  const totalBilling = logs.reduce((sum, log) => sum + log.clientBill, 0);
  const totalMargin = logs.reduce((sum, log) => sum + log.marginValue, 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        {logs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{totalRegularHours + totalOTHours}h</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalRegularHours}h regular + {totalOTHours}h OT
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCost, logs[0].currency)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Billing</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalBilling, logs[0].currency)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Margin</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalMargin, logs[0].currency)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {((totalMargin / totalBilling) * 100).toFixed(1)}% margin
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedClient.clientId ? `Time Logs for ${selectedClient.clientName}` : 'All Time Logs'}
          </h2>
          <p className="text-gray-600 mt-1">
            {selectedClient.clientId 
              ? `Showing ${logs.length} ${logs.length === 1 ? 'log' : 'logs'} for this client`
              : `Total: ${logs.length} ${logs.length === 1 ? 'log' : 'logs'}`}
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No time logs yet</h3>
            <p className="text-gray-600">Time logs will appear here once created.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{log.projectName}</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {log.subcontractorName} • {log.roleName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(log.date)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Regular Hours</p>
                    <p className="text-lg font-bold text-blue-900">{log.hoursRegular}h</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="text-xs text-purple-600 mb-1">OT Hours</p>
                    <p className="text-lg font-bold text-purple-900">{log.hoursOT}h</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <p className="text-xs text-red-600 mb-1">Cost</p>
                    <p className="text-lg font-bold text-red-900">{formatCurrency(log.subCost, log.currency)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Billing</p>
                    <p className="text-lg font-bold text-green-900">{formatCurrency(log.clientBill, log.currency)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-xs text-amber-600 mb-1">Margin</p>
                    <p className="text-lg font-bold text-amber-900">{formatCurrency(log.marginValue, log.currency)}</p>
                    <p className="text-xs text-amber-600 mt-1">{log.marginPct.toFixed(1)}%</p>
                  </div>
                </div>

                {log.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-sm text-gray-700">{log.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
