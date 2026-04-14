'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Clock, Receipt, Tag, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
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

// ── Bank holiday presets ────────────────────────────────────────────────────
const HOLIDAY_PRESETS: Array<{
  label: string;
  dates: Array<{ date: string; name: string }>;
}> = [
  {
    label: 'England & Wales 2025',
    dates: [
      { date: '2025-01-01', name: "New Year's Day" },
      { date: '2025-04-18', name: 'Good Friday' },
      { date: '2025-04-21', name: 'Easter Monday' },
      { date: '2025-05-05', name: 'Early May Bank Holiday' },
      { date: '2025-05-26', name: 'Spring Bank Holiday' },
      { date: '2025-08-25', name: 'Summer Bank Holiday' },
      { date: '2025-12-25', name: 'Christmas Day' },
      { date: '2025-12-26', name: 'Boxing Day' },
    ],
  },
  {
    label: 'England & Wales 2026',
    dates: [
      { date: '2026-01-01', name: "New Year's Day" },
      { date: '2026-04-03', name: 'Good Friday' },
      { date: '2026-04-06', name: 'Easter Monday' },
      { date: '2026-05-04', name: 'Early May Bank Holiday' },
      { date: '2026-05-25', name: 'Spring Bank Holiday' },
      { date: '2026-08-31', name: 'Summer Bank Holiday' },
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-28', name: 'Boxing Day (substitute)' },
    ],
  },
  {
    label: 'Scotland 2025',
    dates: [
      { date: '2025-01-01', name: "New Year's Day" },
      { date: '2025-01-02', name: "2 January" },
      { date: '2025-04-18', name: 'Good Friday' },
      { date: '2025-05-05', name: 'Early May Bank Holiday' },
      { date: '2025-05-26', name: 'Spring Bank Holiday' },
      { date: '2025-08-04', name: 'Summer Bank Holiday' },
      { date: '2025-11-30', name: "St Andrew's Day" },
      { date: '2025-12-25', name: 'Christmas Day' },
      { date: '2025-12-26', name: 'Boxing Day' },
    ],
  },
];

