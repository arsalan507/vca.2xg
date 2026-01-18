import { useState, useRef, useEffect } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FilterRange {
  min?: number;
  max?: number;
}

interface TableColumnFilterProps {
  column: string;
  type: 'number' | 'percentage';
  currentFilter?: FilterRange;
  onFilterChange: (filter: FilterRange | null) => void;
  align?: 'left' | 'center' | 'right';
}

export default function TableColumnFilter({
  column,
  type,
  currentFilter,
  onFilterChange,
  align = 'left'
}: TableColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [min, setMin] = useState<string>(currentFilter?.min?.toString() || '');
  const [max, setMax] = useState<string>(currentFilter?.max?.toString() || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleApply = () => {
    const minNum = min ? parseFloat(min) : undefined;
    const maxNum = max ? parseFloat(max) : undefined;

    if (minNum !== undefined || maxNum !== undefined) {
      onFilterChange({ min: minNum, max: maxNum });
    } else {
      onFilterChange(null);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setMin('');
    setMax('');
    onFilterChange(null);
    setIsOpen(false);
  };

  const hasActiveFilter = currentFilter && (currentFilter.min !== undefined || currentFilter.max !== undefined);

  const alignClass = align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded hover:bg-gray-200 transition ${hasActiveFilter ? 'text-primary-600' : 'text-gray-400'}`}
        title={`Filter ${column}`}
      >
        <FunnelIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className={`absolute ${alignClass} top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Filter {column}</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Minimum {type === 'percentage' ? '(%)' : ''}
              </label>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="No minimum"
                min="0"
                max={type === 'percentage' ? '100' : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Maximum {type === 'percentage' ? '(%)' : ''}
              </label>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="No maximum"
                min="0"
                max={type === 'percentage' ? '100' : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={handleClear}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
