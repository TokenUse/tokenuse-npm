import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultBinaryPath = join(__dirname, '..', '.tokenuse', 'bin', 'tokenuse');
const binaryPath = process.env.TOKENUSE_NPM_BINARY_PATH || defaultBinaryPath;

function warn(message) {
  console.warn(`[tokenuse] ${message}`);
}

function uninstall() {
  if (!existsSync(binaryPath)) {
    warn('native binary not found; skipping tracker cleanup');
    return;
  }

  console.log('[tokenuse] stopping TokenUse background tracker before package removal...');
  const result = spawnSync(binaryPath, ['uninstall', '--keep-data'], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    warn(`could not run tracker cleanup (${result.error.message}); continuing package removal`);
    return;
  }

  if (result.status !== 0) {
    warn(`tracker cleanup exited with status ${result.status}; continuing package removal`);
  }
}

uninstall();
