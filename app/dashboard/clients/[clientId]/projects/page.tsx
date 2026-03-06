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
import { FolderOpen, CheckCircle, X, ArrowLeft, Settings } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  grantProjectAccess,
  revokeProjectAccess,
  getClientAccessibleProjects,
} from '@/lib/clientAccessUtils';

interface Client {
  id: string;
  name: string;
  clientOrgId?: string;
  clientOrgName?: string;
}

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  hasAccess: boolean;
}

export default function ClientProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [tokenClaims, setTokenClaims] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const compId = userData.activeCompanyId || userData.companyId;
            setCompanyId(compId);
            setUserRole(userData.role);

            await fetchClient(clientId);
            await fetchProjects(compId, clientId);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [clientId]);

  const fetchClient = async (cId: string) => {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', cId));
      if (clientDoc.exists()) {
        setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    }
  };

  const fetchProjects = async (compId: string, cId: string) => {
    try {
      console.log('🔍 Fetching projects with:', { compId, cId });
      
      // DEBUG: Check auth token claims
      const currentUser = auth.currentUser;
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult(true); // Force refresh
        console.log('🔐 Auth Token Claims:', tokenResult.claims);
        setTokenClaims(tokenResult.claims);
      }
      
      // WORKAROUND: Fetch ALL projects using admin script results
      // Query is failing even with simplest rules, so we'll get project IDs differently
      // For now, query by companyId through /api route or fetch individually
      
      // Try to list all projects by fetching them without query
      const projectsRef = collection(db, 'projects');
      const allProjectsSnap = await getDocs(projectsRef);
      
      console.log('📊 Total projects in database:', allProjectsSnap.size);
      
      // Filter for this company and client in JavaScript
      const allProjects = allProjectsSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((project: any) => 
          project.companyId === compId && project.clientId === cId
        );
      
      console.log('📦 Filtered projects for this client:', allProjects.length);

      // Get client org access if exists
      const clientDoc = await getDoc(doc(db, 'clients', cId));
      const clientData = clientDoc.data();
      const clientOrgId = clientData?.clientOrgId;

      if (!clientOrgId) {
        // No client org yet, so no access to any projects
        setProjects(allProjects.map(p => ({ ...p, hasAccess: false } as Project)));
        return;
      }

      // Get accessible projects
      const accessibleProjects = await getClientAccessibleProjects(compId, clientOrgId);
      const accessibleProjectIds = new Set(accessibleProjects.map(a => a.projectId));

      // Mark which projects have access
      const projectsWithAccess = allProjects.map(p => ({
        ...p,
        hasAccess: accessibleProjectIds.has(p.id),
      } as Project));

      setProjects(projectsWithAccess);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleToggleAccess = async (projectId: string, currentAccess: boolean) => {
    if (!client?.clientOrgId) {
      alert('Please invite a client user first to set up the client organization.');
      return;
    }

    setToggling(projectId);
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      if (currentAccess) {
        // Revoke access
        await revokeProjectAccess(client.clientOrgId, projectId);
      } else {
        // Grant access
        await grantProjectAccess(
          companyId,
          client.clientOrgId,
          projectId,
          project.name,
          userId
        );
      }

      // Refresh projects
      await fetchProjects(companyId, clientId);
    } catch (error) {
      console.error('Error toggling access:', error);
      alert('Failed to update project access. Please try again.');
    } finally {
      setToggling(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ON_HOLD':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Client not found</h3>
            <button
              onClick={() => router.push('/dashboard/clients')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Clients</span>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const accessibleCount = projects.filter(p => p.hasAccess).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clients</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{client.name}</h2>
              <p className="text-gray-600">Grant Project Access</p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/clients/${clientId}/settings`)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Status Info */}
        {!client.clientOrgId && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>No client organization linked yet.</strong> Invite a client user first to enable project access.
            </p>
            <button
              onClick={() => router.push(`/dashboard/clients/${clientId}/users`)}
              className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
            >
              <span>Invite Client User</span>
            </button>
          </div>
        )}

        {client.clientOrgId && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Client Organization:</strong> {client.clientOrgName}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {accessibleCount} of {projects.length} projects have been granted access
            </p>
          </div>
        )}

        {/* Debug Info - TEMPORARY */}
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
          <p className="text-sm font-mono text-purple-900 whitespace-pre-wrap">
            <strong>Debug Info:</strong><br/>
            Company ID: {companyId}<br/>
            Client ID: {clientId}<br/>
            Projects Found: {projects.length}<br/>
            User Role (from Firestore): {userRole}<br/>
            <br/>
            <strong>JWT Token Claims:</strong><br/>
            {tokenClaims ? JSON.stringify(tokenClaims, null, 2) : 'Loading...'}
          </p>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Your Projects with {client.name}</h3>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h4>
              <p className="text-gray-600 mb-4">Create a project for this client first.</p>
              <button
                onClick={() => router.push('/dashboard/projects')}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <span>Go to Projects</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{project.name}</h4>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{project.projectCode}</p>
                    <p className="text-xs text-gray-500 mt-1">{project.location}</p>
                  </div>

                  {canEdit && client.clientOrgId && (
                    <button
                      onClick={() => handleToggleAccess(project.id, project.hasAccess)}
                      disabled={toggling === project.id}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                        project.hasAccess
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      {toggling === project.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Updating...</span>
                        </>
                      ) : project.hasAccess ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Access Granted</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          <span>Grant Access</span>
                        </>
                      )}
                    </button>
                  )}

                  {!canEdit && (
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded-lg ${
                        project.hasAccess
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {project.hasAccess ? 'Has Access' : 'No Access'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        {client.clientOrgId && projects.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-700">
              💡 <strong>Tip:</strong> Client users can only view projects that have been granted access. Use the toggle buttons to control which projects they can see.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
