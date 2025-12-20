'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Users, Mail, Phone, X, Trash2, ArrowLeft, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useParams, useRouter } from 'next/navigation';

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  notes: string;
  inviteStatus: 'pending' | 'accepted' | 'none';
}

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  clientName: string;
  status: string;
}

interface ProjectAssignment {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  status: string;
  assignedAt: any;
}

interface AvailableProject {
  id: string;
  projectCode: string;
  name: string;
  clientName: string;
  location: string;
  status: string;
}

export default function SubcontractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subcontractorId = params?.subcontractorId as string;
  
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCompanyId(userData.companyId);
            setUserRole(userData.role);
            
            await Promise.all([
              fetchSubcontractor(subcontractorId, userData.companyId),
              fetchAssignments(userData.companyId, subcontractorId),
              fetchProjects(userData.companyId),
            ]);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [subcontractorId]);

  const fetchSubcontractor = async (subId: string, compId: string) => {
    try {
      const subDoc = await getDoc(doc(db, 'subcontractors', subId));
      if (subDoc.exists()) {
        const data = subDoc.data();
        setSubcontractor({
          id: subDoc.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          active: data.active,
          notes: data.notes,
          inviteStatus: data.inviteStatus,
        });
      }
    } catch (error) {
      console.error('Error fetching subcontractor:', error);
    }
  };

  const fetchAssignments = async (compId: string, subId: string) => {
    try {
      const assignmentsQuery = query(
        collection(db, 'projectAssignments'),
        where('companyId', '==', compId),
        where('subcontractorId', '==', subId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);
      
      const assignmentsData = await Promise.all(
        assignmentsSnap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const projectDoc = await getDoc(doc(db, 'projects', data.projectId));
          
          if (projectDoc.exists()) {
            const projectData = projectDoc.data();
            let clientName = 'Unknown Client';
            if (projectData.clientId) {
              const clientDoc = await getDoc(doc(db, 'clients', projectData.clientId));
              if (clientDoc.exists()) {
                clientName = clientDoc.data().name;
              }
            }
            
            return {
              id: docSnap.id,
              projectId: data.projectId,
              projectCode: projectData.projectCode,
              projectName: projectData.name,
              clientName,
              status: projectData.status,
              assignedAt: data.assignedAt,
            };
          }
          return null;
        })
      );
      
      setAssignments(assignmentsData.filter(Boolean) as ProjectAssignment[]);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchProjects = async (compId: string) => {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('companyId', '==', compId)
      );
      const projectsSnap = await getDocs(projectsQuery);
      
      const projectsData = await Promise.all(
        projectsSnap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let clientName = 'Unknown Client';
          if (data.clientId) {
            const clientDoc = await getDoc(doc(db, 'clients', data.clientId));
            if (clientDoc.exists()) {
              clientName = clientDoc.data().name;
            }
          }
          
          return {
            id: docSnap.id,
            projectCode: data.projectCode,
            name: data.name,
            clientName,
            location: data.location,
            status: data.status,
          };
        })
      );
      
      setAvailableProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const openAssignModal = () => {
    setSelectedProjectId('');
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedProjectId('');
  };

  const handleAssignProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !subcontractor) return;

    // Check if already assigned
    const alreadyAssigned = assignments.some(a => a.projectId === selectedProjectId);
    if (alreadyAssigned) {
      alert('This subcontractor is already assigned to this project.');
      return;
    }

    setSaving(true);
    try {
      // Use deterministic document ID: projectId_subcontractorId
      const assignmentId = `${selectedProjectId}_${subcontractor.id}`;
      const assignmentRef = doc(db, 'projectAssignments', assignmentId);
      
      await setDoc(assignmentRef, {
        projectId: selectedProjectId,
        subcontractorId: subcontractor.id,
        companyId,
        assignedAt: serverTimestamp(),
      });

      await fetchAssignments(companyId, subcontractor.id);
      closeAssignModal();
    } catch (error) {
      console.error('Error assigning project:', error);
      alert('Failed to assign project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this project assignment?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'projectAssignments', assignmentId));
      await fetchAssignments(companyId, subcontractorId);
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment. Please try again.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
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
  
  // Filter out already assigned projects
  const unassignedProjects = availableProjects.filter(
    proj => !assignments.some(a => a.projectId === proj.id)
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading subcontractor...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!subcontractor) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Subcontractor not found</h3>
            <p className="text-red-600 mb-4">The requested subcontractor could not be found.</p>
            <button
              onClick={() => router.push('/dashboard/subcontractors')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Subcontractors</span>
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
            onClick={() => router.push('/dashboard/subcontractors')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Subcontractors</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{subcontractor.name}</h2>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                  subcontractor.active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subcontractor.active ? 'Active' : 'Inactive'}
                </span>
                {subcontractor.inviteStatus === 'pending' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invite Pending
                  </span>
                )}
                {subcontractor.inviteStatus === 'accepted' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Accepted
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subcontractor Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Email</p>
                <p className="text-gray-900 font-medium break-all">{subcontractor.email}</p>
              </div>
            </div>

            {subcontractor.phone && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Phone</p>
                  <p className="text-gray-900 font-medium">{subcontractor.phone}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Assigned Projects</p>
              <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
            </div>
          </div>

          {subcontractor.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Notes</p>
              <p className="text-gray-700">{subcontractor.notes}</p>
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Assigned Projects</h3>
            </div>
            {canEdit && unassignedProjects.length > 0 && (
              <button
                onClick={openAssignModal}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Project</span>
              </button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No projects assigned</h4>
              <p className="text-gray-600 mb-4">Assign projects to this subcontractor to get started.</p>
              {canEdit && unassignedProjects.length > 0 && (
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign Project</span>
                </button>
              )}
              {unassignedProjects.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  All available projects are already assigned to this subcontractor.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  onClick={() => router.push(`/dashboard/projects/${assignment.projectId}`)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md hover:border-blue-200 transition cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">{assignment.projectName}</p>
                      <span className={`px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {assignment.projectCode} • {assignment.clientName} • {assignment.projectName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Assigned on {formatDate(assignment.assignedAt)}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAssignment(assignment.id);
                      }}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Project Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Assign Project to {subcontractor.name}
              </h3>
              <button
                onClick={closeAssignModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleAssignProject} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project *
                </label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a project...</option>
                  {unassignedProjects.map(proj => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.projectCode}) - {proj.clientName}
                    </option>
                  ))}
                </select>
                {unassignedProjects.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    All projects are already assigned to this subcontractor.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedProjectId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {saving ? 'Assigning...' : 'Assign Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
