'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Building2, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  UserWithCompany, 
  CompanyWithStats, 
  SystemStats,
  SubscriptionPlan,
  SubscriptionStatus 
} from '@/lib/types';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Data states
  const [users, setUsers] = useState<UserWithCompany[]>([]);
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalCompanies: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    inactiveSubscriptions: 0,
    monthlyRecurringRevenue: 0,
    subscriptionsByPlan: {
      free: 0,
      starter: 0,
      professional: 0,
      enterprise: 0
    }
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<SubscriptionPlan | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'companies'>('overview');

  // Pricing configuration (default values)
  const [pricing] = useState({
    free: 0,
    starter: 29,
    professional: 79,
    enterprise: 199
  });

  // Check super admin status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const tokenResult = await currentUser.getIdTokenResult();
        if (tokenResult.claims.isSuperAdmin === true) {
          setIsSuperAdmin(true);
          loadData();
        } else {
          // Not a super admin, redirect
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load companies
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData: CompanyWithStats[] = companiesSnapshot.docs.map(doc => {
        const data = doc.data();
        const trialEndsAt = data.trialEndsAt;
        const trialDaysRemaining = trialEndsAt 
          ? Math.ceil((trialEndsAt.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;

        return {
          id: doc.id,
          ...data,
          trialDaysRemaining
        } as CompanyWithStats;
      });
      setCompanies(companiesData);

      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserWithCompany[] = usersSnapshot.docs.map(doc => {
        const userData = doc.data();
        const company = companiesData.find(c => c.id === userData.ownCompanyId);
        
        const trialEndsAt = company?.trialEndsAt;
        const trialDaysRemaining = trialEndsAt 
          ? Math.ceil((trialEndsAt.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;

        return {
          uid: doc.id,
          ...userData,
          companyName: company?.name,
          trialDaysRemaining
        } as UserWithCompany;
      });
      setUsers(usersData);

      // Calculate stats
      const activeCount = usersData.filter(u => u.subscriptionStatus === 'active').length;
      const trialCount = usersData.filter(u => u.subscriptionStatus === 'trial').length;
      const inactiveCount = usersData.filter(u => u.subscriptionStatus === 'inactive').length;

      const planCounts = {
        free: usersData.filter(u => u.subscriptionPlan === 'free' && u.subscriptionStatus === 'active').length,
        starter: usersData.filter(u => u.subscriptionPlan === 'starter' && u.subscriptionStatus === 'active').length,
        professional: usersData.filter(u => u.subscriptionPlan === 'professional' && u.subscriptionStatus === 'active').length,
        enterprise: usersData.filter(u => u.subscriptionPlan === 'enterprise' && u.subscriptionStatus === 'active').length
      };

      const mrr = (
        planCounts.free * pricing.free +
        planCounts.starter * pricing.starter +
        planCounts.professional * pricing.professional +
        planCounts.enterprise * pricing.enterprise
      );

      setStats({
        totalUsers: usersData.length,
        totalCompanies: companiesData.length,
        activeSubscriptions: activeCount,
        trialSubscriptions: trialCount,
        inactiveSubscriptions: inactiveCount,
        monthlyRecurringRevenue: mrr,
        subscriptionsByPlan: planCounts
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async (userId: string, plan: SubscriptionPlan, status: SubscriptionStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        subscriptionPlan: plan,
        subscriptionStatus: status,
        updatedAt: Timestamp.now()
      });

      // Also update company
      const userToUpdate = users.find(u => u.uid === userId);
      if (userToUpdate?.ownCompanyId) {
        const companyRef = doc(db, 'companies', userToUpdate.ownCompanyId);
        await updateDoc(companyRef, {
          subscriptionPlan: plan,
          subscriptionStatus: status,
          updatedAt: Timestamp.now()
        });
      }

      alert('Subscription updated successfully!');
      loadData();
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Error updating subscription');
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        subscriptionStatus: 'inactive' as SubscriptionStatus,
        updatedAt: Timestamp.now()
      });

      alert('User suspended successfully!');
      loadData();
    } catch (error) {
      console.error('Error suspending user:', error);
      alert('Error suspending user');
    }
  };

  const handleExtendTrial = async (userId: string, days: number) => {
    try {
      const userToUpdate = users.find(u => u.uid === userId);
      if (!userToUpdate?.ownCompanyId) return;

      const companyRef = doc(db, 'companies', userToUpdate.ownCompanyId);
      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      await updateDoc(companyRef, {
        trialEndsAt: Timestamp.fromDate(newTrialEnd),
        updatedAt: Timestamp.now()
      });

      alert(`Trial extended by ${days} days!`);
      loadData();
    } catch (error) {
      console.error('Error extending trial:', error);
      alert('Error extending trial');
    }
  };

  const exportToCSV = () => {
    const csvData = users.map(u => ({
      Email: u.email,
      Name: `${u.firstName} ${u.lastName}`,
      Company: u.companyName || '',
      Role: u.role,
      Plan: u.subscriptionPlan,
      Status: u.subscriptionStatus,
      'Trial Days': u.trialDaysRemaining || '',
      Created: new Date(u.createdAt.toDate()).toLocaleDateString()
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = filterPlan === 'all' || u.subscriptionPlan === filterPlan;
    const matchesStatus = filterStatus === 'all' || u.subscriptionStatus === filterStatus;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading super admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔐 Super Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Complete system overview and management</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Total Users</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
            <p className="text-sm text-gray-600 mt-1">Registered accounts</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Companies</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalCompanies}</p>
            <p className="text-sm text-gray-600 mt-1">Active organizations</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Subscriptions</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.activeSubscriptions}</p>
            <p className="text-sm text-gray-600 mt-1">
              {stats.trialSubscriptions} on trial · {stats.inactiveSubscriptions} inactive
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">MRR</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">£{stats.monthlyRecurringRevenue}</p>
            <p className="text-sm text-gray-600 mt-1">Monthly recurring revenue</p>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Subscription Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{stats.subscriptionsByPlan.free}</p>
              <p className="text-sm text-gray-600 mt-1">Free Plan</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{stats.subscriptionsByPlan.starter}</p>
              <p className="text-sm text-blue-600 mt-1">Starter (£{pricing.starter}/mo)</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-900">{stats.subscriptionsByPlan.professional}</p>
              <p className="text-sm text-purple-600 mt-1">Professional (£{pricing.professional}/mo)</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-900">{stats.subscriptionsByPlan.enterprise}</p>
              <p className="text-sm text-orange-600 mt-1">Enterprise (£{pricing.enterprise}/mo)</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'overview'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'users'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'companies'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Companies ({companies.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search and Filters */}
            {activeTab === 'users' && (
              <>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-700">
                        <th className="pb-3">Email</th>
                        <th className="pb-3">Name</th>
                        <th className="pb-3">Company</th>
                        <th className="pb-3">Plan</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Trial Days</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.uid} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 text-sm">{user.email}</td>
                          <td className="py-4 text-sm">{user.firstName} {user.lastName}</td>
                          <td className="py-4 text-sm">{user.companyName}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              user.subscriptionPlan === 'enterprise' ? 'bg-orange-100 text-orange-700' :
                              user.subscriptionPlan === 'professional' ? 'bg-purple-100 text-purple-700' :
                              user.subscriptionPlan === 'starter' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {user.subscriptionPlan}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                              user.subscriptionStatus === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {user.subscriptionStatus}
                            </span>
                          </td>
                          <td className="py-4 text-sm">
                            {user.subscriptionStatus === 'trial' && user.trialDaysRemaining !== undefined ? (
                              <span className={user.trialDaysRemaining < 7 ? 'text-red-600 font-semibold' : ''}>
                                {user.trialDaysRemaining} days
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const newPlan = prompt('Enter new plan (free/starter/professional/enterprise):');
                                  const newStatus = prompt('Enter new status (active/trial/inactive):');
                                  if (newPlan && newStatus) {
                                    handleUpdateSubscription(user.uid, newPlan as SubscriptionPlan, newStatus as SubscriptionStatus);
                                  }
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Update subscription"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSuspendUser(user.uid)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Suspend user"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              {user.subscriptionStatus === 'trial' && (
                                <button
                                  onClick={() => {
                                    const days = prompt('Extend trial by how many days?');
                                    if (days) handleExtendTrial(user.uid, parseInt(days));
                                  }}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Extend trial"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'companies' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-700">
                      <th className="pb-3">Company Name</th>
                      <th className="pb-3">Owner</th>
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Trial Days</th>
                      <th className="pb-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => {
                      const owner = users.find(u => u.uid === company.ownerId);
                      return (
                        <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 text-sm font-medium">{company.name}</td>
                          <td className="py-4 text-sm">{owner?.email || 'Unknown'}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              company.subscriptionPlan === 'enterprise' ? 'bg-orange-100 text-orange-700' :
                              company.subscriptionPlan === 'professional' ? 'bg-purple-100 text-purple-700' :
                              company.subscriptionPlan === 'starter' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {company.subscriptionPlan}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              company.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                              company.subscriptionStatus === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {company.subscriptionStatus}
                            </span>
                          </td>
                          <td className="py-4 text-sm">
                            {company.subscriptionStatus === 'trial' && company.trialDaysRemaining !== undefined ? (
                              <span className={company.trialDaysRemaining < 7 ? 'text-red-600 font-semibold' : ''}>
                                {company.trialDaysRemaining} days
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-4 text-sm text-gray-600">
                            {new Date(company.createdAt.toDate()).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                  <p className="text-gray-600">System activity monitoring coming soon...</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Trial Expiring Soon</h3>
                  <div className="space-y-2">
                    {users
                      .filter(u => u.subscriptionStatus === 'trial' && u.trialDaysRemaining !== undefined && u.trialDaysRemaining < 7)
                      .map(u => (
                        <div key={u.uid} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-900">{u.email}</p>
                            <p className="text-sm text-gray-600">{u.companyName}</p>
                          </div>
                          <span className="text-red-600 font-semibold">{u.trialDaysRemaining} days left</span>
                        </div>
                      ))}
                    {users.filter(u => u.subscriptionStatus === 'trial' && u.trialDaysRemaining !== undefined && u.trialDaysRemaining < 7).length === 0 && (
                      <p className="text-gray-500">No trials expiring soon</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
