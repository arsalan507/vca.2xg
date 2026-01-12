/**
 * File Upload Routes
 * Handles video uploads to Supabase Storage (no OAuth needed!)
 */

const express = require('express');
const multer = require('multer');
const supabaseStorageService = require('../services/supabaseStorageService');
const googleDriveUploadService = require('../services/googleDriveUploadService');

const router = express.Router();

// Configure multer for memory storage (files stored in RAM temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// Middleware to verify authentication (reuse from main app)
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Upload raw footage (for videographers)
 * POST /api/upload/raw-footage
 */
router.post('/raw-footage', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId } = req.body;

    // Upload to Supabase Storage - no OAuth needed!
    const result = await supabaseStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'raw-footage',
      projectId
    );

    res.json({
      success: true,
      fileId: result.filePath,
      fileName: result.fileName,
      webViewLink: result.fileUrl,
      webContentLink: result.fileUrl,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Raw footage upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload edited video (for editors)
 * POST /api/upload/edited-video
 */
router.post('/edited-video', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId } = req.body;

    // Upload to Supabase Storage
    const result = await supabaseStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'edited-videos',
      projectId
    );

    res.json({
      success: true,
      fileId: result.filePath,
      fileName: result.fileName,
      webViewLink: result.fileUrl,
      webContentLink: result.fileUrl,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Edited video upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload final video
 * POST /api/upload/final-video
 */
router.post('/final-video', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId } = req.body;

    const baseFolderId = process.env.GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID;

    if (!baseFolderId) {
      return res.status(500).json({ error: 'Final video folder not configured' });
    }

    // Upload directly to base folder (service accounts can't create subfolders)
    // Add project ID to filename for organization
    const fileName = projectId
      ? `[${projectId}] ${req.file.originalname}`
      : req.file.originalname;

    const result = await googleDriveUploadService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      baseFolderId,
      {
        description: `Final video for ${projectId || 'project'}`,
        properties: {
          uploadedBy: req.user.email,
          projectId: projectId || '',
          fileType: 'final_video',
        },
      }
    );

    res.json({
      success: true,
      fileId: result.fileId,
      fileName: result.fileName,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
      size: result.size,
    });
  } catch (error) {
    console.error('Final video upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete file
 * DELETE /api/upload/:fileId
 */
router.delete('/:fileId', verifyAuth, async (req, res) => {
  try {
    const { fileId } = req.params;

    await googleDriveUploadService.deleteFile(fileId);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get file metadata
 * GET /api/upload/:fileId/metadata
 */
router.get('/:fileId/metadata', verifyAuth, async (req, res) => {
  try {
    const { fileId } = req.params;

    const metadata = await googleDriveUploadService.getFileMetadata(fileId);

    res.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
