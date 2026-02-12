/**
 * JWT Authentication Middleware
 * Verifies HS256 JWTs minted by our backend (matching PostgREST secret)
 */

const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const POSTGREST_JWT_SECRET = process.env.JWT_SECRET;

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
}) : null;

/**
 * Verify JWT and attach user to request
 * Sets req.user = { id, email, role }
 */
const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, POSTGREST_JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.app_role || 'authenticated',
    };
    req.token = token;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Verify JWT and check for SUPER_ADMIN role
 */
const verifyAdmin = async (req, res, next) => {
  verifyAuth(req, res, async () => {
    if (!req.user) return;

    try {
      if (!pool) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const result = await pool.query(
        'SELECT id, role FROM profiles WHERE email = $1',
        [req.user.email]
      );

      if (!result.rows[0] || !['SUPER_ADMIN', 'CREATOR'].includes(result.rows[0].role)) {
        return res.status(403).json({ error: 'Unauthorized - Admin access required' });
      }

      req.user.role = result.rows[0].role;
      next();
    } catch (error) {
      console.error('Admin verification error:', error);
      return res.status(500).json({ error: 'Authentication check failed' });
    }
  });
};

module.exports = { verifyAuth, verifyAdmin };
