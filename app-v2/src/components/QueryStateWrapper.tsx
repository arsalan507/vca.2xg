import { type ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface QueryStateWrapperProps {
  /** true on first load (no cache yet) */
  isLoading: boolean;
  /** true while refetching in background */
  isFetching: boolean;
  /** true if last fetch errored */
  isError: boolean;
  /** error object from React Query */
  error: unknown;
  /** the cached data (undefined on first load) */
  data: unknown;
  /** called when user taps Retry */
  onRetry: () => void;
  /** page content — rendered when data is available */
  children: ReactNode;
  /** role accent color class (e.g. "purple", "orange", "green", "cyan", "blue") */
  accentColor?: string;
}

const ACCENT_MAP: Record<string, { spinner: string; banner: string; button: string }> = {
  purple: { spinner: 'text-purple-500', banner: 'border-purple-200 bg-purple-50', button: 'bg-purple-500 active:bg-purple-600' },
  orange: { spinner: 'text-orange-500', banner: 'border-orange-200 bg-orange-50', button: 'bg-orange-500 active:bg-orange-600' },
  green: { spinner: 'text-green-500', banner: 'border-green-200 bg-green-50', button: 'bg-green-500 active:bg-green-600' },
  cyan: { spinner: 'text-cyan-500', banner: 'border-cyan-200 bg-cyan-50', button: 'bg-cyan-500 active:bg-cyan-600' },
  blue: { spinner: 'text-blue-500', banner: 'border-blue-200 bg-blue-50', button: 'bg-blue-500 active:bg-blue-600' },
};

function getAccent(color?: string) {
  return ACCENT_MAP[color || 'purple'] || ACCENT_MAP.purple;
}

/** Sticky banner shown while refetching in background */
function RefreshingBanner({ accentColor }: { accentColor?: string }) {
  const accent = getAccent(accentColor);
  return (
    <div className={`sticky top-0 z-40 flex items-center justify-center gap-2 py-2 text-xs font-medium border-b ${accent.banner}`}>
      <RefreshCw className="w-3 h-3 animate-spin" />
      Refreshing...
    </div>
  );
}

/** Banner shown when error occurs but stale data is available */
function ErrorBanner({ onRetry, error }: { onRetry: () => void; error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border-b border-red-200">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm text-red-700 truncate">{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg active:bg-red-600"
        style={{ minHeight: 44 }}
      >
        Retry
      </button>
    </div>
  );
}

/** Full-page error state when no cached data exists */
function ErrorState({ onRetry, error, accentColor }: { onRetry: () => void; error: unknown; accentColor?: string }) {
  const accent = getAccent(accentColor);
  const message = error instanceof Error ? error.message : 'Failed to load data';
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">{message}</p>
      <button
        onClick={onRetry}
        className={`px-6 py-3 text-white font-medium rounded-xl ${accent.button}`}
        style={{ minHeight: 44 }}
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Wraps any page that uses React Query, handling all 4 states:
 * 1. First load (no cache) → centered spinner
 * 2. Refetching (has cache) → children + refreshing banner
 * 3. Error (has cache) → children + error banner with Retry
 * 4. Error (no cache) → full-page error with Retry
 */
export default function QueryStateWrapper({
  isLoading,
  isFetching,
  isError,
  error,
  data,
  onRetry,
  children,
  accentColor,
}: QueryStateWrapperProps) {
  const hasData = data !== undefined && data !== null;
  const accent = getAccent(accentColor);

  // State 1: First load, no cached data
  if (isLoading && !hasData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className={`w-8 h-8 animate-spin ${accent.spinner}`} />
      </div>
    );
  }

  // State 4: Error with no cached data
  if (isError && !hasData) {
    return <ErrorState onRetry={onRetry} error={error} accentColor={accentColor} />;
  }

  // State 2 & 3: Has cached data
  return (
    <>
      {isError && <ErrorBanner onRetry={onRetry} error={error} />}
      {!isError && isFetching && <RefreshingBanner accentColor={accentColor} />}
      {children}
    </>
  );
}
