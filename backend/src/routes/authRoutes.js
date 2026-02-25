/**
 * Authentication Routes
 * Google Sign-In + 4-digit PIN authentication
 */

const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const POSTGREST_JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Simple in-memory rate limiter for PIN attempts
const pinAttempts = new Map(); // key: email/ip -> { count, resetAt }
const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkPinRateLimit(key) {
  const now = Date.now();
  const entry = pinAttempts.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= PIN_MAX_ATTEMPTS) {
      const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
      return { blocked: true, minutesLeft };
    }
    entry.count++;
    return { blocked: false };
  }
  pinAttempts.set(key, { count: 1, resetAt: now + PIN_WINDOW_MS });
  return { blocked: false };
}

function clearPinRateLimit(key) {
  pinAttempts.delete(key);
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pinAttempts) {
    if (now >= entry.resetAt) pinAttempts.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Verify Google ID token by calling Google's tokeninfo endpoint
 */
async function verifyGoogleToken(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) {
    throw new Error('Invalid Google token');
  }
  const payload = await res.json();

  // Verify the token is for our app
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token not intended for this app');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email,
    googleId: payload.sub,
    picture: payload.picture || null,
  };
}

/**
 * Mint a PostgREST-compatible HS256 JWT
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
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/google
 * Sign in with Google. Creates profile if new user.
 * Returns { needsPin: true } if user hasn't set a PIN yet.
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    const googleUser = await verifyGoogleToken(credential);

    // Find or create profile
    let profile = null;
    if (pool) {
      const result = await pool.query(
        'SELECT id, email, full_name, role, pin_hash, google_id FROM profiles WHERE email = $1',
        [googleUser.email]
      );
      profile = result.rows[0];

      if (!profile) {
        // Create new user + profile in a transaction
        const userId = crypto.randomUUID();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            'INSERT INTO users (id, email, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO NOTHING',
            [userId, googleUser.email]
          );
          await client.query(
            `INSERT INTO profiles (id, email, full_name, role, google_id, avatar_url, created_at, updated_at)
             VALUES ($1, $2, $3, 'SCRIPT_WRITER', $4, $5, NOW(), NOW())`,
            [userId, googleUser.email, googleUser.name, googleUser.googleId, googleUser.picture]
          );
          await client.query('COMMIT');
        } catch (dbError) {
          await client.query('ROLLBACK');
          throw dbError;
        } finally {
          client.release();
        }
        profile = { id: userId, email: googleUser.email, full_name: googleUser.name, role: 'SCRIPT_WRITER', pin_hash: null, google_id: googleUser.googleId };
      } else if (!profile.google_id) {
        // Link Google account to existing profile
        await pool.query(
          'UPDATE profiles SET google_id = $1, updated_at = NOW() WHERE id = $2',
          [googleUser.googleId, profile.id]
        );
      }
    }

    if (!profile) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // If no PIN set, return a temporary token for PIN setup
    if (!profile.pin_hash) {
      const tempToken = jwt.sign(
        { sub: profile.id, email: profile.email, purpose: 'pin_setup' },
        POSTGREST_JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({
        needsPin: true,
        tempToken,
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || googleUser.name,
        },
      });
    }

    // PIN already set - full login
    const accessToken = mintPostgrestToken(profile.id, profile.email, profile.role);
    res.json({
      session: {
        access_token: accessToken,
        user: {
          id: profile.id,
          email: profile.email,
          user_metadata: { full_name: profile.full_name || googleUser.name },
          app_metadata: { role: profile.role },
        },
      },
    });
  } catch (error) {
    console.error('Google login error:', error.message);
    res.status(401).json({ error: error.message || 'Google authentication failed' });
  }
});

/**
 * POST /api/auth/set-pin
 * Set 4-digit PIN after Google sign-in (first time)
 */
