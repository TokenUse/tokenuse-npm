import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/**
 * Calculate SHA256 hash of a file.
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Parse checksums.txt content.
 * @param {string} content - Checksums file content
 * @returns {Map<string, string>} Map of filename to hash
 */
export function parseChecksums(content) {
  const checksums = new Map();
  const lines = content.trim().split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [hash, filename] = parts;
      checksums.set(filename, hash);
    }
  }

  return checksums;
}

/**
 * Verify a file against expected checksum.
 * @param {string} filePath - Path to file
 * @param {string} expectedHash - Expected SHA256 hash
 * @returns {Promise<boolean>} True if checksum matches
 */
export async function verifyChecksum(filePath, expectedHash) {
  const actualHash = await sha256File(filePath);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
