'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ClientFilterProvider, useClientFilter } from '../lib/ClientFilterContext';
import TrialBanner from './TrialBanner';
import { 
  Layers, 
  Home,
  Briefcase,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
  Check,
  FileText,
  Settings
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface UserData {
  email: string;
  name: string;
  role: string;
  companyId: string;
}

interface CompanyData {
  name: string;
  subscriptionStatus?: string;
  trialEndsAt?: any;
}

// Inner component that uses the context
function DashboardContent({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showClientMenu, setShowClientMenu] = useState(false);

  // Client context for filtering
  const { clients, selectedClient, selectClient, clearClientSelection, hasClients } = useClientFilter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Fetch user data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
          
          // Fetch company data
          const companyId = data.companyId;
          if (companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
              setCompanyData(companyDoc.data() as CompanyData);
            }
          }
        }
        
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Navigation items - Rate Cards only shown in own company workspace
  const getNavItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Projects', href: '/dashboard/projects', icon: Briefcase },
      { name: 'Subcontractors', href: '/dashboard/subcontractors', icon: Users },
    ];
    
    // Only show Rate Cards when viewing own company (not client-specific workspace)
    if (selectedClient.clientId === null) {
      baseItems.push({ name: 'Rate Cards', href: '/dashboard/ratecards', icon: FileText });
    }
    
    baseItems.push({ name: 'Reports', href: '/dashboard/reports', icon: BarChart3 });
    
    return baseItems;
  };
  
  const navItems = getNavItems();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              CrewQuo
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white shadow-xl border-r border-gray-200 z-50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 px-6 border-b border-gray-200 flex items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CrewQuo
              </h1>
              {companyData && (
                <p className="text-xs text-gray-600 truncate">{companyData.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Selector - Always show */}
        <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
          <div className="mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workspace</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowClientMenu(!showClientMenu)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 rounded-lg transition border-2 border-gray-200 hover:border-blue-300 shadow-sm group"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedClient.clientId 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                    : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                }`}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {selectedClient.clientName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedClient.clientId ? 'Client Workspace' : 'All Clients'}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showClientMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Workspace Dropdown */}
            {showClientMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowClientMenu(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 py-2 max-h-80 overflow-y-auto">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Switch Workspace</p>
                  </div>
                  
                  {/* My Company - All Clients */}
                  <button
                    onClick={() => {
                      clearClientSelection();
                      setShowClientMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition flex items-center justify-between group ${
                      selectedClient.clientId === null ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900">My Company</span>
                        <span className="block text-xs text-gray-500">View all clients & projects</span>
                      </div>
                    </div>
                    {selectedClient.clientId === null && (
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </button>

                  {clients.length > 0 && (
                    <>
                      <div className="px-4 py-2 mt-2 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Workspaces</p>
                      </div>

                      {/* Individual Clients */}
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            selectClient(client.id, client.name);
                            setShowClientMenu(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-purple-50 transition flex items-center justify-between group ${
                            selectedClient.clientId === client.id ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block font-bold text-gray-900 truncate">{client.name}</span>
                              <span className="block text-xs text-gray-500">Client-specific view</span>
                            </div>
                          </div>
                          {selectedClient.clientId === client.id && (
                            <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </a>
            );
          })}
        </nav>

        {/* User Info & Sign Out */}
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
            <p className="text-xs text-gray-600">{userData?.role}</p>
          </div>
          <a
            href="/dashboard/settings"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium mb-2"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </a>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile spacing */}
        <div className="lg:hidden h-16" />
        
        {/* Trial Banner */}
        {companyData && (
          <TrialBanner 
            subscriptionStatus={companyData.subscriptionStatus || 'inactive'} 
            trialEndsAt={companyData.trialEndsAt}
          />
        )}
        
        {/* Content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

// Wrapper component that provides context
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ClientFilterProvider>
      <DashboardContent>{children}</DashboardContent>
    </ClientFilterProvider>
  );
}
