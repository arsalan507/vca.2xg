/**
 * Authentication Routes
 * Handles login/register/logout by communicating with Authentik
 */

const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const router = express.Router();

const POSTGREST_JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const AUTHENTIK_URL = process.env.AUTHENTIK_URL; // e.g. https://auth.yourdomain.com (external)
const AUTHENTIK_INTERNAL_URL = process.env.AUTHENTIK_INTERNAL_URL || AUTHENTIK_URL; // internal Docker URL
const AUTHENTIK_HOST = new URL(AUTHENTIK_URL).host; // e.g. vca-auth.2xg.in (for Host header)
const AUTHENTIK_CLIENT_ID = process.env.AUTHENTIK_CLIENT_ID;
const AUTHENTIK_CLIENT_SECRET = process.env.AUTHENTIK_CLIENT_SECRET;
const AUTHENTIK_TOKEN_ENDPOINT = `${AUTHENTIK_INTERNAL_URL}/application/o/token/`;
const AUTHENTIK_USERINFO_ENDPOINT = `${AUTHENTIK_INTERNAL_URL}/application/o/userinfo/`;
const AUTHENTIK_API_URL = `${AUTHENTIK_INTERNAL_URL}/api/v3`;

/**
 * Helper: Execute Authentik flow step with cookie management
 * Handles 302 redirects manually to maintain POST method and cookies
 */
async function flowFetch(url, options, cookieJar) {
  const res = await fetch(url, {
    ...options,
    redirect: 'manual',
    headers: {
      ...options.headers,
      'Host': AUTHENTIK_HOST,
      'Cookie': cookieJar.value || '',
    },
  });

  // Capture session cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/authentik_session=([^;]+)/);
    if (match) cookieJar.value = `authentik_session=${match[1]}`;
  }

  // On 302 redirect, follow it with GET to get the next stage
  if (res.status === 302) {
    const location = res.headers.get('location');
    const redirectUrl = location.startsWith('http') ? location : `${AUTHENTIK_INTERNAL_URL}${location}`;
    return flowFetch(redirectUrl, { method: 'GET', headers: {} }, cookieJar);
  }

  return res;
}

