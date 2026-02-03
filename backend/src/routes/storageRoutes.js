/**
 * Storage Routes
 * Handles voice note uploads to local disk (replacing Supabase Storage)
 */

const express = require('express');
const multer = require('multer');
const { verifyAuth } = require('../middleware/jwtAuth');
const voiceNoteService = require('../services/voiceNoteService');

const router = express.Router();

// Multer for voice note uploads (small audio files, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * POST /api/storage/upload
 * Upload a file (voice note) to local storage
 */
router.post('/upload', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.body.path;
    const upsert = req.body.upsert === 'true';

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const result = await voiceNoteService.uploadFile(
      req.file.buffer,
      filePath,
      { upsert }
    );

    res.json({
      success: true,
      path: result.path,
    });
  } catch (error) {
    console.error('Storage upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/storage/list
 * List files in a bucket/folder
 */
router.get('/list', verifyAuth, async (req, res) => {
  try {
    const { folder } = req.query;
    const files = await voiceNoteService.listFiles(folder || '');
    res.json({ files });
  } catch (error) {
    console.error('Storage list error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/storage/delete
 * Delete files from storage
 */
router.post('/delete', verifyAuth, async (req, res) => {
  try {
    const { paths } = req.body;

    if (!paths || !Array.isArray(paths)) {
      return res.status(400).json({ error: 'Paths array is required' });
    }

    await voiceNoteService.deleteFiles(paths);
    res.json({ success: true });
  } catch (error) {
    console.error('Storage delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
