'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Clock, Receipt, Tag } from 'lucide-react';
import { RateCardTemplate, TimeframeDefinition, ExpenseCategory, DayOfWeek } from '@/lib/types';

interface RateCardTemplateFormProps {
  template: RateCardTemplate | null;
  onSave: (data: RateCardTemplateFormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export interface RateCardTemplateFormData {
  name: string;
  description: string;
  timeframeDefinitions: TimeframeDefinition[];
  expenseCategories: ExpenseCategory[];
  resourceCategories: string[];
  active: boolean;
  isDefault: boolean;
}

const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun'
};

export default function RateCardTemplateForm({ template, onSave, onClose, saving }: RateCardTemplateFormProps) {
  const [formData, setFormData] = useState<RateCardTemplateFormData>({
    name: template?.name || '',
    description: template?.description || '',
    timeframeDefinitions: template?.timeframeDefinitions || template?.shiftTypes || [
      { 
        id: crypto.randomUUID(), 
        name: 'Day Rate Mon-Fri', 
        description: 'Standard weekday working hours',
        startTime: '08:00',
        endTime: '17:00',
        applicableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      },
      { 
        id: crypto.randomUUID(), 
        name: 'Saturday Rate', 
        description: 'Saturday working hours',
        startTime: '08:00',
        endTime: '17:00',
        applicableDays: ['saturday']
      },
      { 
        id: crypto.randomUUID(), 
        name: 'Sunday Rate', 
        description: 'Sunday working hours',
        startTime: '08:00',
        endTime: '17:00',
        applicableDays: ['sunday']
      },
    ],
    expenseCategories: template?.expenseCategories || [
      { id: crypto.randomUUID(), name: 'Mileage', unitType: 'per_mile', defaultRate: 0.45, rateType: 'CAPPED', taxable: false },
      { id: crypto.randomUUID(), name: 'Accommodation', unitType: 'per_day', defaultRate: 80, rateType: 'FIXED', taxable: true },
      { id: crypto.randomUUID(), name: 'Parking Fees', unitType: 'flat', defaultRate: 15, rateType: 'FIXED', taxable: false },
    ],
    resourceCategories: template?.resourceCategories || ['Labour', 'Vehicle', 'Equipment', 'Specialist Service'],
    active: template?.active ?? true,
    isDefault: template?.isDefault ?? false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Timeframe Management
  const addTimeframe = () => {
    setFormData(prev => ({
      ...prev,
      timeframeDefinitions: [
        ...prev.timeframeDefinitions,
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          startTime: '08:00',
          endTime: '17:00',
          applicableDays: []
        }
      ]
    }));
  };

  const removeTimeframe = (index: number) => {
    setFormData(prev => ({
      ...prev,
      timeframeDefinitions: prev.timeframeDefinitions.filter((_, i) => i !== index)
    }));
  };

  const updateTimeframe = (index: number, field: keyof TimeframeDefinition, value: any) => {
    setFormData(prev => ({
      ...prev,
      timeframeDefinitions: prev.timeframeDefinitions.map((tf, i) => 
        i === index ? { ...tf, [field]: value } : tf
      )
    }));
  };

  const toggleTimeframeDay = (index: number, day: DayOfWeek) => {
    setFormData(prev => ({
      ...prev,
      timeframeDefinitions: prev.timeframeDefinitions.map((tf, i) => {
        if (i === index) {
          const currentDays = tf.applicableDays || [];
          const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
          return { ...tf, applicableDays: newDays };
        }
        return tf;
      })
    }));
  };

  // Expense Category Management
  const addExpenseCategory = () => {
    setFormData(prev => ({
      ...prev,
      expenseCategories: [
        ...prev.expenseCategories,
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          unitType: 'flat',
          defaultRate: 0,
          rateType: 'CAPPED',
          taxable: false,
        }
      ]
    }));
  };

  const removeExpenseCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      expenseCategories: prev.expenseCategories.filter((_, i) => i !== index)
    }));
  };

  const updateExpenseCategory = (index: number, field: keyof ExpenseCategory, value: any) => {
    setFormData(prev => ({
      ...prev,
      expenseCategories: prev.expenseCategories.map((ec, i) => 
        i === index ? { ...ec, [field]: value } : ec
      )
    }));
  };

  // Resource Category Management
  const addResourceCategory = () => {
    setFormData(prev => ({
      ...prev,
      resourceCategories: [...prev.resourceCategories, '']
    }));
  };

  const removeResourceCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      resourceCategories: prev.resourceCategories.filter((_, i) => i !== index)
    }));
  };

  const updateResourceCategory = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      resourceCategories: prev.resourceCategories.map((rc, i) => 
        i === index ? value : rc
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate timeframes
    if (formData.timeframeDefinitions.length === 0) {
      alert('Please add at least one timeframe definition');
      return;
    }
    
    if (formData.timeframeDefinitions.some(tf => !tf.name || !tf.startTime || !tf.endTime)) {
      alert('Please ensure all timeframes have a name, start time, and end time');
      return;
    }

    // Validate resource categories
    if (formData.resourceCategories.some(rc => !rc.trim())) {
      alert('Please ensure all resource categories have a name');
      return;
    }

    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">
            {template ? 'Edit Rate Card Template' : 'Create Rate Card Template'}
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
              Template Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Standard UK Construction Rates"
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
                  placeholder="Brief description of this template..."
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as Default Template</span>
                </label>
              </div>
            </div>
          </div>

          {/* Timeframe Definitions */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Timeframe Definitions ({formData.timeframeDefinitions.length})
              </h4>
              <button
                type="button"
                onClick={addTimeframe}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Timeframe</span>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">💡 What are Timeframe Definitions?</p>
              <p className="text-sm text-blue-800">
                Timeframes define when different rates apply (e.g., "Day Rate Mon-Fri 08:00-17:00", "Night Rate 18:00-06:00", "Weekend Rate"). 
                When creating rate cards, you'll select from these timeframes and specify the actual rates for each role.
              </p>
            </div>

            <div className="space-y-3">
              {formData.timeframeDefinitions.map((timeframe, index) => (
                <div key={timeframe.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">Timeframe #{index + 1}</span>
                    {formData.timeframeDefinitions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeframe(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Name and Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Timeframe Name *</label>
                        <input
                          type="text"
                          required
                          value={timeframe.name}
                          onChange={(e) => updateTimeframe(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Day Rate Mon-Fri, Night Rate"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={timeframe.description || ''}
                          onChange={(e) => updateTimeframe(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Time Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Start Time *</label>
                        <input
                          type="time"
                          required
                          value={timeframe.startTime}
                          onChange={(e) => updateTimeframe(index, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">End Time *</label>
                        <input
                          type="time"
                          required
                          value={timeframe.endTime}
                          onChange={(e) => updateTimeframe(index, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Applicable Days */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        📅 Applicable Days *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {allDays.map(day => {
                          const isChecked = timeframe.applicableDays?.includes(day) || false;
                          return (
                            <label
                              key={day}
                              className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? 'bg-blue-100 border-blue-400 text-blue-900'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTimeframeDay(index, day)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                              />
                              <span className="text-sm font-medium">{dayLabels[day]}</span>
                            </label>
                          );
                        })}
                      </div>
                      {timeframe.applicableDays && timeframe.applicableDays.length > 0 ? (
                        <p className="text-xs text-blue-700 mt-2">
                          ✓ This timeframe applies on: {timeframe.applicableDays.map(d => dayLabels[d]).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ Please select at least one day
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Categories */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-green-600" />
                Expense Categories ({formData.expenseCategories.length})
              </h4>
              <button
                type="button"
                onClick={addExpenseCategory}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>

            <div className="space-y-3">
              {formData.expenseCategories.map((expense, index) => (
                <div key={expense.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">Expense #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExpenseCategory(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Expense Name *</label>
                        <input
                          type="text"
                          required
                          value={expense.name}
                          onChange={(e) => updateExpenseCategory(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Mileage, Accommodation"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Unit Type *</label>
                        <select
                          required
                          value={expense.unitType}
                          onChange={(e) => updateExpenseCategory(index, 'unitType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="flat">Flat Rate</option>
                          <option value="per_unit">Per Unit</option>
                          <option value="per_mile">Per Mile</option>
                          <option value="per_day">Per Day</option>
                          <option value="per_hour">Per Hour</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Rate Type *</label>
                        <select
                          required
                          value={expense.rateType || 'CAPPED'}
                          onChange={(e) => updateExpenseCategory(index, 'rateType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="CAPPED">Capped (Max per unit)</option>
                          <option value="FIXED">Fixed (Exact per unit)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {expense.rateType === 'FIXED' ? '📌 Fixed: Always paid at this rate per unit' : '🔒 Capped: Maximum rate per unit allowed'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Default Rate (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={expense.defaultRate || ''}
                          onChange={(e) => updateExpenseCategory(index, 'defaultRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={expense.taxable || false}
                            onChange={(e) => updateExpenseCategory(index, 'taxable', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-xs text-gray-700">Taxable</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resource Categories */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-purple-600" />
                Resource Categories ({formData.resourceCategories.length})
              </h4>
              <button
                type="button"
                onClick={addResourceCategory}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {formData.resourceCategories.map((category, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => updateResourceCategory(index, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Labour, Vehicle, Equipment"
                  />
                  {formData.resourceCategories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeResourceCategory(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

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
              {saving ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
