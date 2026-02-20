require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { verifyAuth, verifyAdmin } = require('./middleware/jwtAuth');
const voiceNoteService = require('./services/voiceNoteService');

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection pool (only if DATABASE_URL is configured)
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
}) : null;

// Middleware - Allow multiple origins for development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://192.168.68.125:5173',
  'http://192.168.68.125:5174',
  'http://192.168.68.125:5175',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // For development, allow any localhost/192.168.x.x origin
    if (origin && origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)) {
      return callback(null, true);
    }

    // Check allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  maxAge: 86400, // Browser caches CORS preflight for 24 hours — eliminates repeat OPTIONS requests
}));
app.use(express.json());

// Serve voice notes with authentication
app.get('/files/voice-notes/*', verifyAuth, (req, res) => {
  const filePath = req.params[0];
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized !== path.normalize(filePath) || path.isAbsolute(filePath)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  const baseDir = path.resolve(voiceNoteService.getBaseDir());
  const fullPath = path.resolve(baseDir, normalized);
  if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  res.sendFile(fullPath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// ─── Auth Routes ────────────────────────────────────────────────────────────

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ─── Admin User Management ──────────────────────────────────────────────────

// Create user endpoint (Admin only)
app.post('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const { email, fullName, role, pin } = req.body;

    if (!email || !fullName || !role) {
      return res.status(400).json({
        error: 'Missing required fields: email, fullName, role',
      });
    }

    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Validate PIN if provided
    let pinHash = null;
    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      const bcrypt = require('bcryptjs');
      pinHash = await bcrypt.hash(pin, 10);
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const userId = crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO users (id, email, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO NOTHING',
        [userId, email]
      );
      await client.query(
        `INSERT INTO profiles (id, email, full_name, role, pin_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [userId, email, fullName, role, pinHash]
      );
      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    res.status(201).json({
      success: true,
      user: { id: userId, email, full_name: fullName, role },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user endpoint (Admin only)
app.delete('/api/admin/users/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !pool) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete related records that reference this user
      await client.query('DELETE FROM project_assignments WHERE user_id = $1 OR assigned_by = $1', [userId]);
      await client.query('DELETE FROM project_skips WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM production_files WHERE uploaded_by = $1', [userId]);
      await client.query('UPDATE viral_analyses SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
      await client.query('UPDATE viral_analyses SET user_id = NULL WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM profiles WHERE id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set/Reset user PIN endpoint (Admin only)
// If pin is provided, sets the PIN directly. If not, clears the PIN.
app.post('/api/admin/users/:userId/reset-pin', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { pin } = req.body;

    if (!userId || !pool) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (pin) {
      // Admin is setting a specific PIN
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      const bcrypt = require('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10);
      await pool.query(
        'UPDATE profiles SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
        [pinHash, userId]
      );
      res.json({ success: true, message: 'PIN set successfully.' });
    } else {
      // Clear PIN so user must set a new one on next Google sign-in
      await pool.query(
        'UPDATE profiles SET pin_hash = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
      res.json({ success: true, message: 'PIN reset. User will set a new PIN on next login.' });
    }
  } catch (error) {
    console.error('Admin set/reset PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role endpoint (Admin only)
app.patch('/api/admin/users/:userId/role', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!userId || !role || !pool) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }

    const validRoles = ['SUPER_ADMIN', 'CREATOR', 'SCRIPT_WRITER', 'VIDEOGRAPHER', 'EDITOR', 'POSTING_MANAGER'];
    if (!validRoles.includes(role.toUpperCase())) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const result = await pool.query(
      'UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, role',
      [role.toUpperCase(), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Storage Routes (Voice Notes) ───────────────────────────────────────────

const storageRoutes = require('./routes/storageRoutes');
app.use('/api/storage', storageRoutes);

// ─── Upload Routes (Google Drive) ───────────────────────────────────────────

const uploadRoutes = require('./routes/uploadRoutes');
app.use('/api/upload', uploadRoutes);

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Upload endpoints: http://localhost:${PORT}/api/upload/*`);
  console.log(`Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  console.log(`Storage endpoints: http://localhost:${PORT}/api/storage/*`);
});
