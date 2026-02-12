import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Automatic cleanup after each test
afterEach(() => {
  cleanup();
});

// ─── Mock environment variables ──────────────────────────────────────────────
// These are needed because api.ts reads import.meta.env at module load time
vi.stubEnv('VITE_POSTGREST_JWT', 'test-anon-key');
vi.stubEnv('VITE_POSTGREST_URL', 'http://localhost:3000');
vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000');

// ─── Mock localStorage ──────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Mock matchMedia ─────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── Mock IntersectionObserver ───────────────────────────────────────────────
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
});

// ─── Mock ResizeObserver ─────────────────────────────────────────────────────
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// ─── Mock scrollTo ───────────────────────────────────────────────────────────
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// ─── Mock the API module (Supabase client) ───────────────────────────────────
vi.mock('@/lib/api', () => {
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    refreshSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    getAccessToken: vi.fn().mockReturnValue(null),
    changePassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    forgotPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    resetPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve) => resolve({ data: [], error: null })),
  };

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://localhost/test' } }),
    }),
  };

  return {
    auth: mockAuth,
    storage: mockStorage,
    supabase: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: mockAuth,
      storage: mockStorage,
    },
    default: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: mockAuth,
      storage: mockStorage,
    },
    AuthUser: undefined,
    AuthSession: undefined,
  };
});
