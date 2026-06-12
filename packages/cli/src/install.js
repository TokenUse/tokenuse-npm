import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, createReadStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { extract } from 'tar';
import http from 'http';
import https from 'https';
import tls from 'tls';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = typeof __PKG_VERSION__ === 'string' ? __PKG_VERSION__ : process.env.TOKENUSE_INSTALL_VERSION;
if (!VERSION) {
  throw new Error('TokenUse installer version was not injected. Run `npm run build` before publishing.');
}
const RELEASE_BASE_URL = process.env.TOKENUSE_RELEASE_BASE_URL || 'https://github.com/tokenuse/tokenuse/releases';
const BINARY_DIR = process.env.TOKENUSE_BINARY_DIR || join(__dirname, '..', '.tokenuse', 'bin');
const PROXY_ENV_KEYS = [
  'npm_config_https_proxy',
  'npm_config_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
];
const NO_PROXY_ENV_KEYS = ['npm_config_noproxy', 'NO_PROXY', 'no_proxy'];
const MAX_REDIRECTS = 5;

// Platform detection (inlined from platform.js)
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();
  const osName = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : (() => { throw new Error(`Unsupported: ${platform}`); })();
  const archName = (arch === 'x64' || arch === 'amd64') ? 'amd64' : (arch === 'arm64' || arch === 'aarch64') ? 'arm64' : (() => { throw new Error(`Unsupported: ${arch}`); })();
  return { os: osName, arch: archName, platform: `${osName}_${archName}` };
}

function getDownloadUrl(version) {
  return `${RELEASE_BASE_URL}/download/v${version}/tokenuse_${version}_${getPlatformInfo().platform}.tar.gz`;
}

