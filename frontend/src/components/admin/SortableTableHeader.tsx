import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeaderProps {
  label: string;
  field: string;
  currentSort: { field: string | null; direction: SortDirection };
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  filterComponent?: React.ReactNode;
}

export default function SortableTableHeader({
  label,
  field,
  currentSort,
  onSort,
  align = 'left',
  filterComponent
}: SortableTableHeaderProps) {
  const isSorted = currentSort.field === field;
  const alignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <th className={`px-6 py-3 ${textAlign} text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap`}>
      <div className={`flex items-center gap-2 ${alignClass}`}>
        <button
          onClick={() => onSort(field)}
          className="flex items-center gap-1 hover:text-gray-700 transition group"
        >
          <span>{label}</span>
          {isSorted ? (
            currentSort.direction === 'asc' ? (
              <ArrowUpIcon className="w-4 h-4 text-primary-600" />
            ) : (
              <ArrowDownIcon className="w-4 h-4 text-primary-600" />
            )
          ) : (
            <div className="w-4 h-4 opacity-0 group-hover:opacity-30 transition">
              <ArrowUpIcon className="w-4 h-4" />
            </div>
          )}
        </button>
        {filterComponent}
      </div>
    </th>
  );
}
