import { createHash } from 'crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from 'tar';

const version = '0.4.0';
const installScript = new URL('../src/install.js', import.meta.url);

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

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function runInstaller(baseUrl, binaryDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [installScript.pathname], {
      env: {
        ...process.env,
        TOKENUSE_BINARY_DIR: binaryDir,
        TOKENUSE_RELEASE_BASE_URL: baseUrl,
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
