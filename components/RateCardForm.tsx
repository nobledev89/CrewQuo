'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { X, Plus, Trash2, DollarSign, Tag, Calendar, Truck, Clock, Receipt } from 'lucide-react';
import { RateCard, RateEntry, ResourceCategory, ShiftType, RateCardTemplate, ExpenseEntry } from '@/lib/types';

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
const LEGACY_SHIFT_TYPES: ShiftType[] = [
  'Mon–Fri (1st 8 hours)',
  'Friday & Saturday nights',
  'Saturday & Mon–Thurs nights',
  'Sunday'
];

export default function RateCardForm({ rateCard, onSave, onClose, saving, companyId }: RateCardFormProps) {
  const [templates, setTemplates] = useState<RateCardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RateCardTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
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

  // Get resource categories and shift types from template or use legacy
  const resourceCategories = selectedTemplate?.resourceCategories || LEGACY_RESOURCE_CATEGORIES;
  const shiftTypes = selectedTemplate?.shiftTypes || 
    LEGACY_SHIFT_TYPES.map(st => ({ id: st, name: st, rateMultiplier: 1.0 }));

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
      cardType: undefined, // Removed - no longer used
    }));
  };

  const addRateEntry = () => {
    const firstShiftType = shiftTypes[0];
    const newEntry: RateEntry = {
      roleName: '',
      category: resourceCategories[0] || 'Labour',
      description: '',
      shiftType: firstShiftType.name,
      shiftTypeId: firstShiftType.id,
      rateMultiplier: firstShiftType.rateMultiplier,
      baseRate: 0,
      subcontractorRate: 0,
      clientRate: 0,
      marginValue: 0,
      marginPercentage: 0,
      startTime: '',
      endTime: '',
      totalHours: undefined,
      hourlyRate: null,
      rate4Hours: null,
      rate8Hours: null,
      rate9Hours: null,
      rate10Hours: null,
      rate12Hours: null,
      flatShiftRate: null,
      congestionChargeApplicable: false,
      congestionChargeAmount: 15,
      additionalPerPersonCharge: undefined,
      dropOffCharge: undefined,
      vehicleIncluded: false,
      driverIncluded: false,
      overtimeRules: '',
      specialConditions: '',
      invoicingNotes: '',
    };
    
    setFormData(prev => ({
      ...prev,
      rates: [...prev.rates, newEntry]
    }));
  };

  const removeRateEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rates: prev.rates.filter((_, i) => i !== index)
    }));
  };

  const updateRateEntry = (index: number, field: keyof RateEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      rates: prev.rates.map((rate, i) => {
        if (i === index) {
          const updatedRate = { ...rate, [field]: value };
          
          // If shift type changed, update multiplier and calculated rates
          if (field === 'shiftType') {
            const shiftType = shiftTypes.find(st => st.name === value);
            if (shiftType) {
              updatedRate.shiftTypeId = shiftType.id;
              updatedRate.rateMultiplier = shiftType.rateMultiplier;
              
              // Recalculate hourly rate if base rate exists
              if (updatedRate.baseRate) {
                updatedRate.hourlyRate = updatedRate.baseRate * shiftType.rateMultiplier;
              }
            }
          }
          
          // If base rate changed, recalculate hourly rate
          if (field === 'baseRate' && updatedRate.rateMultiplier) {
            updatedRate.hourlyRate = value * updatedRate.rateMultiplier;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
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
                  📋 Rate Card Template
                </label>
                <select
                  value={formData.templateId || ''}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">No Template (Legacy Mode)</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-purple-700 mt-2 font-medium">
                  💡 Choose a template to automatically use predefined shift types, resource categories, and expense types - making rate card creation faster and more consistent!
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

              <div className="md:col-span-2">
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
                onClick={addRateEntry}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rate Entry</span>
              </button>
            </div>

            {formData.rates.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-3">No rate entries yet</p>
                <p className="text-sm text-gray-500 mb-4">Add rows for each role/resource, shift type, and pricing combination</p>
                <button
                  type="button"
                  onClick={addRateEntry}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Entry</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {formData.rates.map((rate, index) => (
                  <RateEntryRow
                    key={index}
                    rate={rate}
                    index={index}
                    onUpdate={updateRateEntry}
                    onRemove={removeRateEntry}
                    resourceCategories={resourceCategories}
                    shiftTypes={shiftTypes}
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
  );
}

// Individual Rate Entry Row Component
function RateEntryRow({ rate, index, onUpdate, onRemove, resourceCategories, shiftTypes }: {
  rate: RateEntry;
  index: number;
  onUpdate: (index: number, field: keyof RateEntry, value: any) => void;
  onRemove: (index: number) => void;
  resourceCategories: string[];
  shiftTypes: Array<{ id: string; name: string; rateMultiplier: number }>;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-gray-900">Entry #{index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Section 1: Role / Resource Details */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Tag className="w-4 h-4 mr-1" /> 1. Role / Resource Details
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role / Resource Name *</label>
            <input
              type="text"
              required
              value={rate.roleName}
              onChange={(e) => onUpdate(index, 'roleName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Supervisor, Fitter, Driver"
            />
          </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select
                required
                value={rate.category}
                onChange={(e) => onUpdate(index, 'category', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {resourceCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description / Notes</label>
            <input
              type="text"
              value={rate.description || ''}
              onChange={(e) => onUpdate(index, 'description', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Shift Type */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Clock className="w-4 h-4 mr-1" /> 2. Shift Type
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Shift Type *</label>
            <select
              required
              value={rate.shiftType}
              onChange={(e) => onUpdate(index, 'shiftType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {shiftTypes.map(shift => (
                <option key={shift.id} value={shift.name}>
                  {shift.name} ({shift.rateMultiplier}x)
                </option>
              ))}
            </select>
            {rate.rateMultiplier && rate.rateMultiplier !== 1 && (
              <p className="text-xs text-blue-600 mt-1">Multiplier: {rate.rateMultiplier}x</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Time & Duration */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3">3. Time & Duration (Optional)</h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={rate.startTime || ''}
              onChange={(e) => onUpdate(index, 'startTime', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={rate.endTime || ''}
              onChange={(e) => onUpdate(index, 'endTime', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Hours</label>
            <input
              type="number"
              step="0.5"
              value={rate.totalHours || ''}
              onChange={(e) => onUpdate(index, 'totalHours', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 8"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Pricing Fields - Combined Subcontractor & Client Rates */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <DollarSign className="w-4 h-4 mr-1" /> 4. Pricing Fields - Subcontractor & Client Rates
        </h5>
        
        {/* Primary Rates */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-blue-900 mb-3">💷 Primary Rates (Required)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subcontractor Rate (£/hr) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={rate.subcontractorRate ?? ''}
                onChange={(e) => {
                  const subRate = e.target.value ? parseFloat(e.target.value) : 0;
                  const clientRate = rate.clientRate || 0;
                  const margin = clientRate - subRate;
                  const marginPct = clientRate > 0 ? (margin / clientRate) * 100 : 0;
                  onUpdate(index, 'subcontractorRate', subRate);
                  onUpdate(index, 'marginValue', Math.max(0, margin));
                  onUpdate(index, 'marginPercentage', Math.max(0, marginPct));
                }}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="15.00"
              />
              <p className="text-xs text-blue-700 mt-1">What you pay the subcontractor</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client Rate (£/hr) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={rate.clientRate ?? ''}
                onChange={(e) => {
                  const clientRate = e.target.value ? parseFloat(e.target.value) : 0;
                  const subRate = rate.subcontractorRate || 0;
                  const margin = clientRate - subRate;
                  const marginPct = clientRate > 0 ? (margin / clientRate) * 100 : 0;
                  onUpdate(index, 'clientRate', clientRate);
                  onUpdate(index, 'marginValue', Math.max(0, margin));
                  onUpdate(index, 'marginPercentage', Math.max(0, marginPct));
                }}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="21.00"
              />
              <p className="text-xs text-blue-700 mt-1">What you charge the client</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Margin (Read-Only)</label>
              <div className={`w-full px-3 py-2 text-sm rounded-lg border-2 font-bold text-center ${
                (rate.marginValue || 0) > 0 
                  ? 'bg-green-50 border-green-300 text-green-700' 
                  : (rate.marginValue || 0) > 0 
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
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

        {/* Legacy/Additional Rates */}
        <p className="text-xs font-semibold text-gray-600 mb-2">Legacy Rates (Optional)</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Base Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.baseRate ?? ''}
              onChange={(e) => onUpdate(index, 'baseRate', e.target.value ? parseFloat(e.target.value) : 0)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">Before multiplier</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hourly Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.hourlyRate ?? ''}
              onChange={(e) => onUpdate(index, 'hourlyRate', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">4-Hour Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.rate4Hours ?? ''}
              onChange={(e) => onUpdate(index, 'rate4Hours', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">8-Hour Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.rate8Hours ?? ''}
              onChange={(e) => onUpdate(index, 'rate8Hours', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">12-Hour Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.rate12Hours ?? ''}
              onChange={(e) => onUpdate(index, 'rate12Hours', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flat Shift Rate (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.flatShiftRate ?? ''}
              onChange={(e) => onUpdate(index, 'flatShiftRate', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Additional Charges */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Truck className="w-4 h-4 mr-1" /> 5. Additional Charges
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="flex items-center text-xs font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={rate.congestionChargeApplicable}
                onChange={(e) => onUpdate(index, 'congestionChargeApplicable', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              />
              Congestion Charge Applicable
            </label>
            {rate.congestionChargeApplicable && (
              <input
                type="number"
                step="0.01"
                value={rate.congestionChargeAmount || 15}
                onChange={(e) => onUpdate(index, 'congestionChargeAmount', parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="15.00"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Per-Person Charge (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.additionalPerPersonCharge || ''}
              onChange={(e) => onUpdate(index, 'additionalPerPersonCharge', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Drop-off Charge (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={rate.dropOffCharge || ''}
              onChange={(e) => onUpdate(index, 'dropOffCharge', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={rate.vehicleIncluded}
                onChange={(e) => onUpdate(index, 'vehicleIncluded', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              />
              Vehicle Included
            </label>
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={rate.driverIncluded}
                onChange={(e) => onUpdate(index, 'driverIncluded', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              />
              Driver Included
            </label>
          </div>
        </div>
      </div>

      {/* Section 6: Comments & Rules */}
      <div>
        <h5 className="text-sm font-semibold text-gray-700 mb-3">6. Comments & Rules</h5>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Overtime Rules</label>
            <input
              type="text"
              value={rate.overtimeRules || ''}
              onChange={(e) => onUpdate(index, 'overtimeRules', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 1.5x after 8 hours"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Special Conditions</label>
            <input
              type="text"
              value={rate.specialConditions || ''}
              onChange={(e) => onUpdate(index, 'specialConditions', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Any special conditions or requirements"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes for Invoicing</label>
            <input
              type="text"
              value={rate.invoicingNotes || ''}
              onChange={(e) => onUpdate(index, 'invoicingNotes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Internal notes for invoicing"
            />
          </div>
        </div>
      </div>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Rate (GBP) *</label>
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
