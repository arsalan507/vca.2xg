import { Users } from 'lucide-react';
import type { CastComposition } from '@/types';

type PartialCast = Partial<CastComposition>;

interface Props {
  value: PartialCast;
  onChange: (value: PartialCast) => void;
}

const CAST_ROWS: { key: keyof CastComposition; emoji: string; label: string }[] = [
  { key: 'man',   emoji: '👨', label: 'Man'   },
  { key: 'woman', emoji: '👩', label: 'Woman' },
  { key: 'boy',   emoji: '👦', label: 'Boy'   },
  { key: 'girl',  emoji: '👧', label: 'Girl'  },
];

export default function CastCompositionPicker({ value, onChange }: Props) {
  const total = CAST_ROWS.reduce((sum, r) => sum + ((value[r.key] as number) || 0), 0);
  const includeOwner = value.include_owner ?? false;

  const set = (key: keyof CastComposition, n: number) => {
    onChange({ ...value, [key]: Math.max(0, n) });
  };

  // Only render if at least one count > 0 or include_owner is true (otherwise stays compact)
  const hasAny = total > 0 || includeOwner;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Cast
        </span>
        {hasAny && (
          <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {total + (includeOwner ? 1 : 0)} people
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        {CAST_ROWS.map(({ key, emoji, label }) => {
          const count = (value[key] as number) || 0;
          return (
            <div
              key={key}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
            >
              <span className="text-sm font-medium text-gray-700">
                {emoji} {label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => set(key, count - 1)}
                  disabled={count === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 text-base font-bold disabled:opacity-30 active:bg-gray-100"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm font-semibold text-gray-900">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => set(key, count + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-base font-bold active:bg-blue-600"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Include owner toggle */}
      <button
        type="button"
        onClick={() => onChange({ ...value, include_owner: !includeOwner })}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
          includeOwner
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600'
        }`}
      >
        <span className="text-base">🏍️</span>
        Include Owner (BCH Boss)
        <span className="ml-auto text-xs">
          {includeOwner ? '✓ Yes' : 'No'}
        </span>
      </button>
    </div>
  );
}
