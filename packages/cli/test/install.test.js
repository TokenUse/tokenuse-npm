import { createHash } from 'crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import http, { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { connect as connectSocket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn, spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from 'tar';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = packageJson.version;
process.env.TOKENUSE_INSTALL_VERSION ||= version;
const installScript = new URL('../src/install.js', import.meta.url);
const { formatProxyDiagnostics, resolveProxy } = await import('../src/install.js');

function platformName() {
  const osName = process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : process.platform;
  const archName = process.arch === 'x64' ? 'amd64' : process.arch;
  return `${osName}_${archName}`;
}

async function buildTarball(root) {
  const platform = platformName();
  const dirName = `tokenuse_${version}_${platform}`;
  const fixtureDir = join(root, dirName);
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(join(fixtureDir, 'tokenuse'), '#!/bin/sh\necho "TokenUse fixture"\n', { mode: 0o755 });

  const tarballName = `${dirName}.tar.gz`;
  const tarballPath = join(root, tarballName);
  await create({ gzip: true, cwd: root, file: tarballPath }, [dirName]);
  const hash = createHash('sha256').update(await readFile(tarballPath)).digest('hex');

  return { platform, tarballName, tarballPath, hash };
}

async function withFixtureServer(checksumsText, tarballPath, fn) {
  const sockets = new Set();
  const server = createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    if (req.url.endsWith('/checksums.txt')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(checksumsText);
      return;
    }

    if (req.url.endsWith('.tar.gz')) {
      const body = await readFile(tarballPath);
      res.writeHead(200, { 'content-type': 'application/gzip' });
      res.end(body);
      return;
    }

    res.writeHead(404).end();
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function withHttpsFixtureServer(checksumsText, tarballPath, tlsConfig, fn) {
  const sockets = new Set();
  const server = createHttpsServer(tlsConfig, async (req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    if (req.url.endsWith('/checksums.txt')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(checksumsText);
      return;
    }

    if (req.url.endsWith('.tar.gz')) {
      const body = await readFile(tarballPath);
      res.writeHead(200, { 'content-type': 'application/gzip' });
      res.end(body);
      return;
    }

    res.writeHead(404).end();
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await fn(`https://127.0.0.1:${address.port}`);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function withProxyServer(fn) {
  const stats = { httpRequests: 0, connectRequests: 0 };
  const sockets = new Set();
  const tunnelSockets = new Set();
  const server = createServer((req, res) => {
    stats.httpRequests += 1;

    let target;
    try {
      target = new URL(req.url);
    } catch {
      res.writeHead(400).end();
      return;
    }

    const proxyRequest = http.request({
      hostname: target.hostname,
      port: target.port || '80',
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...req.headers,
        host: target.host,
      },
    }, (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    });

    proxyRequest.on('error', (err) => {
      res.writeHead(502).end(err.message);
    });
    req.pipe(proxyRequest);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.on('connect', (req, clientSocket, head) => {
    stats.connectRequests += 1;
    const [host, port] = req.url.split(':');
    const upstreamSocket = connectSocket(Number(port), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    });
    tunnelSockets.add(clientSocket);
    tunnelSockets.add(upstreamSocket);

    const closeBoth = () => {
      upstreamSocket.destroy();
      clientSocket.destroy();
    };
    const forgetTunnelSockets = () => {
      tunnelSockets.delete(clientSocket);
      tunnelSockets.delete(upstreamSocket);
    };
    upstreamSocket.on('error', closeBoth);
    clientSocket.on('error', closeBoth);
    upstreamSocket.on('close', forgetTunnelSockets);
    clientSocket.on('close', forgetTunnelSockets);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await fn(`http://127.0.0.1:${address.port}`, () => ({ ...stats }));
  } finally {
    for (const socket of tunnelSockets) socket.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function createTestCertificate(root) {
  const certPath = join(root, 'cert.pem');
  const keyPath = join(root, 'key.pem');
  const result = spawnSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-sha256',
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1,DNS:localhost',
  ], { stdio: 'ignore' });

  if (result.status !== 0) return null;
  return { certPath, keyPath };
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  return port;
}

async function runInstaller(baseUrl, binaryDir, extraEnv = {}) {
  const proxyEnvDefaults = {
    npm_config_https_proxy: '',
    npm_config_proxy: '',
    npm_config_noproxy: '',
    HTTPS_PROXY: '',
    https_proxy: '',
    HTTP_PROXY: '',
    http_proxy: '',
    NO_PROXY: '',
    no_proxy: '',
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [installScript.pathname], {
      env: {
        ...process.env,
        ...proxyEnvDefaults,
        TOKENUSE_BINARY_DIR: binaryDir,
        TOKENUSE_RELEASE_BASE_URL: baseUrl,
        TOKENUSE_INSTALL_VERSION: version,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('proxy resolver prefers npm config and redacts diagnostics', () => {
  const proxy = resolveProxy('https://github.com/tokenuse/tokenuse/releases', {
    npm_config_https_proxy: 'http://user:secret@npm-proxy.example:8080',
    HTTPS_PROXY: 'http://env-proxy.example:8080',
  });

  assert.equal(proxy.source, 'npm_config_https_proxy');
  assert.equal(proxy.url.hostname, 'npm-proxy.example');

  const diagnostics = formatProxyDiagnostics(['https://github.com/tokenuse/tokenuse/releases'], {
    npm_config_https_proxy: 'http://user:secret@npm-proxy.example:8080',
  });
  assert.match(diagnostics, /npm_config_https_proxy/);
  assert.match(diagnostics, /http:\/\/\*\*\*:\*\*\*@npm-proxy\.example:8080\//);
  assert.doesNotMatch(diagnostics, /secret/);
});

test('proxy resolver honors NO_PROXY exact, suffix, port, and wildcard entries', () => {
  const env = {
    HTTPS_PROXY: 'http://proxy.example:8080',
    NO_PROXY: 'api.github.com,.internal.example.com,localhost:8080',
  };

  assert.equal(resolveProxy('https://api.github.com/repos/tokenuse/tokenuse', env), null);
  assert.equal(resolveProxy('https://service.internal.example.com/download', env), null);
  assert.equal(resolveProxy('https://localhost:8080/download', env), null);
  assert.equal(resolveProxy('https://localhost:8443/download', env)?.source, 'HTTPS_PROXY');
  assert.equal(resolveProxy('https://github.com/tokenuse/tokenuse', { HTTPS_PROXY: 'http://proxy.example:8080', NO_PROXY: '*' }), null);
});

test('installer extracts verified fixture binary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-install-'));
  try {
    const fixture = await buildTarball(root);
    const binaryDir = join(root, 'bin');
    const checksums = `${fixture.hash}  ${fixture.tarballName}\n`;

    await withFixtureServer(checksums, fixture.tarballPath, async (baseUrl) => {
      const result = await runInstaller(baseUrl, binaryDir);
      assert.equal(result.code, 0, result.stderr);
      const installed = await stat(join(binaryDir, 'tokenuse'));
      assert.equal(Boolean(installed.mode & 0o111), true);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('installer fails closed on checksum mismatch and leaves no binary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-install-'));
  try {
    const fixture = await buildTarball(root);
    const binaryDir = join(root, 'bin');
    const checksums = `${'0'.repeat(64)}  ${fixture.tarballName}\n`;

    await withFixtureServer(checksums, fixture.tarballPath, async (baseUrl) => {
      const result = await runInstaller(baseUrl, binaryDir);
      assert.notEqual(result.code, 0);
      await assert.rejects(stat(join(binaryDir, 'tokenuse')), { code: 'ENOENT' });
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('installer fails closed when checksums omit platform tarball', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-install-'));
  try {
    const fixture = await buildTarball(root);
    const binaryDir = join(root, 'bin');
    const checksums = `${fixture.hash}  tokenuse_${version}_other_platform.tar.gz\n`;

    await withFixtureServer(checksums, fixture.tarballPath, async (baseUrl) => {
      const result = await runInstaller(baseUrl, binaryDir);
      assert.notEqual(result.code, 0);
      await assert.rejects(stat(join(binaryDir, 'tokenuse')), { code: 'ENOENT' });
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('proxy postinstall downloads HTTPS release assets through CONNECT proxy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-install-'));
  try {
    const certificate = createTestCertificate(root);
    if (!certificate) {
      t.skip('openssl is required to create the local HTTPS fixture certificate');
      return;
    }

    const fixture = await buildTarball(root);
    const binaryDir = join(root, 'bin');
    const checksums = `${fixture.hash}  ${fixture.tarballName}\n`;
    const tlsConfig = {
      cert: await readFile(certificate.certPath),
      key: await readFile(certificate.keyPath),
    };

    await withHttpsFixtureServer(checksums, fixture.tarballPath, tlsConfig, async (baseUrl) => {
      await withProxyServer(async (proxyUrl, proxyStats) => {
        const result = await runInstaller(baseUrl, binaryDir, {
          HTTPS_PROXY: proxyUrl,
          NODE_EXTRA_CA_CERTS: certificate.certPath,
        });

        assert.equal(result.code, 0, result.stderr);
        assert.match(result.stdout, /Checksum verified\./);
        assert.equal(proxyStats().connectRequests > 0, true);
        const installed = await stat(join(binaryDir, 'tokenuse'));
        assert.equal(Boolean(installed.mode & 0o111), true);
      });
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('network failures print proxy diagnostics and manual fallback link', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-install-'));
  try {
    const binaryDir = join(root, 'bin');
    const port = await unusedPort();
    const result = await runInstaller(`https://127.0.0.1:${port}`, binaryDir);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Network\/proxy diagnostics:/);
    assert.match(result.stderr, /Proxy env vars consulted: npm_config_https_proxy, npm_config_proxy, HTTPS_PROXY/);
    assert.match(result.stderr, /Proxy configuration detected: none/);
    assert.match(result.stderr, /Offline \/ manual install/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
