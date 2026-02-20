# VCA API Performance Investigation
**Date**: Feb 19, 2026 10:00 PM
**Reporter**: Arsalan
**Status**: INVESTIGATING

---

## 🔴 CRITICAL ISSUES REPORTED

### 1. Login Performance
- **Issue**: Takes 5-10 seconds to login
- **Issue**: User has to click "Login" button TWICE
- **Impact**: Poor user experience, frustration

### 2. Data Loading
- **Issue**: After login, data doesn't load
- **Issue**: Need to refresh 5-6 times to see data
- **Impact**: App appears broken, unusable

### 3. Screenshot Evidence
From the screenshot at `localhost:5175/admin`:
- ✅ App DID load successfully
- ✅ Shows "Hi, Arsalan 👋"
- ❌ Shows "Pending Reviews: 0" (might be wrong - could have actual data)
- ❌ Network tab shows 104 requests, many to `viral_analyses?select=...`
- ❌ All showing status 200 but marked as "Preflight" requests
- ⚠️ Multiple duplicate API calls visible

---

## 🔍 INVESTIGATION PLAN

### Phase 1: Authentication Flow Analysis
**Goal**: Understand why login requires 2 clicks and takes 5-10 seconds

**Files to examine**:
1. [LoginPage.tsx](app-v2/src/pages/LoginPage.tsx)
   - Google OAuth flow: `handleGoogleSuccess`
   - Backend auth endpoint: `/api/auth/google`
   - Session saving: `signInWithSession`

2. [useAuth.tsx](app-v2/src/hooks/useAuth.tsx)
   - Session check on mount: `checkSession()`
   - Auth state listener: `auth.onAuthStateChange`
   - User state management

3. [api.ts](app-v2/src/lib/api.ts)
   - Session storage: `_saveSession`, `_loadSession`
   - Token management
   - Auth state callbacks

**Questions**:
- ❓ Is there a double authentication check happening?
- ❓ Are we calling `/api/auth/me` multiple times?
- ❓ Is localStorage slow or blocked?
- ❓ Are there race conditions in auth state?

---

### Phase 2: API Call Pattern Analysis
**Goal**: Identify redundant, sequential, or inefficient API calls

**From screenshot, observed calls**:
```
viral_analyses?select=id&status=eq.APPROVED&...  (200, Preflight)
viral_analyses?select=id                           (200, Preflight)
viral_analyses?select=...                          (200, Preflight)
... (100+ similar calls)
```

**Suspected Issues**:
1. **CORS Preflight Overhead**
   - Every API call triggers OPTIONS preflight request
   - Doubles the number of network requests
   - Each preflight adds ~150ms latency

2. **Sequential API Calls**
   - AdminHomePage makes 3 parallel calls in `loadStats()`
   - But other components might be making their own calls
   - No request deduplication

3. **No Caching**
   - Same queries repeated multiple times
   - No cache headers or service worker
   - Every navigation refetches everything

4. **Overfetching**
   - Using `select(*)` instead of specific columns
   - Fetching related tables that might not be needed
   - Large payloads for simple counts

**Files to examine**:
1. [adminService.ts](app-v2/src/services/adminService.ts)
   - `getAllAnalyses()` - fetches all data with joins
   - `getPendingAnalyses()` - separate call
   - `getDashboardStats()` - counts
   - `getQueueStats()` - pipeline counts

2. [HomePage.tsx](app-v2/src/pages/admin/HomePage.tsx:60-88)
   - `loadStats()` makes 3 Promise.all calls
   - Check if other components also fetch on mount

3. [api.ts - PostgRESTQueryBuilder](app-v2/src/lib/api.ts:262-585)
   - Query building logic
   - No caching layer
   - No request deduplication

---

### Phase 3: Backend Response Time
**Goal**: Check if backend is slow or frontend is inefficient

**Backend endpoints to test**:
```bash
# Test production backend
curl -w "\nTime: %{time_total}s\n" https://vca-api.2xg.in/postgrest/viral_analyses?select=id&limit=1

# Test with auth
curl -H "Authorization: Bearer <JWT>" \
     -w "\nTime: %{time_total}s\n" \
     https://vca-api.2xg.in/postgrest/viral_analyses?select=*&status=eq.PENDING
```

**Questions**:
- ❓ Is PostgREST responding quickly (<500ms)?
- ❓ Are database queries optimized (indexes)?
- ❓ Is the server under load?