/**
 * POST /api/auth/login
 * Authenticate via Authentik flow executor + app password token exchange
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const adminToken = await getAuthentikAdminToken();
    const flowUrl = `${AUTHENTIK_INTERNAL_URL}/api/v3/flows/executor/default-authentication-flow/`;
    const cookieJar = { value: '' };

    // Step 1: Find user by username (email) via Authentik API
    const usersRes = await fetch(`${AUTHENTIK_API_URL}/core/users/?username=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
    });

    if (!usersRes.ok) {
      console.error('User lookup failed:', usersRes.status, await usersRes.text().catch(() => ''));
      return res.status(500).json({ error: 'Failed to query user directory' });
    }

    const usersData = await usersRes.json();
    const authentikUser = usersData.results?.[0];

    if (!authentikUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Step 2: Verify password via Authentik flow executor
    // Start flow
    const flowStartRes = await flowFetch(flowUrl, { method: 'GET', headers: {} }, cookieJar);
    if (!flowStartRes.ok) {
      console.error('Flow start failed');
      return res.status(500).json({ error: 'Authentication service unavailable' });
    }
    await flowStartRes.json();

    // Submit username
    const identRes = await flowFetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid_field: email }),
    }, cookieJar);

    const identData = await identRes.json();
    if (identData.component !== 'ak-stage-password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Submit password
    const passRes = await flowFetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }, cookieJar);

    const passData = await passRes.json();

    if (passData.response_errors || passData.component === 'ak-stage-password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Step 3: Create temporary app password for OAuth token exchange
    // Clean up any existing temp token
    await fetch(`${AUTHENTIK_API_URL}/core/tokens/vca-login-${authentikUser.pk}/`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
    }).catch(() => {});

    const appPwRes = await fetch(`${AUTHENTIK_API_URL}/core/tokens/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Host': AUTHENTIK_HOST,
      },
      body: JSON.stringify({
        identifier: `vca-login-${authentikUser.pk}`,
        intent: 'app_password',
        user: authentikUser.pk,
        expiring: true,
        expires: new Date(Date.now() + 60000).toISOString(),
      }),
    });

    if (!appPwRes.ok) {
      console.error('App password creation failed:', await appPwRes.text());
      return res.status(500).json({ error: 'Failed to create authentication token' });
    }

    const appPw = await appPwRes.json();

    // Get the key value
    const keyRes = await fetch(`${AUTHENTIK_API_URL}/core/tokens/${appPw.identifier}/view_key/`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
    });
    const keyData = await keyRes.json();

    // Step 4: Exchange app password for OAuth tokens
    const tokenRes = await fetch(AUTHENTIK_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Host': AUTHENTIK_HOST },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AUTHENTIK_CLIENT_ID,
        client_secret: AUTHENTIK_CLIENT_SECRET,
        username: email,
        password: keyData.key,
        scope: 'openid email profile',
      }),
    });

    // Clean up temp token
    await fetch(`${AUTHENTIK_API_URL}/core/tokens/${appPw.identifier}/`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
    }).catch(() => {});

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({}));
      console.error('Token exchange failed:', errBody);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = await tokenRes.json();

    // Step 5: Get user info
    const userInfoRes = await fetch(AUTHENTIK_USERINFO_ENDPOINT, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Host': AUTHENTIK_HOST },
    });

    const userInfo = userInfoRes.ok ? await userInfoRes.json() : { sub: String(authentikUser.pk), email };

    // Fetch profile from database by email (most reliable match)
    const profileResult = await pool.query(
      'SELECT id, email, full_name, role FROM profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }));

    const profile = profileResult.rows[0];

    // Use database profile ID if available (preserves existing data associations)
    const userId = profile?.id || authentikUser.uuid || userInfo.sub;
    const userRole = profile?.role || 'SCRIPT_WRITER';

    // Mint PostgREST-compatible JWT so auth.uid() returns the database profile ID
    const postgrestToken = mintPostgrestToken(userId, email, userRole);

    res.json({
      session: {
        access_token: postgrestToken,
        refresh_token: tokens.refresh_token,
        user: {
          id: userId,
          email: userInfo.email || email,
          user_metadata: {
            full_name: profile?.full_name || userInfo.name || authentikUser.name || '',
          },
          app_metadata: {
            role: userRole,
          },
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register
 * Create user in Authentik + profile in database
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get Authentik admin token
    const adminToken = await getAuthentikAdminToken();

    // Create user in Authentik
    const createRes = await fetch(`${AUTHENTIK_API_URL}/core/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Host': AUTHENTIK_HOST,
      },
      body: JSON.stringify({
        username: email,
        email: email,
        name: fullName || email,
        is_active: true,
        path: 'users',
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      return res.status(400).json({
        error: errBody.detail || errBody.username?.[0] || 'Failed to create user',
      });
    }

    const authentikUser = await createRes.json();

    // Set password
    await fetch(`${AUTHENTIK_API_URL}/core/users/${authentikUser.pk}/set_password/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Host': AUTHENTIK_HOST,
      },
      body: JSON.stringify({ password }),
    });

    // Create user record in our database
    await pool.query(
      'INSERT INTO users (id, email, created_at) VALUES ($1, $2, NOW())',
      [authentikUser.pk, email]
    );

    // Create profile
    await pool.query(
      `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'SCRIPT_WRITER', NOW(), NOW())`,
      [authentikUser.pk, email, fullName || '']
    );

    // Now create an app password and exchange for OAuth tokens
    const appPwRes = await fetch(`${AUTHENTIK_API_URL}/core/tokens/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Host': AUTHENTIK_HOST,
      },
      body: JSON.stringify({
        identifier: `vca-login-${authentikUser.pk}`,
        intent: 'app_password',
        user: authentikUser.pk,
        expiring: true,
        expires: new Date(Date.now() + 60000).toISOString(),
      }),
    });

    let tokens = null;
    if (appPwRes.ok) {
      const appPw = await appPwRes.json();
      const keyRes = await fetch(`${AUTHENTIK_API_URL}/core/tokens/${appPw.identifier}/view_key/`, {
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
      });
      const keyData = await keyRes.json();

      const tokenRes = await fetch(AUTHENTIK_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Host': AUTHENTIK_HOST },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: AUTHENTIK_CLIENT_ID,
          client_secret: AUTHENTIK_CLIENT_SECRET,
          username: email,
          password: keyData.key,
          scope: 'openid email profile',
        }),
      });

      // Clean up
      await fetch(`${AUTHENTIK_API_URL}/core/tokens/${appPw.identifier}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Host': AUTHENTIK_HOST },
      }).catch(() => {});

      if (tokenRes.ok) {
        tokens = await tokenRes.json();
      }
    }

    // Mint PostgREST-compatible JWT for the new user
    const postgrestToken = mintPostgrestToken(String(authentikUser.pk), email, 'SCRIPT_WRITER');

    res.status(201).json({
      session: {
        access_token: postgrestToken,
        refresh_token: tokens?.refresh_token || '',
        user: {
          id: String(authentikUser.pk),
          email: email,
          user_metadata: { full_name: fullName || '' },
          app_metadata: { role: 'SCRIPT_WRITER' },
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Revoke token (best-effort)
 */
