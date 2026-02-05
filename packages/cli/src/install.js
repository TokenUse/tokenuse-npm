import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, createReadStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { extract } from 'tar';
import https from 'https';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = '0.2.1';
const BINARY_DIR = join(__dirname, '..', '.tokenuse', 'bin');

// Platform detection (inlined from platform.js)
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();
  const osName = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : (() => { throw new Error(`Unsupported: ${platform}`); })();
  const archName = (arch === 'x64' || arch === 'amd64') ? 'amd64' : (arch === 'arm64' || arch === 'aarch64') ? 'arm64' : (() => { throw new Error(`Unsupported: ${arch}`); })();
  return { os: osName, arch: archName, platform: `${osName}_${archName}` };
}

function getDownloadUrl(version) {
  return `https://github.com/tokenuse/tokenuse/releases/download/v${version}/tokenuse_${version}_${getPlatformInfo().platform}.tar.gz`;
}

function getChecksumsUrl(version) {
  return `https://github.com/tokenuse/tokenuse/releases/download/v${version}/checksums.txt`;
}

function getChecksumFilename(version) {
  return `tokenuse_${version}_${getPlatformInfo().platform}.tar.gz`;
}

// Checksum verification (inlined from verify.js)
async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function parseChecksums(content) {
  const checksums = new Map();
  for (const line of content.trim().split('\n')) {
    const [hash, filename] = line.trim().split(/\s+/);
    if (hash && filename) checksums.set(filename, hash);
  }
  return checksums;
}

/**
 * Download a file from URL.
 * @param {string} url - URL to download
 * @param {string} destPath - Destination path
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);

    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(destPath);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      unlinkSync(destPath);
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Fetch text content from URL.
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Content
 */
async function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        fetchText(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Main installation function.
 */
async function install() {
  const platform = getPlatformInfo();
  console.log(`Installing TokenUse CLI v${VERSION} for ${platform.platform}...`);

  // Create binary directory
  mkdirSync(BINARY_DIR, { recursive: true });

  const tarballPath = join(BINARY_DIR, 'tokenuse.tar.gz');
  const downloadUrl = getDownloadUrl(VERSION);

  // Download tarball
  console.log(`Downloading from ${downloadUrl}...`);
  await downloadFile(downloadUrl, tarballPath);

  // Download and verify checksum
  console.log('Verifying checksum...');
  try {
    const checksumsUrl = getChecksumsUrl(VERSION);
    const checksumsContent = await fetchText(checksumsUrl);
    const checksums = parseChecksums(checksumsContent);
    const expectedFilename = getChecksumFilename(VERSION);
    const expectedHash = checksums.get(expectedFilename);

    if (expectedHash) {
      const actualHash = await sha256File(tarballPath);
      if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
        unlinkSync(tarballPath);
        throw new Error(`Checksum verification failed!\nExpected: ${expectedHash}\nActual: ${actualHash}`);
      }
      console.log('Checksum verified.');
    } else {
      console.log('Warning: Checksum not found, skipping verification.');
    }
  } catch (err) {
    console.log(`Warning: Could not verify checksum: ${err.message}`);
  }

  // Extract tarball
  console.log('Extracting...');
  await extract({
    file: tarballPath,
    cwd: BINARY_DIR,
    strip: 1 // Remove the top-level directory from the archive
  });

  // Set executable permission
  const binaryPath = join(BINARY_DIR, 'tokenuse');
  if (existsSync(binaryPath)) {
    chmodSync(binaryPath, 0o755);
  }

  // Cleanup
  unlinkSync(tarballPath);

  console.log('TokenUse CLI installed successfully!');
  console.log('');
  console.log('Get started:');
  console.log('  tokenuse          # Start tracking (auto signs in)');
  console.log('  tokenuse status   # Check tracking status');
}

// Run installation
install().catch((err) => {
  console.error(`Installation failed: ${err.message}`);
  process.exit(1);
});
