'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { X, Plus, Trash2, DollarSign, Tag, Receipt, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { RateCard, RateEntry, ResourceCategory, RateCardTemplate, ExpenseEntry, TimeframeDefinition } from '@/lib/types';
import { calculateMarginValue, calculateMarginPercentage } from '@/lib/currencyUtils';

interface RateCardFormProps {
  rateCard: RateCard | null;
  onSave: (data: RateCardFormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  companyId: string;
}

export interface RateCardFormData {
  name: string;
  description: string;
  active: boolean;
  cardType?: 'PAY' | 'BILL';
  templateId?: string;
  templateName?: string;
  rates: RateEntry[];
  expenses?: ExpenseEntry[];
}

// Legacy defaults for backward compatibility
const LEGACY_RESOURCE_CATEGORIES: ResourceCategory[] = ['Labour', 'Vehicle', 'Specialist Service', 'Other'];

export default function RateCardForm({ rateCard, onSave, onClose, saving, companyId }: RateCardFormProps) {
  const [templates, setTemplates] = useState<RateCardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RateCardTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [expandedRateIndex, setExpandedRateIndex] = useState<number | null>(0); // First entry expanded by default
  const [showMultiTimeframeModal, setShowMultiTimeframeModal] = useState(false);

  const [formData, setFormData] = useState<RateCardFormData>({
    name: rateCard?.name || '',
    description: rateCard?.description || '',
    active: rateCard?.active ?? true,
    cardType: rateCard?.cardType || 'PAY',
    templateId: rateCard?.templateId,
    templateName: rateCard?.templateName,
    rates: rateCard?.rates || [],
    expenses: rateCard?.expenses || [],
  });

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templatesQuery = query(
          collection(db, 'rateCardTemplates'),
          where('companyId', '==', companyId),
          where('active', '==', true)
        );
        const templatesSnap = await getDocs(templatesQuery);
        const templatesData = templatesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as RateCardTemplate));

        setTemplates(templatesData);

        // Set selected template if editing
        if (rateCard?.templateId) {
          const template = templatesData.find(t => t.id === rateCard.templateId);
          if (template) {
            setSelectedTemplate(template);
          }
        } else {
          // Select default template if creating new
          const defaultTemplate = templatesData.find(t => t.isDefault);
          if (defaultTemplate) {
            setSelectedTemplate(defaultTemplate);
            setFormData(prev => ({
              ...prev,
              templateId: defaultTemplate.id,
              templateName: defaultTemplate.name,
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [companyId, rateCard]);

  // Get resource categories and timeframe definitions from template or use legacy
  const resourceCategories = selectedTemplate?.resourceCategories || LEGACY_RESOURCE_CATEGORIES;
  const timeframeDefinitions = selectedTemplate?.timeframeDefinitions || [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
    setFormData(prev => ({
      ...prev,
      templateId: template?.id,
      templateName: template?.name,
      rates: [], // Clear rates when template changes
    }));
  };

  const openMultiTimeframeModal = () => {
    if (timeframeDefinitions.length === 0) {
      alert('Please select a template with timeframe definitions first');
      return;
    }
    setShowMultiTimeframeModal(true);
  };

  const handleMultiTimeframeSave = (entries: RateEntry[]) => {
    setFormData(prev => ({
      ...prev,
      rates: [...prev.rates, ...entries]
    }));
    setShowMultiTimeframeModal(false);
    // Expand the first newly added entry
    if (entries.length > 0) {
      setExpandedRateIndex(formData.rates.length);
    }
  };

  const removeRateEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rates: prev.rates.filter((_, i) => i !== index)
    }));

    // Adjust expanded index if needed
    if (expandedRateIndex === index) {
      setExpandedRateIndex(null);
    } else if (expandedRateIndex !== null && expandedRateIndex > index) {
      setExpandedRateIndex(expandedRateIndex - 1);
    }
  };

  const updateRateEntry = (index: number, field: keyof RateEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      rates: prev.rates.map((rate, i) => {
        if (i === index) {
          const updatedRate = { ...rate, [field]: value };

          // Auto-calculate margin when rates change
          if (field === 'subcontractorRate' || field === 'clientRate') {
            const subRate = field === 'subcontractorRate' ? value : updatedRate.subcontractorRate;
            const clientRate = field === 'clientRate' ? value : updatedRate.clientRate;
            updatedRate.marginValue = calculateMarginValue(clientRate, subRate);
            updatedRate.marginPercentage = calculateMarginPercentage(clientRate, subRate);
          }

          // Update timeframe name if timeframe changed
          if (field === 'timeframeId') {
            const timeframe = timeframeDefinitions.find(tf => tf.id === value);
            if (timeframe) {
              updatedRate.timeframeName = timeframe.name;
            }
          }

          return updatedRate;
        }
        return rate;
      })
    }));
  };

  const addExpenseEntry = () => {
    if (!selectedTemplate || selectedTemplate.expenseCategories.length === 0) {
      alert('Please select a template with expense categories first');
      return;
    }

    const firstExpense = selectedTemplate.expenseCategories[0];
    const newExpense: ExpenseEntry = {
      id: crypto.randomUUID(),
      categoryId: firstExpense.id,
      categoryName: firstExpense.name,
      description: '',
      unitType: firstExpense.unitType,
      rate: firstExpense.defaultRate || 0,
      rateType: firstExpense.rateType || 'CAPPED',
      taxable: firstExpense.taxable || false,
      notes: '',
    };

    setFormData(prev => ({
      ...prev,
      expenses: [...(prev.expenses || []), newExpense]
    }));
  };

  const removeExpenseEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter((_, i) => i !== index)
    }));
  };

  const updateExpenseEntry = (index: number, field: keyof ExpenseEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      expenses: (prev.expenses || []).map((expense, i) => {
        if (i === index) {
          const updated = { ...expense, [field]: value };

          // If category changed, update related fields
          if (field === 'categoryId' && selectedTemplate) {
            const category = selectedTemplate.expenseCategories.find(ec => ec.id === value);
            if (category) {
              updated.categoryName = category.name;
              updated.unitType = category.unitType;
              updated.rate = category.defaultRate || 0;
              updated.rateType = category.rateType || 'CAPPED';
              updated.taxable = category.taxable || false;
            }
          }

          return updated;
        }
        return expense;
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const toggleRateExpansion = (index: number) => {
    setExpandedRateIndex(expandedRateIndex === index ? null : index);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-gray-900">
              {rateCard ? 'Edit Rate Card' : 'Create New Rate Card'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-blue-600" />
              Rate Card Information
            </h4>

            {!loadingTemplates && templates.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-purple-900 mb-2">
                  Rate Card Template
                </label>
                <select
                  value={formData.templateId || ''}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-purple-700 mt-2 font-medium">
                  Choose a template to use predefined timeframes and expense categories
                </p>
              </div>
            )}

            {loadingTemplates && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Loading templates...</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate Card Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Standard Labour Rates 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of this rate card..."
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
                  Active rate card
                </label>
              </div>
            </div>
          </div>

          {/* Rate Entries */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                Labour & Resource Rates ({formData.rates.length})
              </h4>
              <button
                type="button"
                onClick={openMultiTimeframeModal}
                disabled={!selectedTemplate || timeframeDefinitions.length === 0}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rate Entry</span>
              </button>
            </div>

            {timeframeDefinitions.length === 0 && selectedTemplate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  The selected template has no timeframe definitions. Please select a different template or add timeframes to the current template.
                </p>
              </div>
            )}

            {formData.rates.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-3">No rate entries yet</p>
                <p className="text-sm text-gray-500 mb-4">Add entries for each role/resource and timeframe combination</p>
                <button
                  type="button"
                  onClick={openMultiTimeframeModal}
                  disabled={!selectedTemplate || timeframeDefinitions.length === 0}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Entry</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.rates.map((rate, index) => (
                  <RateEntryRow
                    key={index}
                    rate={rate}
                    index={index}
                    isExpanded={expandedRateIndex === index}
                    onToggleExpansion={() => toggleRateExpansion(index)}
                    onUpdate={updateRateEntry}
                    onRemove={removeRateEntry}
                    resourceCategories={resourceCategories}
                    timeframeDefinitions={timeframeDefinitions}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Expense Entries */}
          {selectedTemplate && selectedTemplate.expenseCategories.length > 0 && (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Receipt className="w-5 h-5 mr-2 text-purple-600" />
                  Expense Rates ({(formData.expenses || []).length})
                </h4>
                <button
                  type="button"
                  onClick={addExpenseEntry}
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Expense</span>
                </button>
              </div>

              {(formData.expenses || []).length > 0 && (
                <div className="space-y-3">
                  {(formData.expenses || []).map((expense, index) => (
                    <ExpenseEntryRow
                      key={expense.id}
                      expense={expense}
                      index={index}
                      onUpdate={updateExpenseEntry}
                      onRemove={removeExpenseEntry}
                      expenseCategories={selectedTemplate.expenseCategories}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : (rateCard ? 'Update Rate Card' : 'Create Rate Card')}
            </button>
          </div>
        </form>
      </div>
    </div>

      {/* Multi-Timeframe Modal */}
      {showMultiTimeframeModal && (
        <MultiTimeframeModal
          resourceCategories={resourceCategories}
          timeframeDefinitions={timeframeDefinitions}
          onSave={handleMultiTimeframeSave}
          onClose={() => setShowMultiTimeframeModal(false)}
        />
      )}
    </>
  );
}

// Multi-Timeframe Modal Component
function MultiTimeframeModal({
  resourceCategories,
  timeframeDefinitions,
  onSave,
  onClose
}: {
  resourceCategories: string[];
  timeframeDefinitions: TimeframeDefinition[];
  onSave: (entries: RateEntry[]) => void;
  onClose: () => void;
}) {
  const [roleName, setRoleName] = useState('');
  const [category, setCategory] = useState(resourceCategories[0] || 'Labour');
  const [description, setDescription] = useState('');
  
  // State for rates per timeframe
  const [timeframeRates, setTimeframeRates] = useState<{
    [timeframeId: string]: {
      subcontractorRate: number;
      clientRate: number;
      enabled: boolean;
    };
  }>(() => {
    // Initialize all timeframes as enabled with 0 rates
    const initial: any = {};
    timeframeDefinitions.forEach(tf => {
      initial[tf.id] = {
        subcontractorRate: 0,
        clientRate: 0,
        enabled: true
      };
    });
    return initial;
  });

  const updateTimeframeRate = (timeframeId: string, field: 'subcontractorRate' | 'clientRate', value: number) => {
    setTimeframeRates(prev => ({
      ...prev,
      [timeframeId]: {
        ...prev[timeframeId],
        [field]: value
      }
    }));
  };

  const toggleTimeframe = (timeframeId: string) => {
    setTimeframeRates(prev => ({
      ...prev,
      [timeframeId]: {
        ...prev[timeframeId],
        enabled: !prev[timeframeId].enabled
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roleName.trim()) {
      alert('Please enter a role name');
      return;
    }

    // Create rate entries for all enabled timeframes
    const entries: RateEntry[] = [];
    timeframeDefinitions.forEach(tf => {
      const rates = timeframeRates[tf.id];
      if (rates && rates.enabled) {
        const marginValue = calculateMarginValue(rates.clientRate, rates.subcontractorRate);
        const marginPercentage = calculateMarginPercentage(rates.clientRate, rates.subcontractorRate);
        
        entries.push({
          roleName: roleName.trim(),
          category,
          description: description.trim(),
          timeframeId: tf.id,
          timeframeName: tf.name,
          subcontractorRate: rates.subcontractorRate,
          clientRate: rates.clientRate,
          marginValue,
          marginPercentage,
          congestionChargeApplicable: false,
          congestionChargeAmount: 15,
          vehicleIncluded: false,
          driverIncluded: false,
          overtimeRules: '',
          specialConditions: '',
          invoicingNotes: '',
        });
      }
    });

    if (entries.length === 0) {
      alert('Please enable at least one timeframe');
      return;
    }

    onSave(entries);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Clock className="w-6 h-6 mr-2 text-green-600" />
            Add Rates for All Timeframes
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Role Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">Role / Resource Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="e.g., Fitter, Supervisor"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {resourceCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>

          {/* Timeframe Rates */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Rates by Timeframe</h4>
            <p className="text-xs text-gray-600 mb-4">
              Set rates for each timeframe. Uncheck timeframes that don't apply to this role.
            </p>
            
            <div className="space-y-3">
              {timeframeDefinitions.map(tf => {
                const rates = timeframeRates[tf.id];
                const daysDisplay = tf.applicableDays.length > 0
                  ? tf.applicableDays.map(d => d.slice(0, 3)).join(', ')
                  : 'All days';
                const marginValue = rates ? calculateMarginValue(rates.clientRate, rates.subcontractorRate) : 0;
                const marginPercentage = rates ? calculateMarginPercentage(rates.clientRate, rates.subcontractorRate) : 0;

                return (
                  <div
                    key={tf.id}
                    className={`border-2 rounded-lg p-4 transition ${
                      rates?.enabled 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-center pt-2">
                        <input
                          type="checkbox"
                          checked={rates?.enabled || false}
                          onChange={() => toggleTimeframe(tf.id)}
                          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h5 className="font-semibold text-gray-900">{tf.name}</h5>
                            <p className="text-xs text-gray-600">
                              {tf.startTime} - {tf.endTime} ({daysDisplay})
                            </p>
                            {tf.description && (
                              <p className="text-xs text-gray-500 mt-1">{tf.description}</p>
                            )}
                          </div>
                          {rates?.enabled && marginValue > 0 && (
                            <div className="text-right">
                              <div className="text-xs text-gray-600">Margin</div>
                              <div className="font-bold text-green-700">
                                £{marginValue.toFixed(2)} ({marginPercentage.toFixed(1)}%)
                              </div>
                            </div>
                          )}
                        </div>

                        {rates?.enabled && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Subcontractor Rate (£/hr) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required={rates.enabled}
                                min="0"
                                value={rates.subcontractorRate}
                                onChange={(e) => updateTimeframeRate(tf.id, 'subcontractorRate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Client Rate (£/hr) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required={rates.enabled}
                                min="0"
                                value={rates.clientRate}
                                onChange={(e) => updateTimeframeRate(tf.id, 'clientRate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rates</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Individual Rate Entry Row Component with Accordion
function RateEntryRow({
  rate,
  index,
  isExpanded,
  onToggleExpansion,
  onUpdate,
  onRemove,
  resourceCategories,
  timeframeDefinitions
}: {
  rate: RateEntry;
  index: number;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  onUpdate: (index: number, field: keyof RateEntry, value: any) => void;
  onRemove: (index: number) => void;
  resourceCategories: string[];
  timeframeDefinitions: TimeframeDefinition[];
}) {
  // Get timeframe details for display
  const timeframe = timeframeDefinitions.find(tf => tf.id === rate.timeframeId);
  const timeframeDisplay = timeframe
    ? `${timeframe.name} (${timeframe.startTime}-${timeframe.endTime})`
    : rate.timeframeName || 'Unknown';

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-blue-300 transition">
      {/* Collapsed Header - Always Visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpansion}
      >
        <div className="flex-1 flex items-center gap-4">
          <span className="text-sm font-bold text-gray-900 min-w-[60px]">#{index + 1}</span>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">
              {rate.roleName || <span className="text-gray-400 italic">Unnamed Role</span>}
            </div>
            <div className="text-xs text-gray-600 flex items-center gap-2 mt-1">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{rate.category}</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{timeframeDisplay}</span>
              {rate.marginValue !== undefined && rate.marginValue > 0 && (
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                  Margin: £{rate.marginValue.toFixed(2)} ({rate.marginPercentage?.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              Sub: £{rate.subcontractorRate.toFixed(2)}/hr | Client: £{rate.clientRate.toFixed(2)}/hr
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
          {/* Section 1: Role Details */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Tag className="w-4 h-4 mr-1" /> Role / Resource Details
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  value={rate.roleName}
                  onChange={(e) => onUpdate(index, 'roleName', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="e.g., Supervisor, Fitter"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                <select
                  required
                  value={rate.category}
                  onChange={(e) => onUpdate(index, 'category', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {resourceCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={rate.description || ''}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Timeframe Selection */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-1" /> Timeframe
            </h5>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Timeframe *</label>
                <select
                  required
                  value={rate.timeframeId}
                  onChange={(e) => onUpdate(index, 'timeframeId', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {timeframeDefinitions.map(tf => {
                    const daysDisplay = tf.applicableDays.length > 0
                      ? tf.applicableDays.map(d => d.slice(0, 3)).join(', ')
                      : 'All days';
                    return (
                      <option key={tf.id} value={tf.id}>
                        {tf.name} - {tf.startTime} to {tf.endTime} ({daysDisplay})
                      </option>
                    );
                  })}
                </select>
                {timeframe?.description && (
                  <p className="text-xs text-gray-600 mt-1">{timeframe.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Rates */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <DollarSign className="w-4 h-4 mr-1" /> Rates
            </h5>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subcontractor Rate (£/hr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={rate.subcontractorRate}
                    onChange={(e) => onUpdate(index, 'subcontractorRate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="15.00"
                  />
                  <p className="text-xs text-blue-700 mt-1">What you pay</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client Rate (£/hr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={rate.clientRate}
                    onChange={(e) => onUpdate(index, 'clientRate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="21.00"
                  />
                  <p className="text-xs text-blue-700 mt-1">What you charge</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Margin (Auto-calculated)</label>
                  <div className={`w-full px-3 py-2 text-sm rounded-lg border-2 font-bold text-center ${
                    (rate.marginValue || 0) > 0
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}>
                    {rate.marginValue !== undefined && rate.marginPercentage !== undefined
                      ? `£${rate.marginValue.toFixed(2)} (${rate.marginPercentage.toFixed(1)}%)`
                      : '—'}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Profit per hour</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Additional Options (Optional) */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-3">Additional Options (Optional)</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Overtime Rules</label>
                <input
                  type="text"
                  value={rate.overtimeRules || ''}
                  onChange={(e) => onUpdate(index, 'overtimeRules', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="e.g., 1.5x after 8 hours"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Special Conditions</label>
                <input
                  type="text"
                  value={rate.specialConditions || ''}
                  onChange={(e) => onUpdate(index, 'specialConditions', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Any special conditions"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Expense Entry Row Component
function ExpenseEntryRow({ expense, index, onUpdate, onRemove, expenseCategories }: {
  expense: ExpenseEntry;
  index: number;
  onUpdate: (index: number, field: keyof ExpenseEntry, value: any) => void;
  onRemove: (index: number) => void;
  expenseCategories: Array<{ id: string; name: string; unitType: string; defaultRate?: number; taxable?: boolean }>;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-900">Expense #{index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Expense Category *</label>
          <select
            required
            value={expense.categoryId}
            onChange={(e) => onUpdate(index, 'categoryId', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {expenseCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Rate (£) *</label>
          <input
            type="number"
            step="0.01"
            required
            value={expense.rate}
            onChange={(e) => onUpdate(index, 'rate', parseFloat(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
          <p className="text-xs text-gray-500 mt-1">{expense.unitType.replace('_', ' ')}</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={expense.description || ''}
            onChange={(e) => onUpdate(index, 'description', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>

        <div className="flex items-center">
          <label className="flex items-center mt-5">
            <input
              type="checkbox"
              checked={expense.taxable}
              onChange={(e) => onUpdate(index, 'taxable', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-xs text-gray-700">Taxable</span>
          </label>
        </div>
      </div>
    </div>
  );
}
