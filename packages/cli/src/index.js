import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the path to the tokenuse binary.
 * @returns {string} Path to the binary
 */
export function getBinaryPath() {
  const binaryDir = join(__dirname, '..', '.tokenuse', 'bin');
  const binaryName = process.platform === 'win32' ? 'tokenuse.exe' : 'tokenuse';
  const binaryPath = join(binaryDir, binaryName);

  if (!existsSync(binaryPath)) {
    throw new Error(
      `TokenUse binary not found at ${binaryPath}. ` +
      `Please reinstall the package: npm install -g tokenuse`
    );
  }

  return binaryPath;
}

/**
 * Get the binary directory path.
 * @returns {string} Path to the binary directory
 */
export function getBinaryDir() {
  return join(__dirname, '..', '.tokenuse', 'bin');
}
