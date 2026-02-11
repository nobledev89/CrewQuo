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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Settings, Plus, Edit2, Trash2, Star, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { RateCardTemplate } from '@/lib/types';
import RateCardTemplateForm, { RateCardTemplateFormData } from '@/components/RateCardTemplateForm';

export default function RateTemplatesPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<RateCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RateCardTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncingTemplateId, setSyncingTemplateId] = useState<string | null>(null);
  const [rateCardsCounts, setRateCardsCounts] = useState<Map<string, number>>(new Map());
  const [loadingCounts, setLoadingCounts] = useState(false);

  // Redirect subcontractors to their workspace
  useEffect(() => {
    if (!authLoading && userData && userData.role === 'SUBCONTRACTOR') {
      router.push('/dashboard/my-work/summary');
    }
  }, [authLoading, userData, router]);

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
            
            await fetchTemplates(userData.companyId);
          }
        } catch (error) {
          console.error('Error fetching templates:', error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchTemplates = async (compId: string) => {
    try {
      const templatesQuery = query(
        collection(db, 'rateCardTemplates'),
        where('companyId', '==', compId)
      );
      const templatesSnap = await getDocs(templatesQuery);
      
      const templatesData = templatesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as RateCardTemplate));
      
      setTemplates(templatesData.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)));
      
      // Fetch rate cards count for each template
      await fetchRateCardsCount(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchRateCardsCount = async (templatesList: RateCardTemplate[]) => {
    if (!canEdit) return; // Only fetch for admins/managers
    
    setLoadingCounts(true);
    try {
      const functions = getFunctions();
      const getRateCardsCountFunc = httpsCallable(functions, 'getRateCardsCountForTemplate');
      
      const newCounts = new Map<string, number>();
      
      // Fetch counts for all templates in parallel
      const countPromises = templatesList.map(async (template) => {
        try {
          const result = await getRateCardsCountFunc({ templateId: template.id }) as { data: { count: number } };
          newCounts.set(template.id, result.data.count);
        } catch (error) {
          console.error(`Error fetching count for template ${template.id}:`, error);
          newCounts.set(template.id, 0);
        }
      });
      
      await Promise.all(countPromises);
      setRateCardsCounts(newCounts);
    } catch (error) {
      console.error('Error fetching rate cards counts:', error);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleSyncRateCards = async (templateId: string) => {
    const count = rateCardsCounts.get(templateId) || 0;
    
    if (count === 0) {
      alert('No rate cards are using this template.');
      return;
    }
    
    const confirmed = confirm(
      `This will update ${count} rate card${count > 1 ? 's' : ''} to match the current template. ` +
      `This ensures all timeframe names, expense categories, and other template data are synchronized.\n\n` +
      `Do you want to continue?`
    );
    
    if (!confirmed) return;
    
    setSyncingTemplateId(templateId);
    try {
      const functions = getFunctions();
      const syncFunc = httpsCallable(functions, 'syncRateCardsWithTemplateManual');
      
      const result = await syncFunc({ templateId }) as { 
        data: { 
          success: boolean; 
          rateCardsUpdated: number; 
          errors: string[] 
        } 
      };
      
      if (result.data.success) {
        if (result.data.errors.length > 0) {
          alert(
            `Sync completed with some errors:\n` +
            `- ${result.data.rateCardsUpdated} rate cards updated\n` +
            `- ${result.data.errors.length} errors occurred\n\n` +
            `Errors: ${result.data.errors.join(', ')}`
          );
        } else {
          alert(
            `✅ Successfully synchronized ${result.data.rateCardsUpdated} rate card${result.data.rateCardsUpdated > 1 ? 's' : ''}!\n\n` +
            `All timeframe names and expense categories have been updated to match the template.`
          );
        }
      } else {
        alert('Failed to sync rate cards. Please try again.');
      }
    } catch (error: any) {
      console.error('Error syncing rate cards:', error);
      alert(`Failed to sync rate cards: ${error.message || 'Unknown error'}`);
    } finally {
      setSyncingTemplateId(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.isDefault) {
      alert('Cannot delete the default template. Please set another template as default first.');
      return;
    }

    if (!confirm('Are you sure you want to delete this template? Rate cards using this template will not be affected.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'rateCardTemplates', templateId));
      await fetchTemplates(companyId);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      // Unset current default
      const currentDefault = templates.find(t => t.isDefault);
      if (currentDefault) {
        await updateDoc(doc(db, 'rateCardTemplates', currentDefault.id), {
          isDefault: false,
          updatedAt: serverTimestamp()
        });
      }

      // Set new default
      await updateDoc(doc(db, 'rateCardTemplates', templateId), {
        isDefault: true,
        updatedAt: serverTimestamp()
      });

      await fetchTemplates(companyId);
    } catch (error) {
      console.error('Error setting default template:', error);
      alert('Failed to set default template. Please try again.');
    }
  };

  const handleDuplicate = async (template: RateCardTemplate) => {
    try {
      const newTemplate = {
        name: `${template.name} (Copy)`,
        description: template.description,
        timeframeDefinitions: template.timeframeDefinitions || template.shiftTypes || [],
        expenseCategories: template.expenseCategories,
        resourceCategories: template.resourceCategories,
        companyId,
        isDefault: false,
        active: true,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'rateCardTemplates'), newTemplate);
      await fetchTemplates(companyId);
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Failed to duplicate template. Please try again.');
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

  const handleSaveTemplate = async (data: RateCardTemplateFormData) => {
    setSaving(true);
    try {
      const templateData = {
        name: data.name,
        description: data.description,
        timeframeDefinitions: data.timeframeDefinitions,
        expenseCategories: data.expenseCategories,
        resourceCategories: data.resourceCategories,
        active: data.active,
        isDefault: data.isDefault,
        updatedAt: serverTimestamp(),
      };

      // If setting as default, unset current default
      if (data.isDefault) {
        const currentDefault = templates.find(t => t.isDefault && t.id !== editingTemplate?.id);
        if (currentDefault) {
          await updateDoc(doc(db, 'rateCardTemplates', currentDefault.id), {
            isDefault: false,
            updatedAt: serverTimestamp()
          });
        }
      }

      if (editingTemplate) {
        await updateDoc(doc(db, 'rateCardTemplates', editingTemplate.id), templateData);
      } else {
        await addDoc(collection(db, 'rateCardTemplates'), {
          ...templateData,
          companyId,
          createdBy: userId,
          createdAt: serverTimestamp(),
        });
      }

      await fetchTemplates(companyId);
      setShowModal(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading || authLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading templates...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Don't render if subcontractor (will be redirected)
  if (userData && userData.role === 'SUBCONTRACTOR') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Rate Card Templates</h2>
              <p className="text-gray-600 mt-1">
                Define custom timeframes, resource categories, and expense types
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>New Template</span>
              </button>
            )}
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-4">Create your first rate card template to define shift types and expenses.</p>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Create Template</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition ${
                  template.isDefault ? 'border-yellow-400' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                      {template.isDefault && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                          <Star className="w-3 h-3 mr-1" fill="currentColor" />
                          Default
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600">{template.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      {!template.isDefault && (
                        <button
                          onClick={() => handleSetDefault(template.id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!template.isDefault && userRole === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-800 mb-1">Timeframes</p>
                    <p className="text-2xl font-bold text-blue-900">{(template.timeframeDefinitions || template.shiftTypes || []).length}</p>
                    {(template.timeframeDefinitions || template.shiftTypes || []).slice(0, 2).map(tf => (
                      <p key={tf.id} className="text-xs text-blue-700 mt-1">
                        {tf.name} ({tf.startTime}-{tf.endTime})
                      </p>
                    ))}
                    {(template.timeframeDefinitions || template.shiftTypes || []).length > 2 && (
                      <p className="text-xs text-blue-600 mt-1">+{(template.timeframeDefinitions || template.shiftTypes || []).length - 2} more</p>
                    )}
                  </div>

                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <p className="text-xs font-semibold text-green-800 mb-1">Expense Categories</p>
                    <p className="text-2xl font-bold text-green-900">{template.expenseCategories.length}</p>
                    {template.expenseCategories.slice(0, 2).map(ec => (
                      <p key={ec.id} className="text-xs text-green-700 mt-1">{ec.name}</p>
                    ))}
                    {template.expenseCategories.length > 2 && (
                      <p className="text-xs text-green-600 mt-1">+{template.expenseCategories.length - 2} more</p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="text-xs font-semibold text-purple-800 mb-1">Resource Categories</p>
                    <p className="text-2xl font-bold text-purple-900">{template.resourceCategories.length}</p>
                    {template.resourceCategories.slice(0, 2).map((rc, idx) => (
                      <p key={idx} className="text-xs text-purple-700 mt-1">{rc}</p>
                    ))}
                    {template.resourceCategories.length > 2 && (
                      <p className="text-xs text-purple-600 mt-1">+{template.resourceCategories.length - 2} more</p>
                    )}
                  </div>
                </div>

                {/* Rate Cards Count and Sync Section */}
                {canEdit && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {loadingCounts ? (
                            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              {(rateCardsCounts.get(template.id) || 0) > 0 && (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                            </>
                          )}
                          <span className="text-sm font-medium text-gray-700">
                            {loadingCounts ? 'Loading...' : (
                              `${rateCardsCounts.get(template.id) || 0} Rate Card${(rateCardsCounts.get(template.id) || 0) !== 1 ? 's' : ''} Using This Template`
                            )}
                          </span>
                        </div>
                        {(rateCardsCounts.get(template.id) || 0) > 0 && (
                          <button
                            onClick={() => handleSyncRateCards(template.id)}
                            disabled={syncingTemplateId === template.id}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Sync rate cards with this template"
                          >
                            {syncingTemplateId === template.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                                <span>Syncing...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3" />
                                <span>Sync Now</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {(rateCardsCounts.get(template.id) || 0) > 0 && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <p className="text-xs text-amber-800">
                          <strong>💡 Tip:</strong> When you update timeframe names or expense categories, use "Sync Now" to update all rate cards automatically.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Created {formatDate(template.createdAt)}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                    template.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {template.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <RateCardTemplateForm
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={handleCloseModal}
          saving={saving}
        />
      )}
    </DashboardLayout>
  );
}
