'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Briefcase, 
  DollarSign
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/AuthContext';
import { useStats } from '@/lib/hooks/useCompanyData';
import { useClientFilter } from '@/lib/ClientFilterContext';

export default function DashboardPage() {
  const router = useRouter();
  const { userData, companyData, loading: authLoading } = useAuth();
  const { selectedClient } = useClientFilter();
  
  // Use React Query hook for stats - automatically cached and fresh
  // Pass clientId to get client-specific stats when in workspace
  const { data: stats, isLoading: statsLoading } = useStats(userData?.companyId, selectedClient.clientId);
  
  // Default stats if not loaded yet
  const displayStats = stats || { projects: 0, clients: 0, subcontractors: 0, rateCards: 0 };

  // Redirect subcontractors to their workspace
  useEffect(() => {
    if (!authLoading && userData && userData.role === 'SUBCONTRACTOR') {
      router.push('/dashboard/my-work');
    }
  }, [authLoading, userData, router]);

  const loading = authLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-gray-600">
            {selectedClient.clientId 
              ? `Here's an overview for ${selectedClient.clientName}`
              : 'Here\'s an overview of your contractor management system'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <a 
            href="/dashboard/projects"
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Projects</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{displayStats.projects}</p>
            <p className="text-sm text-gray-600 mt-1">
              {selectedClient.clientId ? 'Client projects' : 'Active projects'}
            </p>
          </a>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Clients</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{displayStats.clients}</p>
            <p className="text-sm text-gray-600 mt-1">
              {selectedClient.clientId ? 'Current client' : 'Total clients'}
            </p>
          </div>

          <a 
            href="/dashboard/subcontractors"
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Subcontractors</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{displayStats.subcontractors}</p>
            <p className="text-sm text-gray-600 mt-1">
              {selectedClient.clientId ? 'Assigned subcontractors' : 'Active subcontractors'}
            </p>
          </a>

          <a 
            href="/dashboard/logs"
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Rate Cards</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{displayStats.rateCards}</p>
            <p className="text-sm text-gray-600 mt-1">Configured rates</p>
          </a>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Company Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Company Name</p>
                <p className="font-semibold text-gray-900">{companyData?.name || 'Loading...'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-semibold text-gray-900 capitalize">{companyData?.subscriptionPlan || 'Loading...'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Currency</p>
                <p className="font-semibold text-gray-900">{companyData?.currency || 'Loading...'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a 
                href="/dashboard/projects"
                className="block w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
              >
                View Projects →
              </a>
              <a 
                href="/dashboard/subcontractors"
                className="block w-full text-left px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
              >
                Manage Subcontractors →
              </a>
              <a 
                href="/dashboard/logs"
                className="block w-full text-left px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium"
              >
                Time Logs →
              </a>
              <a 
                href="/dashboard/reports"
                className="block w-full text-left px-4 py-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition font-medium"
              >
                Reports & Analytics →
              </a>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
