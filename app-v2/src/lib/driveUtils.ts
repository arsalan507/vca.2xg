/**
 * Google Drive utility functions (no auth required)
 */

/**
 * Extract Google Drive file ID from a URL or return as-is if already an ID.
 */
export function extractDriveFileId(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return fileIdOrUrl;
  if (!fileIdOrUrl.includes('/') && !fileIdOrUrl.includes('?')) return fileIdOrUrl;
  const fileMatch = fileIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return fileIdOrUrl;
}

/**
 * Build a direct download URL for a Google Drive file.
 */
export function getDriveDownloadUrl(fileIdOrUrl: string): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}
