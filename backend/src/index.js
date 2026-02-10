require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
}));
app.use(express.json());

// Serve voice notes as static files
app.use('/files/voice-notes', express.static(voiceNoteService.getBaseDir()));

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
    const { email, fullName, role } = req.body;

    if (!email || !fullName || !role) {
      return res.status(400).json({
        error: 'Missing required fields: email, fullName, role',
      });
    }

    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
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
        `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [userId, email, fullName, role]
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

// Reset user PIN endpoint (Admin only)
app.post('/api/admin/users/:userId/reset-pin', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !pool) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Clear PIN so user must set a new one on next Google sign-in
    await pool.query(
      'UPDATE profiles SET pin_hash = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    res.json({ success: true, message: 'PIN reset. User will set a new PIN on next login.' });
  } catch (error) {
    console.error('Admin reset PIN error:', error);
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
