import os from 'os';

/**
 * Get the platform identifier for downloads.
 * @returns {{ os: string, arch: string, platform: string }}
 */
export function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  let osName;
  switch (platform) {
    case 'darwin':
      osName = 'darwin';
      break;
    case 'linux':
      osName = 'linux';
      break;
    case 'win32':
      osName = 'windows';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archName;
  switch (arch) {
    case 'x64':
    case 'amd64':
      archName = 'amd64';
      break;
    case 'arm64':
    case 'aarch64':
      archName = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return {
    os: osName,
    arch: archName,
    platform: `${osName}_${archName}`
  };
}

/**
 * Get the download URL for the current platform.
 * @param {string} version - Version to download
 * @returns {string} Download URL
 */
export function getDownloadUrl(version) {
  const { platform } = getPlatformInfo();
  return `https://github.com/TokenUse/tokenuse/releases/download/v${version}/tokenuse_${version}_${platform}.tar.gz`;
}

/**
 * Get the checksums URL for a version.
 * @param {string} version - Version
 * @returns {string} Checksums URL
 */
export function getChecksumsUrl(version) {
  return `https://github.com/TokenUse/tokenuse/releases/download/v${version}/checksums.txt`;
}

/**
 * Get the expected checksum filename.
 * @param {string} version - Version
 * @returns {string} Filename in checksums.txt
 */
export function getChecksumFilename(version) {
  const { platform } = getPlatformInfo();
  return `tokenuse_${version}_${platform}.tar.gz`;
}
