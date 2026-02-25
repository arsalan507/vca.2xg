/**
 * Voice Note Storage Service
 * Stores voice notes on local disk, replacing Supabase Storage
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const VOICE_NOTES_DIR = path.resolve(process.env.VOICE_NOTES_DIR || '/data/voice-notes');

class VoiceNoteService {
  constructor() {
    // Sync init is fine — runs once at startup
    if (!fs.existsSync(VOICE_NOTES_DIR)) {
      fs.mkdirSync(VOICE_NOTES_DIR, { recursive: true });
      console.log(`Created voice notes directory: ${VOICE_NOTES_DIR}`);
    }
  }

  /**
   * Validate and resolve a relative file path against the base directory.
   * Prevents path traversal attacks.
   */
  _validatePath(filePath) {
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalized !== path.normalize(filePath) || path.isAbsolute(filePath)) {
      throw new Error('Invalid file path');
    }
    const fullPath = path.resolve(VOICE_NOTES_DIR, normalized);
    if (fullPath !== VOICE_NOTES_DIR && !fullPath.startsWith(VOICE_NOTES_DIR + path.sep)) {
      throw new Error('Invalid file path');
    }
    return fullPath;
  }

  /**
   * Upload/save a voice note file
   * @param {Buffer} fileBuffer - File content
   * @param {string} filePath - Relative path (e.g. "userId/hook_123456.webm")
   * @param {object} options - Upload options
   * @returns {{ path: string }}
   */
  async uploadFile(fileBuffer, filePath, options = {}) {
    const fullPath = this._validatePath(filePath);
    const dir = path.dirname(fullPath);

    await fsPromises.mkdir(dir, { recursive: true });

    // If upsert=false and file exists, throw
    if (!options.upsert) {
      try {
        await fsPromises.access(fullPath);
        throw new Error(`File already exists: ${filePath}`);
      } catch (err) {
        if (err.message.startsWith('File already exists')) throw err;
        // File does not exist — proceed
      }
    }

    await fsPromises.writeFile(fullPath, fileBuffer);
    return { path: filePath };
  }

  /**
   * Delete a voice note file
   * @param {string} filePath - Relative path
   */
  async deleteFile(filePath) {
    const fullPath = this._validatePath(filePath);
    try {
      await fsPromises.access(fullPath);
      await fsPromises.unlink(fullPath);
    } catch (err) {
      // File does not exist — nothing to delete
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /**
   * Delete multiple files
   * @param {string[]} filePaths - Array of relative paths
   */
  async deleteFiles(filePaths) {
    for (const fp of filePaths) {
      await this.deleteFile(fp);
    }
  }

  /**
   * List files in a folder
   * @param {string} folder - Relative folder path
   * @returns {Array<{ name: string, size: number }>}
   */
  async listFiles(folder) {
    const fullPath = this._validatePath(folder || '');
    try {
      await fsPromises.access(fullPath);
    } catch {
      return [];
    }

    const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
    const results = [];
    for (const e of entries) {
      if (e.isFile()) {
        const stat = await fsPromises.stat(path.join(fullPath, e.name));
        results.push({
          name: e.name,
          size: stat.size,
          created_at: stat.birthtime.toISOString(),
          updated_at: stat.mtime.toISOString(),
        });
      }
    }
    return results;
  }

  /**
   * Get the base directory for serving static files
   */
  getBaseDir() {
    return VOICE_NOTES_DIR;
  }
}

module.exports = new VoiceNoteService();
