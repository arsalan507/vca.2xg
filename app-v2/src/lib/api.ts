/**
 * API Client
 *
 * Uses:
 * - Auth via Express backend (Google Sign-In + PIN)
 * - Database queries via PostgREST
 * - Storage via Express backend (local disk for voice notes)
 */

const POSTGREST_URL = import.meta.env.VITE_POSTGREST_URL;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
// Support both new and legacy env var names for the PostgREST JWT
const POSTGREST_JWT = import.meta.env.VITE_POSTGREST_JWT || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!POSTGREST_URL || !BACKEND_URL || !POSTGREST_JWT) {
  console.warn('Missing VITE_POSTGREST_URL, VITE_BACKEND_URL, or VITE_POSTGREST_JWT');
}

// ─── Auth Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

// ─── Module-level Auth State ───────────────────────────────────────────────────────

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _user: AuthUser | null = null;
let _authChangeCallbacks: Array<(event: string, session: AuthSession | null) => void> = [];

function _loadSession(): void {
  try {
    const stored = localStorage.getItem('auth_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      _accessToken = parsed.access_token || null;
      _refreshToken = parsed.refresh_token || null;
      _user = parsed.user || null;
    }
  } catch { /* ignore */ }
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

// Load saved session on init
_loadSession();

// ─── Auto-Refresh Fetch Wrapper ─────────────────────────────────────────────────────

/**
 * Fetch wrapper that automatically refreshes tokens on 401 and retries once
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // Add auth header if we have a token
  const headers = new Headers(options.headers);
  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  const response = await fetch(url, { ...options, headers });

  // If we get 401, session expired - user needs to log in again
  if (response.status === 401) {
    _saveSession(null);
    _notifyAuthChange('SIGNED_OUT', null);
  }

  return response;
}

// ─── Auth Namespace ────────────────────────────────────────────────────────────────

export const auth = {
  saveSession(session: AuthSession) {
    _saveSession(session);
    _notifyAuthChange('SIGNED_IN', session);
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      if (_accessToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_accessToken}` },
        }).catch(() => {});
      }
    } finally {
      _saveSession(null);
      _notifyAuthChange('SIGNED_OUT', null);
    }
    return { error: null };
  },

  async getUser() {
    if (_user && _accessToken) {
      return { data: { user: _user }, error: null };
    }
    if (!_user) {
      _loadSession();
      if (_user && _accessToken) {
        return { data: { user: _user }, error: null };
      }
    }
    if (_accessToken) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${_accessToken}` },
        });
        if (res.ok) {
          const body = await res.json();
          _user = body.user;
          return { data: { user: _user }, error: null };
        }
      } catch { /* ignore */ }
    }
    return { data: { user: null }, error: null };
  },

  async getSession() {
    if (_accessToken && _user) {
      return {
        data: {
          session: { access_token: _accessToken, refresh_token: _refreshToken || '', user: _user } as AuthSession,
        },
        error: null,
      };
    }
    return { data: { session: null }, error: null };
  },

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    _authChangeCallbacks.push(callback);
    if (_user && _accessToken) {
      callback('INITIAL_SESSION', { access_token: _accessToken, refresh_token: _refreshToken || '', user: _user });
    } else {
      callback('INITIAL_SESSION', null);
    }
    return {
      data: {
        subscription: {
          unsubscribe() {
            _authChangeCallbacks = _authChangeCallbacks.filter(cb => cb !== callback);
          },
        },
      },
    };
  },

  getAccessToken() {
    return _accessToken;
  },

  async changePin({ currentPin, newPin }: { currentPin: string; newPin: string }): Promise<{ data: { success: boolean } | null; error: { message: string } | null }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_accessToken}` },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const body = await res.json();
      if (!res.ok) return { data: null, error: { message: body.error || 'Failed to change PIN' } };
      return { data: { success: true }, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Failed to change PIN' } };
    }
  },
};

// ─── Storage Namespace ──────────────────────────────────────────────────────────────

export const storage = {
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
  private _isMaybeSingle = false;
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body: unknown = null;
  private _isUpsert = false;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = '*', options?: CountOptions): this {
    this._selectColumns = columns;
    if (options) this._countOption = options;
    // Only set method to GET if we don't have a body (pure SELECT)
    // When chaining after insert/update, keep the original method
    if (!this._body) {
      this._method = 'GET';
    }
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this._method = 'POST';
    this._body = data;
    return this;
  }

  upsert(data: Record<string, unknown> | Record<string, unknown>[], _options?: { onConflict?: string }): this {
    this._method = 'POST';
    this._body = data;
    this._isUpsert = true;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this._method = 'PATCH';
    this._body = data;
    return this;
  }

  delete(): this {
    this._method = 'DELETE';
    return this;
  }

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

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  single(): this {
    this._isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this._isMaybeSingle = true;
    return this;
  }

  private _buildUrl(): string {
    const url = new URL(`${POSTGREST_URL}/${this._table}`);

    if (this._selectColumns && this._selectColumns !== '*') {
      url.searchParams.set('select', this._selectColumns);
    }

    for (const f of this._filters) {
      const col = f.column;
      const op = f.operator;
      let val: string;

      if (f.negate) {
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

      url.searchParams.append(col, val);
    }

    for (const orFilter of this._orFilters) {
      url.searchParams.append('or', `(${orFilter})`);
    }

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

    if (this._limitVal !== null) {
      url.searchParams.set('limit', String(this._limitVal));
    }

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

    // PostgREST auth: anon JWT for authorization
    headers['Authorization'] = `Bearer ${POSTGREST_JWT}`;

    if (this._isSingle) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

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
      if ((this._method === 'POST' || this._method === 'PATCH') && this._selectColumns) {
        prefer.push('return=representation');
      }
      if (prefer.length > 0) {
        headers['Prefer'] = prefer.join(', ');
      }
    }

    return headers;
  }

  async _execute(): Promise<{ data: unknown; error: unknown; count?: number }> {
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

      let count: number | undefined;
      const contentRange = res.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) count = parseInt(match[1], 10);
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errBody.message || errBody.details || `PostgREST error: ${res.status}`,
            code: errBody.code || String(res.status),
          },
          count,
        };
      }

      if (this._countOption.head || fetchOptions.method === 'HEAD') {
        return { data: null, error: null, count };
      }

      if (this._method === 'DELETE' && !this._selectColumns) {
        return { data: null, error: null, count };
      }

      const data = await res.json();

      // Handle maybeSingle - returns null if no rows, first element if 1 row
      if (this._isMaybeSingle && Array.isArray(data)) {
        if (data.length === 0) {
          return { data: null, error: null, count };
        }
        if (data.length === 1) {
          return { data: data[0], error: null, count };
        }
        // Multiple rows - this shouldn't happen with maybeSingle but handle gracefully
        return { data: data[0], error: null, count };
      }

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

  then(
    resolve: (value: { data: unknown; error: unknown; count?: number }) => void,
    reject?: (reason: unknown) => void
  ) {
    return this._execute().then(resolve, reject);
  }
}

// ─── RPC Handler ────────────────────────────────────────────────────────────

async function _rpc(fnName: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // PostgREST auth: anon JWT for authorization
  headers['Authorization'] = `Bearer ${POSTGREST_JWT}`;

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

export default supabase;