function getChecksumsUrl(version) {
  return `${RELEASE_BASE_URL}/download/v${version}/checksums.txt`;
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

function getEnvValue(env, key) {
  const value = env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function getNoProxyValue(env) {
  for (const key of NO_PROXY_ENV_KEYS) {
    const value = getEnvValue(env, key);
    if (value) return value;
  }
  return '';
}

function normalizeProxyUrl(value) {
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
  const proxyUrl = new URL(normalized);
  if (proxyUrl.protocol !== 'http:' && proxyUrl.protocol !== 'https:') {
    throw new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`);
  }
  return proxyUrl;
}

function splitNoProxy(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNoProxyEntry(entry) {
  const withoutScheme = entry.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutPath = withoutScheme.split('/')[0];
  const lastColon = withoutPath.lastIndexOf(':');

  if (lastColon > -1 && withoutPath.indexOf(']') < lastColon) {
    const host = withoutPath.slice(0, lastColon);
    const port = withoutPath.slice(lastColon + 1);
    if (/^\d+$/.test(port)) return { host: host.toLowerCase(), port };
  }

  return { host: withoutPath.toLowerCase(), port: '' };
}

function defaultPort(url) {
  return url.protocol === 'https:' ? '443' : '80';
}

function targetPort(url) {
  return url.port || defaultPort(url);
}

function hostMatchesNoProxy(targetUrl, noProxyValue) {
  const hostname = targetUrl.hostname.toLowerCase();
  const port = targetPort(targetUrl);

  for (const rawEntry of splitNoProxy(noProxyValue)) {
    if (rawEntry === '*') return true;

    const entry = normalizeNoProxyEntry(rawEntry);
    if (!entry.host) continue;
    if (entry.port && entry.port !== port) continue;

    const entryHost = entry.host.startsWith('.') ? entry.host.slice(1) : entry.host;
    if (hostname === entryHost || hostname.endsWith(`.${entryHost}`)) return true;
  }

  return false;
}

function resolveProxy(url, env = process.env) {
  const targetUrl = typeof url === 'string' ? new URL(url) : url;
  const noProxyValue = getNoProxyValue(env);
  if (noProxyValue && hostMatchesNoProxy(targetUrl, noProxyValue)) return null;

  for (const key of PROXY_ENV_KEYS) {
    const value = getEnvValue(env, key);
    if (!value) continue;
    return {
      source: key,
      url: normalizeProxyUrl(value),
    };
  }

  return null;
}

function redactProxyUrl(proxyUrl) {
  const redacted = new URL(proxyUrl.href);
  if (redacted.username) redacted.username = '***';
  if (redacted.password) redacted.password = '***';
  return redacted.toString();
}

function proxyAuthorization(proxyUrl) {
  if (!proxyUrl.username && !proxyUrl.password) return null;
  const username = decodeURIComponent(proxyUrl.username);
  const password = decodeURIComponent(proxyUrl.password);
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function proxyHeaders(proxyUrl) {
  const headers = {};
  const authorization = proxyAuthorization(proxyUrl);
  if (authorization) headers['Proxy-Authorization'] = authorization;
  return headers;
}

function requestHostHeader(url) {
  return url.port ? url.host : url.hostname;
}

function proxyConnectAuthority(url) {
  return url.port ? url.host : `${url.host}:${defaultPort(url)}`;
}

function markNetworkError(err) {
  err.isNetworkError = true;
  return err;
}

function isNetworkError(err) {
  if (!err) return false;
  if (err.isNetworkError || err.cause?.isNetworkError) return true;
  return [
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOTFOUND',
    'ETIMEDOUT',
  ].includes(err.code);
}

function httpModuleFor(url) {
  return url.protocol === 'https:' ? https : http;
}

function getUrl(url, callback) {
  const parsed = new URL(url);
  const proxy = resolveProxy(parsed);

  if (!proxy) {
    if (parsed.protocol === 'http:') return http.get(parsed, callback);
    if (parsed.protocol === 'https:') return https.get(parsed, callback);
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  if (parsed.protocol === 'http:') {
    return httpModuleFor(proxy.url).get({
      protocol: proxy.url.protocol,
      hostname: proxy.url.hostname,
      port: proxy.url.port || defaultPort(proxy.url),
      method: 'GET',
      path: parsed.href,
      headers: {
        Host: requestHostHeader(parsed),
        ...proxyHeaders(proxy.url),
      },
    }, callback);
  }

  if (parsed.protocol === 'https:') {
    const proxyRequest = httpModuleFor(proxy.url).request({
      protocol: proxy.url.protocol,
      hostname: proxy.url.hostname,
      port: proxy.url.port || defaultPort(proxy.url),
      method: 'CONNECT',
      path: proxyConnectAuthority(parsed),
      headers: {
        Host: proxyConnectAuthority(parsed),
        ...proxyHeaders(proxy.url),
      },
    });

    proxyRequest.once('connect', (proxyResponse, socket, head) => {
      if (proxyResponse.statusCode !== 200) {
        socket.destroy();
        proxyRequest.emit('error', markNetworkError(new Error(`Proxy CONNECT failed: HTTP ${proxyResponse.statusCode}`)));
        return;
      }

      if (head?.length) socket.unshift(head);

      const tlsSocket = tls.connect({
        socket,
        servername: parsed.hostname,
      });

      const tunneledRequest = https.request({
        hostname: parsed.hostname,
        port: targetPort(parsed),
        method: 'GET',
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          Host: requestHostHeader(parsed),
        },
        createConnection: () => tlsSocket,
      }, callback);

      tunneledRequest.on('error', (err) => {
        proxyRequest.emit('error', markNetworkError(err));
      });
      tunneledRequest.end();
    });

    proxyRequest.end();
    return proxyRequest;
  }

  throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
}

function removeFileQuietly(path) {
  try {
    unlinkSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function redirectUrl(currentUrl, location) {
  if (!location) throw new Error('Redirect response did not include a Location header');
  return new URL(location, currentUrl).toString();
}

/**
 * Download a file from URL.
 * @param {string} url - URL to download
 * @param {string} destPath - Destination path
 */
async function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      file.close();
      removeFileQuietly(destPath);
      reject(err);
    };

    const request = getUrl(url, (response) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirectCount >= MAX_REDIRECTS) {
          response.resume();
          fail(new Error(`Too many redirects while downloading ${url}`));
          return;
        }
        const nextUrl = redirectUrl(url, response.headers.location);
        response.resume();
        file.close();
        removeFileQuietly(destPath);
        downloadFile(nextUrl, destPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        if (settled) return;
        settled = true;
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      fail(markNetworkError(err));
    });

    file.on('error', (err) => {
      fail(err);
    });
  });
}

/**
 * Fetch text content from URL.
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Content
 */
async function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    getUrl(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirectCount >= MAX_REDIRECTS) {
          response.resume();
          reject(new Error(`Too many redirects while fetching ${url}`));
          return;
        }
        const nextUrl = redirectUrl(url, response.headers.location);
        response.resume();
        fetchText(nextUrl, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to fetch: HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', reject);
    }).on('error', (err) => reject(markNetworkError(err)));
  });
}

function configuredProxyKeys(env = process.env) {
  return PROXY_ENV_KEYS.filter((key) => getEnvValue(env, key));
}

function formatProxyDiagnostics(urls, env = process.env) {
  const lines = [
    'Network/proxy diagnostics:',
    `- Proxy env vars consulted: ${PROXY_ENV_KEYS.join(', ')}`,
    `- NO_PROXY env vars consulted: ${NO_PROXY_ENV_KEYS.join(', ')}`,
  ];

  const configuredKeys = configuredProxyKeys(env);
  lines.push(`- Proxy configuration detected: ${configuredKeys.length ? configuredKeys.join(', ') : 'none'}`);

  for (const rawUrl of urls) {
    try {
      const targetUrl = new URL(rawUrl);
      const proxy = resolveProxy(targetUrl, env);
      const target = `${targetUrl.protocol}//${targetUrl.host}`;
      if (proxy) {
        lines.push(`- ${target}: using ${proxy.source} (${redactProxyUrl(proxy.url)})`);
      } else {
        const noProxyValue = getNoProxyValue(env);
        const reason = noProxyValue && hostMatchesNoProxy(targetUrl, noProxyValue) ? 'excluded by NO_PROXY/npm_config_noproxy' : 'direct connection';
        lines.push(`- ${target}: ${reason}`);
      }
    } catch {
      lines.push(`- ${rawUrl}: could not parse URL for proxy diagnostics`);
    }
  }

  lines.push('Manual fallback (Offline / manual install): https://github.com/tokenuse/tokenuse-npm/tree/main/packages/cli#offline--manual-install');
  return lines.join('\n');
}

function installNetworkUrls() {
  try {
    return [getDownloadUrl(VERSION), getChecksumsUrl(VERSION)];
  } catch {
    return [RELEASE_BASE_URL];
  }
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

  // Download and verify checksum (fail-closed: any failure aborts the install).
  // Escape hatch for offline/dev only: set TOKENUSE_SKIP_CHECKSUM=1 to bypass (default OFF).
  if (process.env.TOKENUSE_SKIP_CHECKSUM === '1') {
    console.log('Warning: TOKENUSE_SKIP_CHECKSUM=1 set, skipping checksum verification (insecure).');
  } else {
    console.log('Verifying checksum...');
    const expectedFilename = getChecksumFilename(VERSION);

    // Fetch the published checksums. A network error / non-200 must abort —
    // proceeding here would silently run an unverified native binary.
    let checksums;
    try {
      const checksumsContent = await fetchText(getChecksumsUrl(VERSION));
      checksums = parseChecksums(checksumsContent);
    } catch (err) {
      removeFileQuietly(tarballPath);
      const checksumError = new Error(
        `Could not fetch checksums for TokenUse CLI v${VERSION} (${err.message}).\n` +
        `Refusing to install an unverified binary for ${platform.platform}.\n` +
        `Please check your network/proxy and retry. If this persists, report it at https://github.com/tokenuse/tokenuse/issues`
      );
      checksumError.isNetworkError = isNetworkError(err);
      throw checksumError;
    }

    // A checksums file with no entry for this platform's tarball must also abort —
    // never skip-and-proceed.
    const expectedHash = checksums.get(expectedFilename);
    if (!expectedHash) {
      removeFileQuietly(tarballPath);
      throw new Error(
        `No checksum found for ${expectedFilename} in the published checksums for v${VERSION}.\n` +
        `Refusing to install an unverified binary for ${platform.platform}.\n` +
        `This usually means the release is incomplete. Please retry, or report it at https://github.com/tokenuse/tokenuse/issues`
      );
    }

    // Mismatch is fatal.
    const actualHash = await sha256File(tarballPath);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      removeFileQuietly(tarballPath);
      throw new Error(
        `Checksum verification failed for ${expectedFilename} (v${VERSION}, ${platform.platform}).\n` +
        `Expected: ${expectedHash}\nActual:   ${actualHash}\n` +
        `The download may be corrupted or tampered with. Please retry. If this persists, report it at https://github.com/tokenuse/tokenuse/issues`
      );
    }
    console.log('Checksum verified.');
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
  removeFileQuietly(tarballPath);

  console.log('TokenUse CLI installed successfully!');
  console.log('');
  console.log('Get started:');
  console.log('  tokenuse          # Start tracking (auto signs in)');
  console.log('  tokenuse status   # Check tracking status');
}

export { formatProxyDiagnostics, hostMatchesNoProxy, resolveProxy };

// Run installation
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  install().catch((err) => {
    console.error(`Installation failed: ${err.message}`);
    if (isNetworkError(err)) {
      console.error('');
      console.error(formatProxyDiagnostics(installNetworkUrls()));
    }
    process.exit(1);
  });
}
