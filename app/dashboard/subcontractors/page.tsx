'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
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
  serverTimestamp 
} from 'firebase/firestore';
import { Users, Plus, Edit2, Trash2, X, Mail, Phone, CheckCircle, XCircle, Copy, UserPlus } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useClientFilter } from '../../../lib/ClientFilterContext';
import { useClientData } from '@/lib/ClientDataContext';

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  notes: string;
  userId?: string;
  inviteStatus: 'pending' | 'accepted' | 'none';
  inviteToken?: string;
  companyId: string;
  createdAt: any;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  sendInvite: boolean;
}

// Inner component that uses the client filter context
function SubcontractorsContent() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    notes: '',
    active: true,
    sendInvite: true,
  });
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  // Get client filter from context
  const { selectedClient } = useClientFilter();
  const { updateSubcontractors } = useClientData();

  // Redirect subcontractors to their workspace
  useEffect(() => {
    if (!authLoading && userData && userData.role === 'SUBCONTRACTOR') {
      router.push('/dashboard/my-work/summary');
    }
  }, [authLoading, userData, router]);

  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && isMounted) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && isMounted) {
            const userData = userDoc.data();
            setCompanyId(userData.companyId);
            setUserRole(userData.role);
            // Fetch subcontractors on mount
            await fetchSubcontractors(userData.companyId, selectedClient.clientId);
          }
        } catch (error) {
          console.error('Error fetching subcontractors:', error);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedClient.clientId]);

  const fetchSubcontractors = async (compId: string, clientId: string | null) => {
    try {
      if (clientId) {
        // Workspace-scoped: Only fetch subcontractors for this client's projects
        // Step 1: Get all projects for the selected client
        const projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', compId),
          where('clientId', '==', clientId)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const projectIds = projectsSnap.docs.map(doc => doc.id);
        
        if (projectIds.length === 0) {
          setSubcontractors([]);
          updateSubcontractors([]);
          return;
        }
        
        // Step 2: Get all project assignments for these projects
        const assignmentsQuery = query(
          collection(db, 'projectAssignments'),
          where('companyId', '==', compId)
        );
        const assignmentsSnap = await getDocs(assignmentsQuery);
        
        // Filter assignments that match our project IDs
        const subcontractorIds = new Set<string>();
        assignmentsSnap.docs.forEach(doc => {
          const assignment = doc.data();
          if (projectIds.includes(assignment.projectId)) {
            subcontractorIds.add(assignment.subcontractorId);
          }
        });
        
        if (subcontractorIds.size === 0) {
          setSubcontractors([]);
          updateSubcontractors([]);
          return;
        }
        
        // Step 3: Fetch only the relevant subcontractors
        const subcontractorsQuery = query(
          collection(db, 'subcontractors'),
          where('companyId', '==', compId)
        );
        const subcontractorsSnap = await getDocs(subcontractorsQuery);
        
        const subcontractorsData = subcontractorsSnap.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Subcontractor))
          .filter(sub => subcontractorIds.has(sub.id));
        
        setSubcontractors(subcontractorsData);
        updateSubcontractors(subcontractorsData);
      } else {
        // All clients view: Fetch all subcontractors
        const subcontractorsQuery = query(
          collection(db, 'subcontractors'),
          where('companyId', '==', compId)
        );
        const subcontractorsSnap = await getDocs(subcontractorsQuery);
        
        const subcontractorsData = subcontractorsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Subcontractor));
        
        setSubcontractors(subcontractorsData);
        updateSubcontractors(subcontractorsData);
      }
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
    }
  };

  const openAddModal = () => {
    setEditingSubcontractor(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      notes: '',
      active: true,
      sendInvite: true,
    });
    setShowModal(true);
  };

  const openEditModal = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor);
    setFormData({
      name: subcontractor.name,
      email: subcontractor.email,
      phone: subcontractor.phone,
      notes: subcontractor.notes,
      active: subcontractor.active,
      sendInvite: false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubcontractor(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const generateInviteToken = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingSubcontractor) {
        // Update existing subcontractor
        await updateDoc(doc(db, 'subcontractors', editingSubcontractor.id), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
          active: formData.active,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new subcontractor
        const subcontractorData: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
          active: formData.active,
          companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (formData.sendInvite) {
          subcontractorData.inviteStatus = 'pending';
          subcontractorData.inviteToken = generateInviteToken();
        } else {
          subcontractorData.inviteStatus = 'none';
        }

        await addDoc(collection(db, 'subcontractors'), subcontractorData);
      }

      await fetchSubcontractors(companyId, selectedClient.clientId);
      closeModal();
    } catch (error) {
      console.error('Error saving subcontractor:', error);
      alert('Failed to save subcontractor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subcontractorId: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'subcontractors', subcontractorId));
      await fetchSubcontractors(companyId, selectedClient.clientId);
    } catch (error) {
      console.error('Error deleting subcontractor:', error);
      alert('Failed to delete subcontractor. Please try again.');
    }
  };

  const handleResendInvite = async (subcontractorId: string) => {
    try {
      const newToken = generateInviteToken();
      await updateDoc(doc(db, 'subcontractors', subcontractorId), {
        inviteToken: newToken,
        inviteStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
      await fetchSubcontractors(companyId, selectedClient.clientId);
      alert('New invite link generated successfully!');
    } catch (error) {
      console.error('Error resending invite:', error);
      alert('Failed to resend invite. Please try again.');
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteLink = `${window.location.origin}/signup/subcontractor?token=${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
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

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subcontractors...</p>
        </div>
      </div>
    );
  }

  // Don't render if subcontractor (will be redirected)
  if (userData && userData.role === 'SUBCONTRACTOR') {
    return null;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Subcontractors</h2>
            <p className="text-gray-600 mt-1">
              {selectedClient.clientId ? (
                <span>Showing {subcontractors.length} {subcontractors.length === 1 ? 'subcontractor' : 'subcontractors'} for <strong>{selectedClient.clientName}</strong></span>
              ) : (
                <span>Total: {subcontractors.length} {subcontractors.length === 1 ? 'subcontractor' : 'subcontractors'}</span>
              )}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Add Subcontractor</span>
            </button>
          )}
        </div>

        {subcontractors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedClient.clientId ? `No subcontractors for ${selectedClient.clientName}` : 'No subcontractors yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedClient.clientId ? 'No subcontractors are assigned to this client\'s projects.' : 'Get started by adding your first subcontractor.'}
            </p>
            {canEdit && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Subcontractor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subcontractors.map((subcontractor) => (
              <div
                key={subcontractor.id}
                onClick={() => window.location.href = `/dashboard/subcontractors/${subcontractor.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{subcontractor.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        subcontractor.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {subcontractor.active ? 'Active' : 'Inactive'}
                      </span>
                      {subcontractor.inviteStatus === 'pending' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
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
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(subcontractor);
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
                            handleDelete(subcontractor.id);
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

                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-3 text-gray-700">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium truncate">{subcontractor.email}</p>
                    </div>
                  </div>

                  {subcontractor.phone && (
                    <div className="flex items-center space-x-3 text-gray-700">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{subcontractor.phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {subcontractor.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-3">
                    <p className="text-sm text-gray-700">{subcontractor.notes}</p>
                  </div>
                )}

                {subcontractor.inviteToken && subcontractor.inviteStatus === 'pending' && canEdit && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-600 mb-2">Invite Link:</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteLink(subcontractor.inviteToken!);
                        }}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedToken === subcontractor.inviteToken ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResendInvite(subcontractor.id);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        title="Generate New Invite"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Added on {formatDate(subcontractor.createdAt)}
                  </p>
                </div>
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
                {editingSubcontractor ? 'Edit Subcontractor' : 'Add New Subcontractor'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
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
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="active"
                  id="active"
                  checked={formData.active}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                  Active subcontractor
                </label>
              </div>

              {!editingSubcontractor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      name="sendInvite"
                      id="sendInvite"
                      checked={formData.sendInvite}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="sendInvite" className="ml-2 text-sm font-medium text-gray-900">
                      Generate invite link for login access
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">
                    The subcontractor will be able to create their account using the invite link and access the system.
                  </p>
                </div>
              )}

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
                  {saving ? 'Saving...' : (editingSubcontractor ? 'Update' : 'Add Subcontractor')}
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
export default function SubcontractorsPage() {
  return (
    <DashboardLayout>
      <SubcontractorsContent />
    </DashboardLayout>
  );
}
