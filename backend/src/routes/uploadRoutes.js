/**
 * File Upload Routes
 * Handles video uploads to Google Drive (replaces Supabase Storage)
 */

const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const googleDriveUploadService = require('../services/googleDriveUploadService');
const { verifyAuth } = require('../middleware/jwtAuth');

const router = express.Router();
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

// Configure multer for memory storage (files stored in RAM temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow video and audio files
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed'));
    }
  },
});

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
    const baseFolderId = process.env.GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID;

    if (!baseFolderId) {
      return res.status(500).json({ error: 'Raw footage folder not configured' });
    }

    const fileName = projectId
      ? `[${projectId}] ${req.file.originalname}`
      : req.file.originalname;

    const result = await googleDriveUploadService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      baseFolderId,
      {
        description: `Raw footage for ${projectId || 'project'}`,
        properties: {
          uploadedBy: req.user.email,
          projectId: projectId || '',
          fileType: 'raw_footage',
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
    const baseFolderId = process.env.GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID;

    if (!baseFolderId) {
      return res.status(500).json({ error: 'Edited video folder not configured' });
    }

    const fileName = projectId
      ? `[${projectId}] ${req.file.originalname}`
      : req.file.originalname;

    const result = await googleDriveUploadService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      baseFolderId,
      {
        description: `Edited video for ${projectId || 'project'}`,
        properties: {
          uploadedBy: req.user.email,
          projectId: projectId || '',
          fileType: 'edited_video',
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
 * Initialize a resumable upload session (for direct frontend-to-Drive uploads)
 * POST /api/upload/init-resumable
 * Returns a resumable URI that the frontend can upload to directly (no auth needed on the URI)
 */
router.post('/init-resumable', verifyAuth, async (req, res) => {
  try {
    const { contentId, analysisId, fileName, mimeType, fileSize, fileType, fileIndex } = req.body;

    if (!fileName || !mimeType || !fileSize || !fileType) {
      return res.status(400).json({ error: 'Missing required fields: fileName, mimeType, fileSize, fileType' });
    }

    // Determine base folder ID from env
    const folderMap = {
      'raw-footage': process.env.GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID,
      'edited-video': process.env.GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID,
      'final-video': process.env.GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID,
    };

    const baseFolderId = folderMap[fileType];
    if (!baseFolderId) {
      return res.status(400).json({ error: `Invalid or unconfigured fileType: ${fileType}` });
    }

    // Get or create project subfolder: {base}/{contentId}/
    const projectId = contentId || analysisId;
    const folderId = await googleDriveUploadService.getOrCreateProjectFolder(projectId, baseFolderId);

    // Auto-rename file based on type + existing count
    const ext = fileName.split('.').pop() || 'mp4';
    let renamedFileName = fileName;

    if (contentId && pool) {
      if (fileType === 'raw-footage') {
        // Count existing raw files for this project
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM production_files WHERE analysis_id = $1 AND file_type IN ('raw-footage', 'A_ROLL', 'B_ROLL', 'HOOK', 'BODY', 'CTA', 'AUDIO_CLIP', 'OTHER') AND is_deleted = false`,
          [analysisId]
        );
        const existingCount = parseInt(countResult.rows[0].count, 10);
        const rawNum = existingCount + (fileIndex || 0) + 1;
        renamedFileName = `${contentId}_raw_${String(rawNum).padStart(2, '0')}.${ext}`;
      } else if (fileType === 'edited-video') {
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM production_files WHERE analysis_id = $1 AND file_type = 'edited-video' AND is_deleted = false`,
          [analysisId]
        );
        const existingCount = parseInt(countResult.rows[0].count, 10);
        const versionNum = existingCount + 1;
        renamedFileName = `${contentId}_v${versionNum}.${ext}`;
      } else if (fileType === 'final-video') {
        renamedFileName = `${contentId}_final.${ext}`;
      }
    }

    // Create resumable upload session
    const resumableUri = await googleDriveUploadService.createResumableSession(
      renamedFileName,
      mimeType,
      fileSize,
      folderId
    );

    res.json({
      success: true,
      resumableUri,
      fileName: renamedFileName,
      folderId,
    });
  } catch (error) {
    console.error('Init resumable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Finalize an upload — make file public and save record to DB
 * POST /api/upload/finalize
 */
router.post('/finalize', verifyAuth, async (req, res) => {
  try {
    const { analysisId, fileType, fileName, fileId, fileUrl, fileSize, mimeType } = req.body;

    if (!analysisId || !fileType || !fileName || !fileId) {
      return res.status(400).json({ error: 'Missing required fields: analysisId, fileType, fileName, fileId' });
    }

    // Make file publicly accessible
    await googleDriveUploadService.makeFilePublic(fileId);

    // Save record to production_files table
    if (pool) {
      const result = await pool.query(
        `INSERT INTO production_files (analysis_id, file_type, file_name, file_url, file_id, file_size, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [analysisId, fileType, fileName, fileUrl || `https://drive.google.com/file/d/${fileId}/view`, fileId, fileSize || null, mimeType || null, req.user.id]
      );

      res.json({
        success: true,
        record: result.rows[0],
      });
    } else {
      res.json({
        success: true,
        message: 'File made public but database not configured',
      });
    }
  } catch (error) {
    console.error('Finalize upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Download multiple files as a streamed zip
 * GET /api/upload/download-zip?fileIds=id1,id2&name=project-name
 * Streams files from Google Drive through the server into a zip — no buffering in memory.
 */
router.get('/download-zip', verifyAuth, async (req, res) => {
  const archiver = require('archiver');

  try {
    const { fileIds, name } = req.query;
    if (!fileIds) {
      return res.status(400).json({ error: 'fileIds query parameter required' });
    }

    const ids = fileIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No file IDs provided' });
    }

    const zipName = `${name || 'raw-footage'}.zip`;

    // Collect file streams before starting the zip response.
    // This way if ALL files fail we can return a proper error instead of an empty zip.
    const entries = [];
    for (const fileId of ids) {
      try {
        const metadata = await googleDriveUploadService.getFileMetadata(fileId);
        const fileStream = await googleDriveUploadService.downloadFileStream(fileId);
        entries.push({ stream: fileStream, name: metadata.name, size: parseInt(metadata.size, 10) || undefined });
        console.log(`✅ Prepared file for zip: ${metadata.name} (${metadata.size} bytes)`);
      } catch (err) {
        console.error(`⚠️  Skipping file ${fileId}:`, err.message);
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No files could be downloaded from Google Drive' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    // Use DEFLATE level 0 (no compression) — more compatible than STORE mode with streamed entries
    const archive = archiver('zip', { zlib: { level: 0 } });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip' });
      }
    });

    archive.pipe(res);

    for (const entry of entries) {
      archive.append(entry.stream, { name: entry.name });
    }

    await archive.finalize();
    console.log(`📦 Zip finalized: ${zipName} with ${entries.length} file(s)`);
  } catch (error) {
    console.error('Zip download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Delete file
 * DELETE /api/upload/:fileId
 * Only the uploader or an admin can delete files
 */
router.delete('/:fileId', verifyAuth, async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Check file ownership - user must be uploader or admin
    const fileResult = await pool.query(
      'SELECT uploaded_by FROM production_files WHERE file_id = $1',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found in database' });
    }

    const file = fileResult.rows[0];
    const roleResult = await pool.query(
      'SELECT role FROM profiles WHERE id = $1',
      [req.user.id]
    );
    const userRole = roleResult.rows[0]?.role;
    const isAdmin = ['SUPER_ADMIN', 'CREATOR'].includes(userRole);
    if (file.uploaded_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete files you uploaded' });
    }

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
