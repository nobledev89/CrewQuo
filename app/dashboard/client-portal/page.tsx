'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { FolderOpen, Clock, DollarSign, MapPin, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ContractorSelector from '@/components/ContractorSelector';
import { getClientUserContractors, getClientAccessibleProjects } from '@/lib/clientAccessUtils';

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  contractorCompanyId: string;
}

interface Contractor {
  id: string;
  name: string;
  projectCount: number;
}

export default function ClientPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [clientOrgId, setClientOrgId] = useState('');
  const [clientOrgName, setClientOrgName] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Redirect non-client users
            if (userData.role !== 'CLIENT') {
              router.push('/dashboard');
              return;
            }

            setUserRole(userData.role);
            setClientOrgId(userData.clientOrgId || '');
            setClientOrgName(userData.clientOrgName || '');

            // Load contractors
            const contractorsList = await getClientUserContractors(currentUser.uid);
            setContractors(contractorsList);

            // Auto-select first contractor or use saved preference
            const savedContractorId = localStorage.getItem('selectedContractorId');
            const contractorToSelect = 
              (savedContractorId && contractorsList.find(c => c.id === savedContractorId))
                ? savedContractorId
                : contractorsList[0]?.id || '';

            if (contractorToSelect) {
              setSelectedContractorId(contractorToSelect);
              await loadProjects(contractorToSelect, userData.clientOrgId);
            }
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
  }, [router]);

  const loadProjects = async (contractorId: string, clientOrgIdParam: string) => {
    try {
      // Get accessible projects for this contractor
      const accessibleProjects = await getClientAccessibleProjects(contractorId, clientOrgIdParam);
      const projectIds = accessibleProjects.map(a => a.projectId);

      if (projectIds.length === 0) {
        setProjects([]);
        return;
      }

      // Fetch project details
      const projectsData = await Promise.all(
        projectIds.map(async (projectId) => {
          const projectDoc = await getDoc(doc(db, 'projects', projectId));
          if (projectDoc.exists()) {
            return {
              id: projectDoc.id,
              ...projectDoc.data(),
              contractorCompanyId: contractorId,
            } as Project;
          }
          return null;
        })
      );

      setProjects(projectsData.filter(p => p !== null) as Project[]);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleContractorChange = async (contractorId: string) => {
    setSelectedContractorId(contractorId);
    localStorage.setItem('selectedContractorId', contractorId);
    await loadProjects(contractorId, clientOrgId);
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

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Projects</h2>
          <p className="text-gray-600">View and track your construction projects</p>
        </div>

        {/* Contractor Selector */}
        {contractors.length > 0 && (
          <div className="mb-6">
            <ContractorSelector
              contractors={contractors}
              selectedContractorId={selectedContractorId}
              onSelectContractor={handleContractorChange}
            />
          </div>
        )}

        {/* No Access Warning */}
        {contractors.length === 0 && (
          <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-12 text-center">
            <FolderOpen className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Projects Available</h3>
            <p className="text-yellow-700">
              You don't have access to any projects yet. Please contact your contractor to grant access.
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {contractors.length > 0 && (
          <>
            {projects.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects</h3>
                <p className="text-gray-600">
                  No projects have been granted access yet. Contact your contractor for access.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/dashboard/client-portal/projects/${project.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer group"
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
                    </div>

                    {/* Project Info */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono mb-4">{project.projectCode}</p>

                    {/* Location */}
                    {project.location && (
                      <div className="flex items-center space-x-2 text-gray-600 mb-4">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{project.location}</span>
                      </div>
                    )}

                    {/* View Details Button */}
                    <div className="pt-4 border-t border-gray-100">
                      <button className="w-full text-center text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition">
                        View Details & Live Tracking →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        {projects.length > 0 && (
          <div className="mt-8 bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h4 className="font-semibold text-blue-900 mb-2">About the Client Portal</h4>
            <p className="text-sm text-blue-800 mb-2">
              Click on any project to view:
            </p>
            <ul className="text-sm text-blue-700 space-y-1 ml-4">
              <li>• Live time tracking and work logs</li>
              <li>• Running bill and costs</li>
              <li>• Subcontractor activity breakdowns</li>
              <li>• Daily entries and status updates</li>
              <li>• Add notes and questions on line items</li>
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
