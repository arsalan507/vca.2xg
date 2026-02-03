/**
 * PostgREST + Authentik Client Wrapper
 *
 * Drop-in replacement for @supabase/supabase-js that routes:
 * - Database queries → PostgREST
 * - Auth calls → Express backend (which talks to Authentik)
 * - Storage calls → Express backend (local disk for voice notes)
 *
 * All 18 frontend service files continue working unchanged.
 */

const POSTGREST_URL = import.meta.env.VITE_POSTGREST_URL;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!POSTGREST_URL || !BACKEND_URL) {
  throw new Error('Missing environment variables: VITE_POSTGREST_URL and VITE_BACKEND_URL are required');
}

// ─── Token Management ───────────────────────────────────────────────────────

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _user: AuthUser | null = null;
let _authChangeCallbacks: Array<(event: string, session: AuthSession | null) => void> = [];

interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

function _loadSession(): void {
  try {
    const stored = localStorage.getItem('auth_session');
    if (stored) {
      const session: AuthSession = JSON.parse(stored);
      _accessToken = session.access_token;
      _refreshToken = session.refresh_token;
      _user = session.user;
    }
  } catch {
    // Ignore parse errors
  }
}

function _saveSession(session: AuthSession | null): void {
  if (session) {
    _accessToken = session.access_token;
    _refreshToken = session.refresh_token;
    _user = session.user;
    localStorage.setItem('auth_session', JSON.stringify(session));
  } else {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    localStorage.removeItem('auth_session');
  }
}

function _notifyAuthChange(event: string, session: AuthSession | null): void {
  for (const cb of _authChangeCallbacks) {
    try { cb(event, session); } catch { /* ignore */ }
  }
}

// Load session on module init
_loadSession();

// ─── Auth Namespace ─────────────────────────────────────────────────────────

const auth = {
  async signUp({ email, password, options }: {
    email: string;
    password: string;
    options?: { data?: Record<string, any> };
  }) {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName: options?.data?.full_name || '',
      }),
    });
    const body = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: { message: body.error, name: 'AuthApiError' } };

    const session: AuthSession = body.session;
    _saveSession(session);
    _notifyAuthChange('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: { message: body.error, name: 'AuthApiError' } };

    const session: AuthSession = body.session;
    _saveSession(session);
    _notifyAuthChange('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },

  async signOut(_opts?: { scope?: string }): Promise<{ error: any }> {
    const token = _accessToken;
    _saveSession(null);
    _notifyAuthChange('SIGNED_OUT', null);

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch { /* best-effort */ }
    }
    return { error: null };
  },

  async getUser() {
    if (!_accessToken) return { data: { user: null }, error: null };

    // Always validate token with backend to ensure it's still valid
    // and get fresh user data (handles token migration scenarios)
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${_accessToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          _saveSession(null);
          return { data: { user: null }, error: { message: 'Session expired', name: 'AuthSessionMissingError' } };
        }
        return { data: { user: null }, error: { message: 'Failed to get user', name: 'AuthApiError' } };
      }
      const body = await res.json();
      _user = body.user;
      return { data: { user: _user }, error: null };
    } catch (err) {
      return { data: { user: null }, error: { message: String(err), name: 'AuthApiError' } };
    }
  },

  async getSession() {
    if (!_accessToken || !_user) return { data: { session: null }, error: null };
    return {
      data: {
        session: {
          access_token: _accessToken,
          refresh_token: _refreshToken || '',
          user: _user,
        },
      },
      error: null,
    };
  },

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    _authChangeCallbacks.push(callback);
    // Return unsubscribe function matching Supabase API
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            _authChangeCallbacks = _authChangeCallbacks.filter(cb => cb !== callback);
          },
        },
      },
    };
  },
};