---

### Phase 4: Network Waterfall Analysis
**Goal**: Understand request sequencing and blocking

**From DevTools Network tab**:
1. Sort by timeline to see request sequence
2. Identify blocking chains (A → B → C)
3. Look for requests that could be parallel
4. Measure actual response times vs total time

**Expected findings**:
- Preflight requests should be ~50-150ms
- Actual data requests should be ~200-500ms
- Total for 100 requests = massive overhead

---

## 🐛 SUSPECTED ROOT CAUSES

### Issue 1: Double Login Click
**Hypothesis**: Race condition in auth state management

**Evidence needed**:
- Console logs showing auth flow
- Network requests during login
- State changes in React DevTools

**Possible causes**:
1. `useAuth` calls `checkSession()` on mount
2. User clicks Google Login
3. Backend returns session
4. `signInWithSession()` saves to localStorage
5. BUT `useAuth` already loaded old state
6. Need second click to trigger re-check

**Fix approach**:
- Ensure `onAuthStateChange` fires immediately on session save
- Remove duplicate `checkSession()` calls
- Use single source of truth for auth state

---

### Issue 2: Slow Initial Load (5-10 seconds)
**Hypothesis**: Too many sequential/redundant API calls

**Math**:
```
100 API calls (from screenshot)
× 2 (preflight + actual request)
× 200ms average (network + CORS)
= 40 seconds total (if sequential)

If parallel (browser limit ~6 concurrent):
= 100 calls / 6 concurrent
= 17 batches
× 400ms per batch
= 6.8 seconds ✅ matches reported 5-10 seconds
```

**Fix approach**:
1. Reduce number of API calls (use aggregated endpoints)
2. Implement request caching
3. Use React Query or SWR for deduplication
4. Prefetch critical data

---

### Issue 3: Data Not Showing (Refresh 5-6 Times)
**Hypothesis**: Race condition or state not updating

**Possible causes**:
1. API calls succeed but state doesn't update
2. Error handling swallows failures silently
3. Component unmounts before data arrives
4. Stale closure captures old state

**Fix approach**:
- Add proper error boundaries
- Log all API responses
- Use React DevTools to track state changes
- Add loading states that don't hide errors

---

## 📋 NEXT STEPS

### Immediate Actions (Feb 19, 2026)
1. ✅ Read core auth and API files
2. ⏳ Add console logging to trace auth flow
3. ⏳ Measure actual API call timings
4. ⏳ Identify redundant calls
5. ⏳ Create optimization plan

### Quick Wins (Can implement tonight)
1. **Add Request Deduplication**
   - Install `react-query` or implement simple cache
   - Prevent duplicate calls for same data

2. **Optimize AdminHomePage queries**
   - Use single RPC function instead of 3 separate calls
   - Select only needed columns

3. **Add CORS preflight caching**
   - Set `Access-Control-Max-Age` header on backend
   - Browser caches preflight for 24 hours

4. **Add Loading States**
   - Show what's actually loading
   - Display errors instead of silently failing

---

## 🔧 PROPOSED FIXES

### Fix 1: Implement React Query
**Why**: Automatic caching, deduplication, background refetch

**Install**:
```bash
npm install @tanstack/react-query
```

**Wrap App**:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
});

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

**Convert adminService calls**:
```tsx
// Before
const loadStats = async () => {
  const [dashboardStats, queue, pending] = await Promise.all([
    adminService.getDashboardStats(),
    adminService.getQueueStats(),
    adminService.getPendingAnalyses(),
  ]);
  setStats(dashboardStats);
};

// After
const { data: stats } = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: adminService.getDashboardStats,
});

const { data: queue } = useQuery({
  queryKey: ['queue-stats'],
  queryFn: adminService.getQueueStats,
});
```

**Benefits**:
- ✅ Automatic caching (no redundant calls)
- ✅ Request deduplication (if 2 components fetch same data)
- ✅ Background refetch (fresh data without reload)
- ✅ Loading/error states built-in

---

### Fix 2: Backend CORS Caching
**File**: `backend/src/middleware/cors.ts` (or wherever CORS is configured)