router.post('/logout', async (req, res) => {
  // Authentik token revocation is optional since JWTs are stateless
  // The frontend clears localStorage which is sufficient
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Return current user info from JWT
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify our own HS256 JWT
    const decoded = jwt.verify(token, POSTGREST_JWT_SECRET);

    // Fetch full profile by email from the JWT
    const profileResult = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, is_trusted_writer FROM profiles WHERE email = $1',
      [decoded.email]
    );

    const profile = profileResult.rows[0];
    const userId = profile?.id || decoded.sub;

    res.json({
      user: {
        id: userId,
        email: decoded.email,
        user_metadata: {
          full_name: profile?.full_name || '',
        },
        app_metadata: {
          role: profile?.role || 'SCRIPT_WRITER',
        },
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Exchange refresh token with Authentik to verify it's still valid
    const tokenRes = await fetch(AUTHENTIK_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Host': AUTHENTIK_HOST },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: AUTHENTIK_CLIENT_ID,
        client_secret: AUTHENTIK_CLIENT_SECRET,
        refresh_token: refresh_token,
      }),
    });

    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Failed to refresh token' });
    }

    const tokens = await tokenRes.json();

    // Get user info from the new Authentik token to find the profile
    const userInfoRes = await fetch(AUTHENTIK_USERINFO_ENDPOINT, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Host': AUTHENTIK_HOST },
    });

    if (!userInfoRes.ok) {
      return res.status(401).json({ error: 'Failed to get user info' });
    }

    const userInfo = await userInfoRes.json();

    // Look up profile and mint new PostgREST JWT
    const profileResult = await pool.query(
      'SELECT id, email, role FROM profiles WHERE email = $1',
      [userInfo.email]
    ).catch(() => ({ rows: [] }));

    const profile = profileResult.rows[0];
    const userId = profile?.id || userInfo.sub;
    const userRole = profile?.role || 'SCRIPT_WRITER';

    const postgrestToken = mintPostgrestToken(userId, userInfo.email, userRole);

    res.json({
      access_token: postgrestToken,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper: Mint a PostgREST-compatible HS256 JWT
 * Sets sub = database profile UUID so auth.uid() works with RLS policies
 */
function mintPostgrestToken(profileId, email, role) {
  return jwt.sign(
    {
      sub: profileId,
      email: email,
      role: 'authenticated',
      app_role: role,
    },
    POSTGREST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Helper: Get Authentik API admin token
 */
async function getAuthentikAdminToken() {
  // Use Authentik API token from environment
  if (process.env.AUTHENTIK_API_TOKEN) {
    return process.env.AUTHENTIK_API_TOKEN;
  }

  // Alternatively, use client credentials flow
  const res = await fetch(AUTHENTIK_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AUTHENTIK_CLIENT_ID,
      client_secret: AUTHENTIK_CLIENT_SECRET,
      scope: 'openid',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to get Authentik admin token');
  }

  const data = await res.json();
  return data.access_token;
}

module.exports = router;