// ─── Storage Namespace ──────────────────────────────────────────────────────

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, blob: Blob | File, options?: { contentType?: string; upsert?: boolean }) {
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('path', path);
        formData.append('bucket', bucket);
        if (options?.contentType) formData.append('contentType', options.contentType);
        if (options?.upsert) formData.append('upsert', 'true');

        const res = await fetch(`${BACKEND_URL}/api/storage/upload`, {
          method: 'POST',
          headers: {
            ...(_accessToken ? { 'Authorization': `Bearer ${_accessToken}` } : {}),
          },
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Upload failed' }));
          return { data: null, error: { message: body.error || 'Upload failed' } };
        }

        const body = await res.json();
        return { data: { path: body.path }, error: null };
      },

      getPublicUrl(path: string) {
        return {
          data: {
            publicUrl: `${BACKEND_URL}/files/${bucket}/${path}`,
          },
        };
      },

      async list(folder?: string) {
        const url = new URL(`${BACKEND_URL}/api/storage/list`);
        url.searchParams.set('bucket', bucket);
        if (folder) url.searchParams.set('folder', folder);

        const res = await fetch(url.toString(), {
          headers: {
            ...(_accessToken ? { 'Authorization': `Bearer ${_accessToken}` } : {}),
          },
        });

        if (!res.ok) return { data: null, error: { message: 'List failed' } };
        const body = await res.json();
        return { data: body.files || [], error: null };
      },

      async remove(paths: string[]) {
        const res = await fetch(`${BACKEND_URL}/api/storage/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(_accessToken ? { 'Authorization': `Bearer ${_accessToken}` } : {}),
          },
          body: JSON.stringify({ bucket, paths }),
        });

        if (!res.ok) return { data: null, error: { message: 'Delete failed' } };
        return { data: null, error: null };
      },
    };
  },
};

// ─── PostgREST Query Builder ────────────────────────────────────────────────

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'not';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
  negate?: boolean;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

interface CountOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
}

class PostgRESTQueryBuilder {
  private _table: string;
  private _selectColumns: string = '*';
  private _countOption: CountOptions = {};
  private _filters: QueryFilter[] = [];
  private _orFilters: string[] = [];
  private _orders: OrderSpec[] = [];
  private _limitVal: number | null = null;
  private _rangeFrom: number | null = null;
  private _rangeTo: number | null = null;
  private _isSingle = false;
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body: unknown = null;
  private _isUpsert = false;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = '*', options?: CountOptions): this {
    this._selectColumns = columns;
    if (options) this._countOption = options;
    this._method = 'GET';
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this._method = 'POST';
    this._body = data;
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], _options?: { onConflict?: string }): this {
    this._method = 'POST';
    this._body = data;
    this._isUpsert = true;
    return this;
  }

  update(data: Record<string, any>): this {
    this._method = 'PATCH';
    this._body = data;
    return this;
  }

  delete(): this {
    this._method = 'DELETE';
    return this;
  }

  // Filters
  eq(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'is', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this._filters.push({ column, operator: 'in', value: values });
    return this;
  }

  not(column: string, operator: FilterOperator, value: unknown): this {
    this._filters.push({ column, operator, value, negate: true });
    return this;
  }

  or(filterString: string): this {
    this._orFilters.push(filterString);
    return this;
  }

  contains(column: string, value: unknown): this {
    this._filters.push({ column, operator: 'eq' as FilterOperator, value: `cs.${JSON.stringify(value)}` });
    return this;
  }

  // Ordering
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  // Pagination
  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  // Single row
  single(): this {
    this._isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this._isSingle = true;
    return this;
  }

  // Build URL and execute
  private _buildUrl(): string {
    const url = new URL(`${POSTGREST_URL}/${this._table}`);

    // Select columns
    if (this._selectColumns && this._selectColumns !== '*') {
      url.searchParams.set('select', this._selectColumns);
    }

    // Filters
    for (const f of this._filters) {
      const col = f.column;
      let op = f.operator;
      let val: string;

      if (f.negate) {
        // PostgREST negation: column=not.op.value
        if (op === 'is') {
          val = `not.is.${f.value}`;
        } else if (op === 'in') {
          val = `not.in.(${(f.value as unknown[]).join(',')})`;
        } else {
          val = `not.${op}.${f.value}`;
        }
      } else if (op === 'in') {
        val = `in.(${(f.value as unknown[]).join(',')})`;
      } else if (op === 'is') {
        val = `is.${f.value}`;
      } else {
        val = `${op}.${f.value}`;
      }

      // Handle JSONB arrow paths: convert `col->field` to `col->>field` for filtering
      url.searchParams.append(col, val);
    }

    // OR filters (PostgREST native syntax)
    for (const orFilter of this._orFilters) {
      url.searchParams.append('or', `(${orFilter})`);
    }

    // Ordering
    if (this._orders.length > 0) {
      const orderStr = this._orders.map(o => {
        let s = o.column;
        s += o.ascending ? '.asc' : '.desc';
        if (o.nullsFirst === true) s += '.nullsfirst';
        if (o.nullsFirst === false) s += '.nullslast';
        return s;
      }).join(',');
      url.searchParams.set('order', orderStr);
    }

    // Limit
    if (this._limitVal !== null) {
      url.searchParams.set('limit', String(this._limitVal));
    }

    // Range
    if (this._rangeFrom !== null && this._rangeTo !== null) {
      url.searchParams.set('offset', String(this._rangeFrom));
      url.searchParams.set('limit', String(this._rangeTo - this._rangeFrom + 1));
    }

    return url.toString();
  }

  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (_accessToken) {
      headers['Authorization'] = `Bearer ${_accessToken}`;
    }

    // PostgREST uses the `Accept` header for single row mode
    if (this._isSingle) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    // Count preference
    if (this._countOption.count) {
      const prefer: string[] = [];
      prefer.push(`count=${this._countOption.count}`);
      if (this._isUpsert) {
        prefer.push('resolution=merge-duplicates');
      }
      if (this._method === 'POST' && !this._isUpsert) {
        prefer.push('return=representation');
      }
      if (this._method === 'PATCH') {
        prefer.push('return=representation');
      }
      headers['Prefer'] = prefer.join(', ');
    } else {
      const prefer: string[] = [];
      if (this._isUpsert) {
        prefer.push('resolution=merge-duplicates');
      }
      // For INSERT/UPDATE with .select(), we need return=representation
      if ((this._method === 'POST' || this._method === 'PATCH') && this._selectColumns) {
        prefer.push('return=representation');
      }
      if (prefer.length > 0) {
        headers['Prefer'] = prefer.join(', ');
      }
    }

    return headers;
  }

  // Execute the query — this is implicitly called by `then`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _execute(): Promise<{ data: any; error: any; count?: number }> {
    const url = this._buildUrl();
    const headers = this._buildHeaders();

    const fetchOptions: RequestInit = {
      method: this._countOption.head ? 'HEAD' : this._method,
      headers,
    };

    if (this._body && (this._method === 'POST' || this._method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(this._body);
    }

    try {
      const res = await fetch(url, fetchOptions);

      // Extract count from Content-Range header
      let count: number | undefined;
      const contentRange = res.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) count = parseInt(match[1], 10);
      }
      // Also check Preference-Applied count
      const preferApplied = res.headers.get('Preference-Applied');
      if (!count && preferApplied?.includes('count=')) {
        const rangeHeader = res.headers.get('Content-Range');
        if (rangeHeader) {
          const m = rangeHeader.match(/\/(\d+|\*)/);
          if (m && m[1] !== '*') count = parseInt(m[1], 10);
        }
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errBody.message || errBody.details || `PostgREST error: ${res.status}`,
            code: errBody.code || String(res.status),
            details: errBody.details || '',
            hint: errBody.hint || '',
          },
          count,
        };
      }

      // HEAD requests (count-only) don't return body
      if (this._countOption.head || fetchOptions.method === 'HEAD') {
        return { data: null, error: null, count };
      }

      // DELETE without select returns no body
      if (this._method === 'DELETE' && !this._selectColumns) {
        return { data: null, error: null, count };
      }

      const data = await res.json();
      return { data, error: null, count };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : String(err),
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  // Make the builder thenable so `await supabase.from(...).select(...)` works
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(
    resolve: (value: { data: any; error: any; count?: number }) => void,
    reject?: (reason: any) => void
  ) {
    return this._execute().then(resolve, reject);
  }
}

// ─── RPC Handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _rpc(fnName: string, params?: Record<string, any>): Promise<{ data: any; error: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  try {
    const res = await fetch(`${POSTGREST_URL}/rpc/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params || {}),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        data: null,
        error: {
          message: errBody.message || `RPC error: ${res.status}`,
          code: errBody.code || String(res.status),
        },
      };
    }

    const data = await res.json().catch(() => null);
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

// ─── Main Client Export ─────────────────────────────────────────────────────

export const supabase = {
  from(table: string) {
    return new PostgRESTQueryBuilder(table);
  },
  rpc: _rpc,
  auth,
  storage,
};
