import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Tag {
  id: string;
  name: string;
}

interface MultiSelectTagsProps {
  label: ReactNode;
  options: Tag[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  allowCreate?: boolean; // Allow creating new tags by typing
  onAddCustomTag?: (tagName: string) => void; // Called when a custom tag is added (simplified)
}

export default function MultiSelectTags({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = 'Select tags...',
  required = false,
  error,
  allowCreate = false,
  onAddCustomTag,
}: MultiSelectTagsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [localTags, setLocalTags] = useState<Tag[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Merge DB tags with locally created tags
  const allOptions = [...options, ...localTags];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  };

  const removeTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(id => id !== tagId));
  };

  const selectedTags = allOptions.filter(tag => selectedIds.includes(tag.id));
  const filteredOptions = allOptions.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedIds.includes(option.id) // Hide already selected options
  );

  // Check if search term matches an existing tag exactly
  const exactMatch = allOptions.find(
    option => option.name.toLowerCase() === searchTerm.toLowerCase()
  );

  // Handle Enter key to create new tag
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim() && allowCreate && !exactMatch) {
      e.preventDefault();

      // Create new tag locally
      const newTag: Tag = {
        id: `custom-${Date.now()}-${searchTerm.trim().toLowerCase().replace(/\s+/g, '-')}`,
        name: searchTerm.trim(),
      };

      // Add to local tags list
      setLocalTags(prev => [...prev, newTag]);

      // Add to selected IDs
      onChange([...selectedIds, newTag.id]);

      // Notify parent if callback provided
      if (onAddCustomTag) {
        onAddCustomTag(searchTerm.trim());
      }

      setSearchTerm('');
    } else if (e.key === 'Enter' && exactMatch) {
      e.preventDefault();
      toggleTag(exactMatch.id);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Selected Tags Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
          isOpen ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300 hover:border-gray-400'
        } ${error ? 'border-red-300 bg-red-50' : 'bg-white'}`}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {selectedTags.length > 0 ? (
            selectedTags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => removeTag(tag.id, e)}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200 transition-colors"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-500 text-sm">{placeholder}</span>
          )}
          <ChevronDownIcon
            className={`ml-auto w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={allowCreate ? "Search or press Enter to create..." : "Search..."}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onClick={(e) => e.stopPropagation()}
            />
            {allowCreate && searchTerm && !exactMatch && (
              <p className="mt-1 text-xs text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to create "{searchTerm}"
              </p>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => toggleTag(option.id)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-3 text-sm text-gray-900">{option.name}</span>
                </label>
              ))
            ) : searchTerm && allowCreate ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-gray-600 mb-2">No matching tags found</p>
                <p className="text-xs text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to create "{searchTerm}"
                </p>
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No tags found
              </div>
            )}
          </div>

          {/* Selection Summary */}
          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-600">
                {selectedIds.length} tag{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