router.post('/set-pin', async (req, res) => {
  try {
    const { pin, tempToken } = req.body;

    if (!pin || !tempToken) {
      return res.status(400).json({ error: 'PIN and temp token are required' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, POSTGREST_JWT_SECRET);
      if (decoded.purpose !== 'pin_setup') {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch {
      return res.status(401).json({ error: 'Token expired. Please sign in with Google again.' });
    }

    // Hash and store PIN
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await pool.query(
      'UPDATE profiles SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
      [pinHash, decoded.sub]
    );

    // Fetch profile for JWT
    const result = await pool.query(
      'SELECT id, email, full_name, role FROM profiles WHERE id = $1',
      [decoded.sub]
    );
    const profile = result.rows[0];

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const accessToken = mintPostgrestToken(profile.id, profile.email, profile.role);
    res.json({
      session: {
        access_token: accessToken,
        user: {
          id: profile.id,
          email: profile.email,
          user_metadata: { full_name: profile.full_name },
          app_metadata: { role: profile.role },
        },
      },
    });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

/**
 * POST /api/auth/pin-login
 * Login with email + 4-digit PIN
 */
router.post('/pin-login', async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }

    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Rate limit PIN attempts
    const normalizedEmail = email.toLowerCase().trim();
    const rateKey = `pin:${normalizedEmail}`;
    const rateCheck = checkPinRateLimit(rateKey);
    if (rateCheck.blocked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${rateCheck.minutesLeft} minutes.` });
    }

    const result = await pool.query(
      'SELECT id, email, full_name, role, pin_hash FROM profiles WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    const profile = result.rows[0];

    if (!profile || !profile.pin_hash) {
      return res.status(401).json({ error: 'Invalid email or PIN' });
    }

    const pinValid = await bcrypt.compare(pin, profile.pin_hash);
    if (!pinValid) {
      return res.status(401).json({ error: 'Invalid email or PIN' });
    }

    // Clear rate limit on success
    clearPinRateLimit(rateKey);

    const accessToken = mintPostgrestToken(profile.id, profile.email, profile.role);
    res.json({
      session: {
        access_token: accessToken,
        user: {
          id: profile.id,
          email: profile.email,
          user_metadata: { full_name: profile.full_name },
          app_metadata: { role: profile.role },
        },
      },
    });
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/change-pin
 * Change PIN (requires valid JWT)
 */
router.post('/change-pin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    try {
      decoded = jwt.verify(token, POSTGREST_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Reject temporary tokens (pin_setup tokens should not be used for change-pin)
    if (decoded.purpose === 'pin_setup') {
      return res.status(401).json({ error: 'Invalid token for this operation' });
    }

    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current PIN and new PIN are required' });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Verify current PIN
    const result = await pool.query(
      'SELECT pin_hash FROM profiles WHERE id = $1',
      [decoded.sub]
    );
    const profile = result.rows[0];

    if (!profile || !profile.pin_hash) {
      return res.status(400).json({ error: 'No PIN set' });
    }

    const pinValid = await bcrypt.compare(currentPin, profile.pin_hash);
    if (!pinValid) {
      return res.status(400).json({ error: 'Current PIN is incorrect' });
    }

    const pinHash = await bcrypt.hash(newPin, 10);
    await pool.query(
      'UPDATE profiles SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
      [pinHash, decoded.sub]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
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
    const decoded = jwt.verify(token, POSTGREST_JWT_SECRET);

    if (pool) {
      const result = await pool.query(
        'SELECT id, email, full_name, role, avatar_url FROM profiles WHERE email = $1',
        [decoded.email]
      );
      const profile = result.rows[0];
      if (profile) {
        return res.json({
          user: {
            id: profile.id,
            email: profile.email,
            user_metadata: { full_name: profile.full_name || '' },
            app_metadata: { role: profile.role || 'SCRIPT_WRITER' },
          },
        });
      }
    }

    res.json({
      user: {
        id: decoded.sub,
        email: decoded.email,
        user_metadata: { full_name: '' },
        app_metadata: { role: decoded.app_role || 'SCRIPT_WRITER' },
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

module.exports = router;
