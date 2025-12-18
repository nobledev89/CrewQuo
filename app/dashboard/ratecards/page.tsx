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
  serverTimestamp 
} from 'firebase/firestore';
import { FileText, Plus, Edit2, Trash2, X, DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { RateCard, RateEntry, ResourceCategory, ShiftType } from '@/lib/types';
import RateCardForm, { RateCardFormData } from '@/components/RateCardForm';

export default function RateCardsPage() {
  // State management
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<RateCard | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch rate cards on mount
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
            
            await fetchRateCards(userData.companyId);
          }
        } catch (error) {
          console.error('Error fetching rate cards:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchRateCards = async (compId: string) => {
    try {
      const rateCardsQuery = query(
        collection(db, 'rateCards'),
        where('companyId', '==', compId)
      );
      const rateCardsSnap = await getDocs(rateCardsQuery);
      
      const rateCardsData = rateCardsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as RateCard));
      
      setRateCards(rateCardsData);
    } catch (error) {
      console.error('Error fetching rate cards:', error);
    }
  };

  const handleDelete = async (rateCardId: string) => {
    if (!confirm('Are you sure you want to delete this rate card? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'rateCards', rateCardId));
      await fetchRateCards(companyId);
    } catch (error) {
      console.error('Error deleting rate card:', error);
      alert('Failed to delete rate card. Please try again.');
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

  const handleSaveRateCard = async (data: RateCardFormData) => {
    setSaving(true);
    try {
      const rateCardData = {
        name: data.name,
        description: data.description,
        active: data.active,
        templateId: data.templateId || null,
        templateName: data.templateName || null,
        rates: data.rates,
        expenses: data.expenses || [],
        updatedAt: serverTimestamp(),
      };

      if (editingRateCard) {
        // Update existing rate card
        await updateDoc(doc(db, 'rateCards', editingRateCard.id), rateCardData);
      } else {
        // Create new rate card
        await addDoc(collection(db, 'rateCards'), {
          ...rateCardData,
          companyId,
          createdBy: userId,
          createdAt: serverTimestamp(),
        });
      }

      await fetchRateCards(companyId);
      setShowModal(false);
      setEditingRateCard(null);
    } catch (error) {
      console.error('Error saving rate card:', error);
      alert('Failed to save rate card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRateCard(null);
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading rate cards...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rate Cards</h2>
            <p className="text-gray-600 mt-1">
              Total: {rateCards.length} {rateCards.length === 1 ? 'rate card' : 'rate cards'}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Add Rate Card</span>
            </button>
          )}
        </div>

        {/* Rate Cards List */}
        {rateCards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No rate cards yet</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first rate card.</p>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Rate Card</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {rateCards.map((rateCard) => (
              <div
                key={rateCard.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{rateCard.name}</h3>
                      {rateCard.templateName && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                          Template: {rateCard.templateName}
                        </span>
                      )}
                    </div>
                    {rateCard.description && (
                      <p className="text-sm text-gray-600">{rateCard.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingRateCard(rateCard);
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(rateCard.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {rateCard.rates && rateCard.rates.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mb-3">
                    <p className="text-xs font-semibold text-blue-800 mb-1">
                      <DollarSign className="w-3 h-3 inline mr-1" />
                      {rateCard.rates.length} rate {rateCard.rates.length === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Added on {formatDate(rateCard.createdAt)}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                    rateCard.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {rateCard.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate Card Form Modal */}
      {showModal && (
        <RateCardForm
          rateCard={editingRateCard}
          onSave={handleSaveRateCard}
          onClose={handleCloseModal}
          saving={saving}
          companyId={companyId}
        />
      )}
    </DashboardLayout>
  );
}
