'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface UserData {
  email: string;
  name: string;
  role: string;
  companyId: string;
}

interface CompanyData {
  name: string;
  plan: string;
  currency: string;
}

interface Stats {
  projects: number;
  clients: number;
  subcontractors: number;
  rateCards: number;
}

export default function DashboardPage() {
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [stats, setStats] = useState<Stats>({ projects: 0, clients: 0, subcontractors: 0, rateCards: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Fetch user data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          
          // Fetch company data
          const companyDoc = await getDoc(doc(db, 'companies', data.companyId));
          if (companyDoc.exists()) {
            setCompanyData(companyDoc.data() as CompanyData);
          }
          
          // Fetch stats
          const projectsSnap = await getDocs(query(collection(db, 'projects'), where('companyId', '==', data.companyId)));
          const clientsSnap = await getDocs(query(collection(db, 'clients'), where('companyId', '==', data.companyId)));
          const subsSnap = await getDocs(query(collection(db, 'subcontractors'), where('companyId', '==', data.companyId)));
          const ratesSnap = await getDocs(query(collection(db, 'rateCards'), where('companyId', '==', data.companyId)));
          
          setStats({
            projects: projectsSnap.size,
            clients: clientsSnap.size,
            subcontractors: subsSnap.size,
            rateCards: ratesSnap.size,
          });
        }
        
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
            Here's an overview of your contractor management system
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
            <p className="text-3xl font-bold text-gray-900">{stats.projects}</p>
            <p className="text-sm text-gray-600 mt-1">Active projects</p>
          </a>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Clients</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.clients}</p>
            <p className="text-sm text-gray-600 mt-1">Total clients</p>
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
            <p className="text-3xl font-bold text-gray-900">{stats.subcontractors}</p>
            <p className="text-sm text-gray-600 mt-1">Active subcontractors</p>
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
            <p className="text-3xl font-bold text-gray-900">{stats.rateCards}</p>
            <p className="text-sm text-gray-600 mt-1">Configured rates</p>
          </a>
        </div>

        {/* Success Message */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg p-8 text-white mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">🎉 Setup Complete!</h3>
              <p className="text-green-50 mb-4">
                Your Corporate Spec account has been successfully created with comprehensive data:
              </p>
              <ul className="space-y-2 text-sm text-green-50">
                <li>✓ Client: PriceWater Coopers (PwC) with full rate card</li>
                <li>✓ Subcontractors: Hanmore & Family Ltd and Pashe Solutions Ltd</li>
                <li>✓ Project: PwC Office Renovation (ACTIVE)</li>
                <li>✓ {stats.rateCards} rate cards configured with multiple shift types</li>
                <li>✓ 8 job roles ready to use</li>
              </ul>
            </div>
          </div>
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
                <p className="font-semibold text-gray-900 capitalize">{companyData?.plan || 'Loading...'}</p>
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

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            💡 This is a demo dashboard. Full functionality is currently in development.
          </p>
          <p className="mt-2">
            View your data in the{' '}
            <a 
              href="http://127.0.0.1:4000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Firebase Emulator UI
            </a>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