export default function RateCardTemplateForm({ template, onSave, onClose, saving }: RateCardTemplateFormProps) {
  // Split existing timeframeDefinitions by type on initialisation
  const existingDefs: TimeframeDefinition[] = template?.timeframeDefinitions || template?.shiftTypes || [];
  const initialStandard = existingDefs.filter(tf => tf.type !== 'holiday');
  const initialHoliday = existingDefs.filter(tf => tf.type === 'holiday');

  const [formData, setFormData] = useState<RateCardTemplateFormData>({
    name: template?.name || '',
    description: template?.description || '',
    timeframeDefinitions: [
      // Default standard timeframes for brand-new templates
      ...(initialStandard.length > 0 ? initialStandard : [
        {
          id: crypto.randomUUID(),
          name: 'Day Rate Mon-Fri',
          description: 'Standard weekday working hours',
          type: 'standard' as const,
          startTime: '08:00',
          endTime: '17:00',
          applicableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as DayOfWeek[],
        },
        {
          id: crypto.randomUUID(),
          name: 'Saturday Rate',
          description: 'Saturday working hours',
          type: 'standard' as const,
          startTime: '08:00',
          endTime: '17:00',
          applicableDays: ['saturday'] as DayOfWeek[],
        },
        {
          id: crypto.randomUUID(),
          name: 'Sunday Rate',
          description: 'Sunday working hours',
          type: 'standard' as const,
          startTime: '08:00',
          endTime: '17:00',
          applicableDays: ['sunday'] as DayOfWeek[],
        },
      ]),
      ...initialHoliday,
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

  const [expandedHolidayIndex, setExpandedHolidayIndex] = useState<number | null>(null);

  // ── Derived splits ────────────────────────────────────────────────────────
  const standardTimeframes = formData.timeframeDefinitions.filter(tf => tf.type !== 'holiday');
  const holidayTimeframes = formData.timeframeDefinitions.filter(tf => tf.type === 'holiday');

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setAllDefs = (defs: TimeframeDefinition[]) =>
    setFormData(prev => ({ ...prev, timeframeDefinitions: defs }));

  const allDefs = formData.timeframeDefinitions;

  // ── Standard timeframe CRUD ───────────────────────────────────────────────
  const addTimeframe = () => {
    setAllDefs([
      ...allDefs,
      {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        type: 'standard',
        startTime: '08:00',
        endTime: '17:00',
        applicableDays: [],
      },
    ]);
  };

  const removeTimeframe = (id: string) =>
    setAllDefs(allDefs.filter(tf => tf.id !== id));

  const updateTimeframe = (id: string, field: keyof TimeframeDefinition, value: any) =>
    setAllDefs(allDefs.map(tf => (tf.id === id ? { ...tf, [field]: value } : tf)));

  const toggleTimeframeDay = (id: string, day: DayOfWeek) => {
    setAllDefs(allDefs.map(tf => {
      if (tf.id !== id) return tf;
      const days = tf.applicableDays || [];
      return {
        ...tf,
        applicableDays: days.includes(day) ? days.filter(d => d !== day) : [...days, day],
      };
    }));
  };

  // ── Holiday timeframe CRUD ────────────────────────────────────────────────
  const addHolidayTimeframe = () => {
    const newEntry: TimeframeDefinition = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      type: 'holiday',
      startTime: '00:00',
      endTime: '23:59',
      applicableDays: [],
      holidayDates: [],
      holidayMultiplier: undefined,
    };
    setAllDefs([...allDefs, newEntry]);
    setExpandedHolidayIndex(holidayTimeframes.length); // expand the new entry
  };

  const removeHolidayTimeframe = (id: string) => {
    setAllDefs(allDefs.filter(tf => tf.id !== id));
    setExpandedHolidayIndex(null);
  };

  const updateHolidayTimeframe = (id: string, field: keyof TimeframeDefinition, value: any) =>
    setAllDefs(allDefs.map(tf => (tf.id === id ? { ...tf, [field]: value } : tf)));

  const addDateToHoliday = (id: string, isoDate: string, suggestedName?: string) => {
    setAllDefs(allDefs.map(tf => {
      if (tf.id !== id) return tf;
      const dates = tf.holidayDates || [];
      if (dates.includes(isoDate)) return tf;
      const newDates = [...dates, isoDate].sort();
      // If no name yet and a suggestedName is provided, set it
      const name = tf.name || suggestedName || '';
      return { ...tf, holidayDates: newDates, name };
    }));
  };

  const removeDateFromHoliday = (id: string, isoDate: string) =>
    setAllDefs(allDefs.map(tf =>
      tf.id === id ? { ...tf, holidayDates: (tf.holidayDates || []).filter(d => d !== isoDate) } : tf
    ));

  const applyPreset = (presetLabel: string, targetId: string) => {
    const preset = HOLIDAY_PRESETS.find(p => p.label === presetLabel);
    if (!preset) return;
    setAllDefs(allDefs.map(tf => {
      if (tf.id !== targetId) return tf;
      // Merge preset dates (deduplicated + sorted)
      const existing = tf.holidayDates || [];
      const merged = Array.from(new Set([...existing, ...preset.dates.map(d => d.date)])).sort();
      return { ...tf, holidayDates: merged, name: tf.name || preset.label };
    }));
  };

  // ── Expense Category CRUD ─────────────────────────────────────────────────
  const addExpenseCategory = () => {
    setFormData(prev => ({
      ...prev,
      expenseCategories: [
        ...prev.expenseCategories,
        { id: crypto.randomUUID(), name: '', description: '', unitType: 'flat', defaultRate: 0, rateType: 'CAPPED', taxable: false },
      ],
    }));
  };

  const removeExpenseCategory = (index: number) =>
    setFormData(prev => ({ ...prev, expenseCategories: prev.expenseCategories.filter((_, i) => i !== index) }));

  const updateExpenseCategory = (index: number, field: keyof ExpenseCategory, value: any) =>
    setFormData(prev => ({
      ...prev,
      expenseCategories: prev.expenseCategories.map((ec, i) => (i === index ? { ...ec, [field]: value } : ec)),
    }));

  // ── Resource Category CRUD ────────────────────────────────────────────────
  const addResourceCategory = () =>
    setFormData(prev => ({ ...prev, resourceCategories: [...prev.resourceCategories, ''] }));

  const removeResourceCategory = (index: number) =>
    setFormData(prev => ({ ...prev, resourceCategories: prev.resourceCategories.filter((_, i) => i !== index) }));

  const updateResourceCategory = (index: number, value: string) =>
    setFormData(prev => ({ ...prev, resourceCategories: prev.resourceCategories.map((rc, i) => (i === index ? value : rc)) }));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (standardTimeframes.length === 0) {
      alert('Please add at least one standard timeframe definition');
      return;
    }
    if (standardTimeframes.some(tf => !tf.name || !tf.startTime || !tf.endTime)) {
      alert('Please ensure all standard timeframes have a name, start time, and end time');
      return;
    }
    if (formData.resourceCategories.some(rc => !rc.trim())) {
      alert('Please ensure all resource categories have a name');
      return;
    }
    if (holidayTimeframes.some(tf => !tf.name)) {
      alert('Please give each holiday entry a name');
      return;
    }

    await onSave(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">
            {template ? 'Edit Rate Card Template' : 'Create Rate Card Template'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ── Template Information ─────────────────────────────────────── */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-blue-600" />
              Template Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
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
                  <input type="checkbox" name="active" checked={formData.active} onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleInputChange}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500" />
                  <span className="ml-2 text-sm text-gray-700">Set as Default Template</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Standard Timeframe Definitions ───────────────────────────── */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Timeframe Definitions ({standardTimeframes.length})
              </h4>
              <button type="button" onClick={addTimeframe}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Timeframe</span>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-semibold mb-1">What are Timeframe Definitions?</p>
              <p className="text-sm text-blue-800">
                Define recurring work periods (e.g. "Day Rate Mon–Fri 08:00–17:00", "Night Rate", "Weekend").
                Rate cards use these to set actual pay and bill rates per role.
              </p>
            </div>

            <div className="space-y-3">
              {standardTimeframes.map((timeframe, idx) => (
                <div key={timeframe.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">Timeframe #{idx + 1}</span>
                    {standardTimeframes.length > 1 && (
                      <button type="button" onClick={() => removeTimeframe(timeframe.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Timeframe Name *</label>
                        <input type="text" required value={timeframe.name}
                          onChange={(e) => updateTimeframe(timeframe.id, 'name', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Day Rate Mon-Fri, Night Rate" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input type="text" value={timeframe.description || ''}
                          onChange={(e) => updateTimeframe(timeframe.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Start Time *</label>
                        <input type="time" required value={timeframe.startTime}
                          onChange={(e) => updateTimeframe(timeframe.id, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">End Time *</label>
                        <input type="time" required value={timeframe.endTime}
                          onChange={(e) => updateTimeframe(timeframe.id, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Applicable Days *</label>
                      <div className="flex flex-wrap gap-2">
                        {allDays.map(day => {
                          const checked = timeframe.applicableDays?.includes(day) || false;
                          return (
                            <label key={day} className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition ${
                              checked ? 'bg-blue-100 border-blue-400 text-blue-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={checked}
                                onChange={() => toggleTimeframeDay(timeframe.id, day)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2" />
                              <span className="text-sm font-medium">{dayLabels[day]}</span>
                            </label>
                          );
                        })}
                      </div>
                      {timeframe.applicableDays?.length ? (
                        <p className="text-xs text-blue-700 mt-2">
                          Applies on: {timeframe.applicableDays.map(d => dayLabels[d]).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 mt-2">Please select at least one day</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Holiday Calendar ──────────────────────────────────────────── */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2 text-orange-600" />
                Holiday Calendar ({holidayTimeframes.length})
              </h4>
              <button type="button" onClick={addHolidayTimeframe}
                className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Holiday Group</span>
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-900 font-semibold mb-1">How holiday rates work</p>
              <p className="text-sm text-orange-800">
                Define public holiday groups (e.g. "Bank Holidays 2025"). When a time log date matches a date in a
                holiday group, the system automatically applies either a <strong>dedicated rate entry</strong> from the
                rate card for that group, or the <strong>fallback multiplier</strong> (e.g. ×2 = double time) applied
                to the standard rate. Use the <em>Sync Now</em> button after saving to update rate cards.
              </p>
            </div>

            {holidayTimeframes.length === 0 && (
              <div className="bg-gray-50 rounded-lg p-6 text-center border-2 border-dashed border-gray-300">
                <CalendarDays className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No holiday groups yet</p>
                <p className="text-xs text-gray-500 mt-1">Add a holiday group to define public holidays and their premium rates</p>
              </div>
            )}

            <div className="space-y-3">
              {holidayTimeframes.map((hf, hIdx) => {
                const isExpanded = expandedHolidayIndex === hIdx;
                return (
                  <div key={hf.id} className="bg-orange-50 rounded-lg border border-orange-200 overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <button type="button" onClick={() => setExpandedHolidayIndex(isExpanded ? null : hIdx)}
                        className="flex items-center space-x-3 flex-1 text-left">
                        <span className="text-sm font-bold text-orange-900">
                          {hf.name || `Holiday Group #${hIdx + 1}`}
                        </span>
                        {(hf.holidayDates?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-200 text-orange-800 font-medium">
                            {hf.holidayDates!.length} date{hf.holidayDates!.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {hf.holidayMultiplier && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-200 text-yellow-800 font-medium">
                            ×{hf.holidayMultiplier} multiplier
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-orange-600" /> : <ChevronDown className="w-4 h-4 text-orange-600" />}
                      </button>
                      <button type="button" onClick={() => removeHolidayTimeframe(hf.id)}
                        className="ml-3 p-1 text-red-600 hover:bg-red-50 rounded transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-orange-200">
                        {/* Name & multiplier */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Group Name *</label>
                            <input type="text" value={hf.name}
                              onChange={(e) => updateHolidayTimeframe(hf.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              placeholder="e.g., Bank Holidays 2025, Christmas Period" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Fallback Multiplier
                              <span className="ml-1 text-gray-400 font-normal">(optional, e.g. 1.5 or 2)</span>
                            </label>
                            <input type="number" step="0.1" min="1" max="5"
                              value={hf.holidayMultiplier ?? ''}
                              onChange={(e) => updateHolidayTimeframe(
                                hf.id,
                                'holidayMultiplier',
                                e.target.value ? parseFloat(e.target.value) : undefined
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              placeholder="e.g., 2.0" />
                            <p className="text-xs text-gray-500 mt-1">
                              Applied to the standard rate when no dedicated holiday rate entry exists on the rate card.
                            </p>
                          </div>
                        </div>

                        {/* Preset loader */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Load from preset</label>
                          <div className="flex items-center space-x-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) applyPreset(e.target.value, hf.id);
                                e.target.value = '';
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="">— Select a bank holiday calendar —</option>
                              {HOLIDAY_PRESETS.map(p => (
                                <option key={p.label} value={p.label}>{p.label}</option>
                              ))}
                            </select>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Merges preset dates into this group without removing existing dates.
                          </p>
                        </div>

                        {/* Add individual date */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Add individual date</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="date"
                              id={`holiday-date-input-${hf.id}`}
                              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(`holiday-date-input-${hf.id}`) as HTMLInputElement;
                                if (input?.value) {
                                  addDateToHoliday(hf.id, input.value);
                                  input.value = '';
                                }
                              }}
                              className="px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Date list */}
                        {(hf.holidayDates?.length ?? 0) > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Dates in this group ({hf.holidayDates!.length})
                            </label>
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                              {hf.holidayDates!.map(d => {
                                const displayDate = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                });
                                return (
                                  <span key={d} className="inline-flex items-center space-x-1 px-2 py-1 bg-white border border-orange-300 rounded-lg text-xs text-orange-900">
                                    <span>{displayDate}</span>
                                    <button type="button" onClick={() => removeDateFromHoliday(hf.id, d)}
                                      className="ml-1 text-red-500 hover:text-red-700 transition">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Expense Categories ────────────────────────────────────────── */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-green-600" />
                Expense Categories ({formData.expenseCategories.length})
              </h4>
              <button type="button" onClick={addExpenseCategory}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>

            <div className="space-y-3">
              {formData.expenseCategories.map((expense, index) => (
                <div key={expense.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">Expense #{index + 1}</span>
                    <button type="button" onClick={() => removeExpenseCategory(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Expense Name *</label>
                        <input type="text" required value={expense.name}
                          onChange={(e) => updateExpenseCategory(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Mileage, Accommodation" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Unit Type *</label>
                        <select required value={expense.unitType}
                          onChange={(e) => updateExpenseCategory(index, 'unitType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
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
                        <select required value={expense.rateType || 'CAPPED'}
                          onChange={(e) => updateExpenseCategory(index, 'rateType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                          <option value="CAPPED">Capped (Max per unit)</option>
                          <option value="FIXED">Fixed (Exact per unit)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Default Rate (£)</label>
                        <input type="number" step="0.01" min="0" value={expense.defaultRate || ''}
                          onChange={(e) => updateExpenseCategory(index, 'defaultRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00" />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center">
                          <input type="checkbox" checked={expense.taxable || false}
                            onChange={(e) => updateExpenseCategory(index, 'taxable', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                          <span className="ml-2 text-xs text-gray-700">Taxable</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Resource Categories ───────────────────────────────────────── */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-purple-600" />
                Resource Categories ({formData.resourceCategories.length})
              </h4>
              <button type="button" onClick={addResourceCategory}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {formData.resourceCategories.map((category, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input type="text" required value={category}
                    onChange={(e) => updateResourceCategory(index, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Labour, Vehicle, Equipment" />
                  {formData.resourceCategories.length > 1 && (
                    <button type="button" onClick={() => removeResourceCategory(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
              {saving ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
