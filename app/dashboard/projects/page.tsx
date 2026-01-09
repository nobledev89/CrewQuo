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
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { Briefcase, Calendar, MapPin, Users, Clock, Plus, Edit2, Trash2, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useClientFilter } from '../../../lib/ClientFilterContext';
import { useClientData } from '@/lib/ClientDataContext';

interface Project {
  id: string;
  projectCode: string;
  name: string;
  location: string;
  status: string;
  startDate: any;
  endDate: any;
  notes: string;
  clientId: string;
  clientName?: string;
  companyId: string;
}

interface Client {
  id: string;
  name: string;
}

interface FormData {
  projectCode: string;
  name: string;
  location: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string;
  clientId: string;
}

// Inner component that uses the client filter context
function ProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectCode: '',
    name: '',
    location: '',
    status: 'ACTIVE',
    startDate: '',
    endDate: '',
    notes: '',
    clientId: '',
  });
  const [saving, setSaving] = useState(false);
  
  // Get client filter from context
  const { selectedClient } = useClientFilter();
  const { cachedData, updateProjects } = useClientData();

  // Use cached data when available
  useEffect(() => {
    if (cachedData) {
      setProjects(cachedData.projects);
      setClients(cachedData.clients);
    }
  }, [cachedData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const activeId = userData.activeCompanyId || userData.companyId;
            setActiveCompanyId(activeId);
            setUserRole(userData.role);
            
            await fetchClients(activeId);
            // Fetch projects on initial load based on selected client filter
            await fetchProjects(activeId, selectedClient.clientId);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Refetch projects when client filter changes
  useEffect(() => {
    if (activeCompanyId) {
      fetchProjects(activeCompanyId, selectedClient.clientId);
    }
  }, [selectedClient.clientId, activeCompanyId]);

  const fetchProjects = async (compId: string, clientId: string | null) => {
    try {
      // Build query based on workspace - only fetch projects for selected client
      let projectsQuery;
      if (clientId) {
        // Workspace-scoped: Only fetch projects for this client
        projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', compId),
          where('clientId', '==', clientId)
        );
      } else {
        // All clients view: Fetch all projects
        projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', compId)
        );
      }
      
      const projectsSnap = await getDocs(projectsQuery);
      
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', compId)
      );
      const clientsSnap = await getDocs(clientsQuery);
      const clientsMap = new Map<string, string>();
      clientsSnap.forEach(doc => {
        clientsMap.set(doc.id, doc.data().name);
      });
      
      const projectsData = projectsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clientName: clientsMap.get(doc.data().clientId) || 'Unknown Client',
      } as Project));
      
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchClients = async (compId: string) => {
    try {
      const clientsQuery = query(
        collection(db, 'clients'),
        where('companyId', '==', compId),
        where('active', '==', true)
      );
      const clientsSnap = await getDocs(clientsQuery);
      
      const clientsData = clientsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      } as Client));
      
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const openAddModal = () => {
    setEditingProject(null);
    setFormData({
      projectCode: '',
      name: '',
      location: '',
      status: 'ACTIVE',
      startDate: '',
      endDate: '',
      notes: '',
      clientId: selectedClient.clientId || '', // Auto-select client if in client workspace
    });
    setShowModal(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    
    // Convert Firestore timestamps to date strings for input
    const startDate = project.startDate?.toDate ? 
      project.startDate.toDate().toISOString().split('T')[0] : '';
    const endDate = project.endDate?.toDate ? 
      project.endDate.toDate().toISOString().split('T')[0] : '';
    
    setFormData({
      projectCode: project.projectCode,
      name: project.name,
      location: project.location,
      status: project.status,
      startDate,
      endDate,
      notes: project.notes,
      clientId: project.clientId,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProject(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Convert date strings to Firestore timestamps
      const startDateTimestamp = formData.startDate ? 
        Timestamp.fromDate(new Date(formData.startDate)) : null;
      const endDateTimestamp = formData.endDate ? 
        Timestamp.fromDate(new Date(formData.endDate)) : null;

      const projectData = {
        projectCode: formData.projectCode,
        name: formData.name,
        location: formData.location,
        status: formData.status,
        startDate: startDateTimestamp,
        endDate: endDateTimestamp,
        notes: formData.notes,
        clientId: formData.clientId,
        updatedAt: serverTimestamp(),
      };

      if (editingProject) {
        // Update existing project
        await updateDoc(doc(db, 'projects', editingProject.id), projectData);
      } else {
        // Create new project
        await addDoc(collection(db, 'projects'), {
          ...projectData,
          companyId: activeCompanyId,
          createdAt: serverTimestamp(),
        });
      }

      await fetchProjects(activeCompanyId, selectedClient.clientId);
      closeModal();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'projects', projectId));
      await fetchProjects(activeCompanyId, selectedClient.clientId);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="text-gray-600 mt-1">
              {selectedClient.clientId ? (
                <span>Showing {projects.length} {projects.length === 1 ? 'project' : 'projects'} for <strong>{selectedClient.clientName}</strong></span>
              ) : (
                <span>Total: {projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
              )}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Add Project</span>
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedClient.clientId ? `No projects for ${selectedClient.clientName}` : 'No projects yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedClient.clientId ? 'This client has no projects assigned yet.' : 'Get started by adding your first project.'}
            </p>
            {canEdit && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => window.location.href = `/dashboard/projects/${project.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-mono">{project.projectCode}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(project);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Users className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Client</p>
                      <p className="font-semibold">{project.clientName}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="font-semibold">{project.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500">Start Date</p>
                      <p className="font-semibold">{formatDate(project.startDate)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-gray-700">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-gray-500">End Date</p>
                      <p className="font-semibold">{formatDate(project.endDate)}</p>
                    </div>
                  </div>
                </div>

                {project.notes && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-700">{project.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProject ? 'Edit Project' : 'Add New Project'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Code *
                  </label>
                  <input
                    type="text"
                    name="projectCode"
                    required
                    value={formData.projectCode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., PROJ-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Office Renovation"
                  />
                </div>
              </div>

              {/* Only show client selector if not in a client workspace */}
              {!selectedClient.clientId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client *
                  </label>
                  <select
                    name="clientId"
                    required
                    value={formData.clientId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Client</p>
                  <p className="text-lg font-bold text-purple-900">{selectedClient.clientName}</p>
                  <p className="text-xs text-gray-600 mt-1">Project will be assigned to this client's workspace</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., New York, NY"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    name="status"
                    required
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes about this project..."
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : (editingProject ? 'Update Project' : 'Add Project')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Main page component that wraps with DashboardLayout
export default function ProjectsPage() {
  return (
    <DashboardLayout>
      <ProjectsContent />
    </DashboardLayout>
  );
}
