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
import { Briefcase, Users, UserPlus, X, Trash2, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useParams, useRouter } from 'next/navigation';

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  clientId: string;
  clientName: string;
}

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ProjectAssignment {
  id: string;
  subcontractorId: string;
  subcontractorName: string;
  assignedAt: any;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        try {
          // Get the ID token to access custom claims
          const idTokenResult = await currentUser.getIdTokenResult();
          const claims = idTokenResult.claims;
          
          // Use ownCompanyId from custom claims (projectAssignments rules check companyId = ownCompanyId)
          const ownCompanyId = claims.ownCompanyId as string;
          const role = claims.role as string;
          
          if (!ownCompanyId) {
            console.error('No ownCompanyId in token claims');
            setLoading(false);
            return;
          }
          
          setCompanyId(ownCompanyId);
          setUserRole(role);
          
          await Promise.all([
            fetchProject(projectId),
            fetchSubcontractors(ownCompanyId),
            fetchAssignments(ownCompanyId, projectId)
          ]);
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  const fetchProject = async (projId: string) => {
    try {
      const projectDoc = await getDoc(doc(db, 'projects', projId));
      if (projectDoc.exists()) {
        const projectData = projectDoc.data();
        
        // Fetch client name
        let clientName = 'Unknown Client';
        if (projectData.clientId) {
          const clientDoc = await getDoc(doc(db, 'clients', projectData.clientId));
          if (clientDoc.exists()) {
            clientName = clientDoc.data().name;
          }
        }
        
        setProject({
          id: projectDoc.id,
          projectCode: projectData.projectCode,
          name: projectData.name,
          location: projectData.location,
          status: projectData.status,
          clientId: projectData.clientId,
          clientName,
        });
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchSubcontractors = async (compId: string) => {
    try {
      const subcontractorsQuery = query(
        collection(db, 'subcontractors'),
        where('companyId', '==', compId),
        where('active', '==', true)
      );
      const subcontractorsSnap = await getDocs(subcontractorsQuery);
      
      const subcontractorsData = subcontractorsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        phone: doc.data().phone,
      } as Subcontractor));
      
      setSubcontractors(subcontractorsData);
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
    }
  };

  const fetchAssignments = async (compId: string, projId: string) => {
    try {
      const assignmentsQuery = query(
        collection(db, 'projectAssignments'),
        where('companyId', '==', compId),
        where('projectId', '==', projId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);
      
      const assignmentsData = await Promise.all(
        assignmentsSnap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          // Fetch subcontractor name
          const subDoc = await getDoc(doc(db, 'subcontractors', data.subcontractorId));
          const subName = subDoc.exists() ? subDoc.data().name : 'Unknown';
          
          return {
            id: docSnap.id,
            subcontractorId: data.subcontractorId,
            subcontractorName: subName,
            assignedAt: data.assignedAt,
          };
        })
      );
      
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const openAssignModal = () => {
    setSelectedSubcontractorId('');
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedSubcontractorId('');
  };

  const handleAssignSubcontractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubcontractorId || !project) return;

    // Check if already assigned
    const alreadyAssigned = assignments.some(a => a.subcontractorId === selectedSubcontractorId);
    if (alreadyAssigned) {
      alert('This subcontractor is already assigned to this project.');
      return;
    }

    setSaving(true);
    try {
      // Use deterministic document ID: projectId_subcontractorId
      // This prevents duplicates at the database level
      const assignmentId = `${project.id}_${selectedSubcontractorId}`;
      const assignmentRef = doc(db, 'projectAssignments', assignmentId);
      
      await setDoc(assignmentRef, {
        projectId: project.id,
        subcontractorId: selectedSubcontractorId,
        companyId,
        userId: userId,
        assignedAt: serverTimestamp(),
        assignedBy: userId,
      });

      await fetchAssignments(companyId, project.id);
      closeAssignModal();
    } catch (error) {
      console.error('Error assigning subcontractor:', error);
      alert('Failed to assign subcontractor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this subcontractor from the project?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'projectAssignments', assignmentId));
      await fetchAssignments(companyId, projectId);
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
  
  // Filter out already assigned subcontractors
  const availableSubcontractors = subcontractors.filter(
    sub => !assignments.some(a => a.subcontractorId === sub.id)
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading project...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Project not found</h3>
            <p className="text-red-600 mb-4">The requested project could not be found.</p>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Projects</span>
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
            onClick={() => router.push('/dashboard/projects')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h2>
              <p className="text-gray-600 font-mono">{project.projectCode}</p>
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Project Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Client</p>
              <p className="text-lg font-semibold text-gray-900">{project.clientName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</p>
              <p className="text-lg font-semibold text-gray-900">{project.location}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subcontractors</p>
              <p className="text-lg font-semibold text-gray-900">{assignments.length}</p>
            </div>
          </div>
        </div>

        {/* Subcontractors Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Assigned Subcontractors</h3>
            </div>
            {canEdit && availableSubcontractors.length > 0 && (
              <button
                onClick={openAssignModal}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Assign Subcontractor</span>
              </button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No subcontractors assigned</h4>
              <p className="text-gray-600 mb-4">Assign subcontractors to this project to get started.</p>
              {canEdit && availableSubcontractors.length > 0 && (
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Assign Subcontractor</span>
                </button>
              )}
              {availableSubcontractors.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No available subcontractors. Create subcontractors first.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{assignment.subcontractorName}</p>
                    <p className="text-xs text-gray-500">Assigned on {formatDate(assignment.assignedAt)}</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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

        {/* Info Box */}
        {project.clientId && assignments.length > 0 && (
          <div className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Go to the client's subcontractors page to assign rate cards to these subcontractors for billing.
            </p>
            <button
              onClick={() => router.push(`/dashboard/clients/${project.clientId}/subcontractors`)}
              className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              <span>Manage Rate Cards for {project.clientName}</span>
            </button>
          </div>
        )}
      </div>

      {/* Assign Subcontractor Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Assign Subcontractor to {project.name}
              </h3>
              <button
                onClick={closeAssignModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleAssignSubcontractor} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Subcontractor *
                </label>
                <select
                  required
                  value={selectedSubcontractorId}
                  onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a subcontractor...</option>
                  {availableSubcontractors.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.email})
                    </option>
                  ))}
                </select>
                {availableSubcontractors.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    All active subcontractors are already assigned to this project.
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
                  disabled={saving || !selectedSubcontractorId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {saving ? 'Assigning...' : 'Assign Subcontractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
