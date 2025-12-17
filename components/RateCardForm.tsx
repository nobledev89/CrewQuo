'use client';

import { useState } from 'react';
import { X, Plus, Trash2, DollarSign, Tag, Calendar, Truck, Clock } from 'lucide-react';
import { RateCard, RateEntry, ResourceCategory, ShiftType } from '@/lib/types';

interface RateCardFormProps {
  rateCard: RateCard | null;
  onSave: (data: RateCardFormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export interface RateCardFormData {
  name: string;
  description: string;
  active: boolean;
  rates: RateEntry[];
}

const RESOURCE_CATEGORIES: ResourceCategory[] = ['Labour', 'Vehicle', 'Specialist Service', 'Other'];
const SHIFT_TYPES: ShiftType[] = [
  'Mon–Fri (1st 8 hours)',
  'Friday & Saturday nights',
  'Saturday & Mon–Thurs nights',
  'Sunday'
];

export default function RateCardForm({ rateCard, onSave, onClose, saving }: RateCardFormProps) {
  const [formData, setFormData] = useState<RateCardFormData>({
    name: rateCard?.name || '',
    description: rateCard?.description || '',
    active: rateCard?.active ?? true,
    rates: rateCard?.rates || [],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const addRateEntry = () => {
    const newEntry: RateEntry = {
      roleName: '',
      category: 'Labour',
      description: '',
      shiftType: 'Mon–Fri (1st 8 hours)',
      startTime: '',
      endTime: '',
      totalHours: undefined,
      hourlyRate: null,
      rate4Hours: null,
      rate8Hours: null,
      rate9Hours: null,
      rate10Hours: null,
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
          return { ...rate, [field]: value };
        }
        return rate;
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
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
                Rate Entries ({formData.rates.length})
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
                  />
                ))}
              </div>
            )}
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
              {saving ? 'Saving...' : (rateCard ? 'Update Rate Card' : 'Create Rate Card')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Individual Rate Entry Row Component
function RateEntryRow({ rate, index, onUpdate, onRemove }: {
  rate: RateEntry;
  index: number;
  onUpdate: (index: number, field: keyof RateEntry, value: any) => void;
  onRemove: (index: number) => void;
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
              onChange={(e) => onUpdate(index, 'category', e.target.value as ResourceCategory)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {RESOURCE_CATEGORIES.map(cat => (
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
              onChange={(e) => onUpdate(index, 'shiftType', e.target.value as ShiftType)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {SHIFT_TYPES.map(shift => (
                <option key={shift} value={shift}>{shift}</option>
              ))}
            </select>
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

      {/* Section 4: Pricing Fields */}
      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <DollarSign className="w-4 h-4 mr-1" /> 4. Pricing Fields
        </h5>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hourly Rate (£)</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">4-Hour Rate (£)</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">8-Hour Rate (£)</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">9-Hour Rate (£)</label>
            <input
              type="number"
              step="0.01"
              value={rate.rate9Hours ?? ''}
              onChange={(e) => onUpdate(index, 'rate9Hours', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">10-Hour Rate (£)</label>
            <input
              type="number"
              step="0.01"
              value={rate.rate10Hours ?? ''}
              onChange={(e) => onUpdate(index, 'rate10Hours', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flat Shift Rate (£)</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Per-Person Charge (£)</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Drop-off Charge (£)</label>
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