**Add**:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  maxAge: 86400, // 24 hours - cache preflight requests
}));
```

**Benefits**:
- ✅ Browser caches OPTIONS preflight for 24 hours
- ✅ Cuts API requests in half (no more duplicate preflights)
- ✅ Saves 50ms per request

---

### Fix 3: Optimize Database Queries
**Create RPC function** for dashboard stats:

```sql
CREATE OR REPLACE FUNCTION get_dashboard_data()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'dashboard_stats', (
      SELECT json_build_object(
        'totalAnalyses', COUNT(*),
        'pendingAnalyses', COUNT(*) FILTER (WHERE status = 'PENDING'),
        'approvedAnalyses', COUNT(*) FILTER (WHERE status = 'APPROVED'),
        'rejectedAnalyses', COUNT(*) FILTER (WHERE status = 'REJECTED')
      )
      FROM viral_analyses
    ),
    'queue_stats', (
      SELECT json_build_object(
        'pending', COUNT(*) FILTER (WHERE status = 'PENDING'),
        'planning', COUNT(*) FILTER (WHERE production_stage = 'PLANNING'),
        'shooting', COUNT(*) FILTER (WHERE production_stage = 'SHOOTING'),
        'readyForEdit', COUNT(*) FILTER (WHERE production_stage = 'READY_FOR_EDIT'),
        'editing', COUNT(*) FILTER (WHERE production_stage = 'EDITING'),
        'editReview', COUNT(*) FILTER (WHERE production_stage = 'EDIT_REVIEW'),
        'readyToPost', COUNT(*) FILTER (WHERE production_stage = 'READY_TO_POST'),
        'posted', COUNT(*) FILTER (WHERE production_stage = 'POSTED')
      )
      FROM viral_analyses
    ),
    'pending_analyses', (
      SELECT json_agg(json_build_object(
        'id', id,
        'title', title,
        'created_at', created_at,
        'platform', platform
      ))
      FROM (
        SELECT id, title, created_at, platform
        FROM viral_analyses
        WHERE status = 'PENDING'
        ORDER BY created_at DESC
        LIMIT 3
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Use in frontend**:
```typescript
// Instead of 3 separate calls
const data = await supabase.rpc('get_dashboard_data');
// Returns all 3 datasets in 1 query
```

**Benefits**:
- ✅ 3 API calls → 1 API call
- ✅ 1 database round-trip instead of 3
- ✅ Faster page load (~3x improvement)

---

### Fix 4: Add Proper Error Handling
**Current issue**: Errors are caught but not shown

**Fix HomePage.tsx**:
```tsx
const loadStats = async () => {
  try {
    setLoading(true);
    setError(null); // Clear previous errors

    const [dashboardStats, queue, pending] = await Promise.all([
      adminService.getDashboardStats(),
      adminService.getQueueStats(),
      adminService.getPendingAnalyses(),
    ]);

    setStats(dashboardStats);
    setQueueStats(queue);
    setPendingScripts(pending);
  } catch (error) {
    console.error('Failed to load stats:', error);
    setError(error.message || 'Failed to load dashboard data');
    toast.error('Failed to load data. Please refresh.');
  } finally {
    setLoading(false);
  }
};

// In render
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
    {error}
  </div>
)}
```

---

## 📊 EXPECTED IMPROVEMENTS

### Before Optimization
| Metric | Value |
|--------|-------|
| Login time | 5-10 seconds |
| API calls on load | 100+ requests |
| Time to interactive | 10+ seconds |
| Refresh required | 5-6 times |

### After Optimization
| Metric | Value | Improvement |
|--------|-------|-------------|
| Login time | 1-2 seconds | **80% faster** |
| API calls on load | 5-10 requests | **90% reduction** |
| Time to interactive | 2-3 seconds | **70% faster** |
| Refresh required | 0 times | **100% fixed** |

---

## 🎯 ACTION PLAN

### Tonight (Feb 19, 2026)
1. Add console logging to trace auth flow
2. Measure actual API timings in Network tab
3. Identify top 10 most-called endpoints
4. Create minimal reproduction case

### Tomorrow (Feb 20, 2026)
1. Implement React Query for caching
2. Add CORS preflight caching on backend
3. Create `get_dashboard_data()` RPC function
4. Test and measure improvements

### This Week
1. Audit all components for redundant API calls
2. Implement service worker for offline support
3. Add analytics to track performance metrics
4. Create performance monitoring dashboard

---

*Investigation started: Feb 19, 2026 10:00 PM*
*Status: IN PROGRESS*
