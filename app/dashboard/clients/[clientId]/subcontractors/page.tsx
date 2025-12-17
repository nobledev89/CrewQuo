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
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Users, FileText, DollarSign, X, Plus, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useParams } from 'next/navigation';

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface RateCard {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface RateAssignment {
  id: string;
  subcontractorId: string;
  rateCardId: string;
  rateCardName: string;
  assignedAt: any;
}

export default function ClientSubcontractorsPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [assignments, setAssignments] = useState<Map<string, RateAssignment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [selectedRateCardId, setSelectedRateCardId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCompanyId(userData.companyId);
            setUserRole(userData.role);
            
            // Fetch client info
            const clientDoc = await getDoc(doc(db, 'clients', clientId));
            if (clientDoc.exists()) {
              setClientName(clientDoc.data().name);
            }
            
            await Promise.all([
              fetchSubcontractors(userData.companyId),
              fetchRateCards(userData.companyId),
              fetchRateAssignments(userData.companyId)
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
  }, [clientId]);

  const fetchSubcontractors = async (compId: string) => {
    try {
      // Get all projects for this client
      const projectsQuery = query(
        collection(db, 'projects'),
        where('companyId', '==', compId),
        where('clientId', '==', clientId)
      );
      const projectsSnap = await getDocs(projectsQuery);
      const projectIds = projectsSnap.docs.map(doc => doc.id);
      
      if (projectIds.length === 0) {
        setSubcontractors([]);
        return;
      }
      
      // Get all project assignments for these projects
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
        return;
      }
      
      // Fetch the relevant subcontractors
      const subcontractorsQuery = query(
        collection(db, 'subcontractors'),
        where('companyId', '==', compId)
      );
      const subcontractorsSnap = await getDocs(subcontractorsQuery);
      
      const subcontractorsData = subcontractorsSnap.docs
        .map(doc => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          phone: doc.data().phone,
        } as Subcontractor))
        .filter(sub => subcontractorIds.has(sub.id));
      
      setSubcontractors(subcontractorsData);
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
    }
  };

  const fetchRateCards = async (compId: string) => {
    try {
      const rateCardsQuery = query(
        collection(db, 'rateCards'),
        where('companyId', '==', compId),
        where('active', '==', true)
      );
      const rateCardsSnap = await getDocs(rateCardsQuery);
      
      const rateCardsData = rateCardsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        category: doc.data().category,
        description: doc.data().description,
      } as RateCard));
      
      setRateCards(rateCardsData);
    } catch (error) {
      console.error('Error fetching rate cards:', error);
    }
  };

  const fetchRateAssignments = async (compId: string) => {
    try {
      const assignmentsQuery = query(
        collection(db, 'subcontractorRateAssignments'),
        where('companyId', '==', compId),
        where('clientId', '==', clientId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);
      
      const assignmentsMap = new Map<string, RateAssignment>();
      
      for (const docSnap of assignmentsSnap.docs) {
        const data = docSnap.data();
        // Fetch rate card name
        const rateCardDoc = await getDoc(doc(db, 'rateCards', data.rateCardId));
        const rateCardName = rateCardDoc.exists() ? rateCardDoc.data().name : 'Unknown';
        
        assignmentsMap.set(data.subcontractorId, {
          id: docSnap.id,
          subcontractorId: data.subcontractorId,
          rateCardId: data.rateCardId,
          rateCardName,
          assignedAt: data.assignedAt,
        });
      }
      
      setAssignments(assignmentsMap);
    } catch (error) {
      console.error('Error fetching rate assignments:', error);
    }
  };

  const openAssignModal = (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor);
    const existing = assignments.get(subcontractor.id);
    setSelectedRateCardId(existing?.rateCardId || '');
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedSubcontractor(null);
    setSelectedRateCardId('');
  };

  const handleAssignRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubcontractor || !selectedRateCardId) return;

    setSaving(true);
    try {
      // Delete existing assignment if any
      const existingAssignment = assignments.get(selectedSubcontractor.id);
      if (existingAssignment) {
        await deleteDoc(doc(db, 'subcontractorRateAssignments', existingAssignment.id));
      }

      // Create new assignment
      await addDoc(collection(db, 'subcontractorRateAssignments'), {
        subcontractorId: selectedSubcontractor.id,
        rateCardId: selectedRateCardId,
        clientId: clientId,
        companyId,
        assignedAt: serverTimestamp(),
        assignedBy: userId,
      });

      await fetchRateAssignments(companyId);
      closeAssignModal();
    } catch (error) {
      console.error('Error assigning rate card:', error);
      alert('Failed to assign rate card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (subcontractorId: string) => {
    const assignment = assignments.get(subcontractorId);
    if (!assignment) return;

    if (!confirm('Are you sure you want to remove this rate card assignment?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'subcontractorRateAssignments', assignment.id));
      await fetchRateAssignments(companyId);
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

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading subcontractors...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Subcontractors for {clientName}</h2>
          <p className="text-gray-600 mt-1">
            Manage rate card assignments for subcontractors working on this client's projects
          </p>
        </div>

        {subcontractors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No subcontractors assigned</h3>
            <p className="text-gray-600">
              Assign subcontractors to this client's projects first, then you can assign rate cards here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subcontractors.map((subcontractor) => {
              const assignment = assignments.get(subcontractor.id);
              
              return (
                <div
                  key={subcontractor.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{subcontractor.name}</h3>
                      <p className="text-sm text-gray-600">{subcontractor.email}</p>
                      {subcontractor.phone && (
                        <p className="text-sm text-gray-600">{subcontractor.phone}</p>
                      )}
                    </div>
                  </div>

                  {assignment ? (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200 mb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-900">Rate Card Assigned</span>
                          </div>
                          <p className="text-sm text-green-800 font-medium mb-1">{assignment.rateCardName}</p>
                          <p className="text-xs text-green-600">Assigned on {formatDate(assignment.assignedAt)}</p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleRemoveAssignment(subcontractor.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600">No Rate Card Assigned</span>
                      </div>
                      <p className="text-xs text-gray-500">Assign a rate card to set billing rates</p>
                    </div>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => openAssignModal(subcontractor)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      {assignment ? (
                        <>
                          <FileText className="w-4 h-4" />
                          <span>Change Rate Card</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Assign Rate Card</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Rate Card Modal */}
      {showAssignModal && selectedSubcontractor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Assign Rate Card to {selectedSubcontractor.name}
              </h3>
              <button
                onClick={closeAssignModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleAssignRateCard} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Rate Card *
                </label>
                <select
                  required
                  value={selectedRateCardId}
                  onChange={(e) => setSelectedRateCardId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a rate card...</option>
                  {rateCards.map(card => (
                    <option key={card.id} value={card.id}>
                      {card.name} ({card.category})
                    </option>
                  ))}
                </select>
                {rateCards.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    No active rate cards available. Please create rate cards first.
                  </p>
                )}
              </div>

              {selectedRateCardId && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
                  <p className="text-sm text-blue-800">
                    {rateCards.find(c => c.id === selectedRateCardId)?.description || 'No description'}
                  </p>
                </div>
              )}

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
                  disabled={saving || !selectedRateCardId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {saving ? 'Assigning...' : 'Assign Rate Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
