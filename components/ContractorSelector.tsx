'use client';

import { Building2, ChevronDown } from 'lucide-react';

interface Contractor {
  id: string;
  name: string;
  projectCount: number;
}

interface ContractorSelectorProps {
  contractors: Contractor[];
  selectedContractorId: string;
  onSelectContractor: (contractorId: string) => void;
}

export default function ContractorSelector({
  contractors,
  selectedContractorId,
  onSelectContractor,
}: ContractorSelectorProps) {
  const selectedContractor = contractors.find(c => c.id === selectedContractorId);

  if (contractors.length === 0) {
    return null;
  }

  if (contractors.length === 1) {
    // Only one contractor - show as static badge
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <Building2 className="w-5 h-5 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-900">{contractors[0].name}</p>
          <p className="text-xs text-blue-600">{contractors[0].projectCount} project{contractors[0].projectCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Contractor
      </label>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
        <select
          value={selectedContractorId}
          onChange={(e) => onSelectContractor(e.target.value)}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer font-medium text-gray-900"
        >
          {contractors.map(contractor => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.name} ({contractor.projectCount} project{contractor.projectCount !== 1 ? 's' : ''})
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        You have access to {contractors.length} contractor{contractors.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
