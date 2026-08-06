import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

const wrapperSource = await readFile(new URL('../bin/tokenuse.js', import.meta.url), 'utf8');

async function withPackageFixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'tokenuse-bin-'));
  try {
    await mkdir(join(root, 'bin'), { recursive: true });
    await writeFile(join(root, 'bin', 'tokenuse.js'), wrapperSource, { mode: 0o755 });
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('bin wrapper fails closed when postinstall binary is absent', async () => {
  await withPackageFixture(async (root) => {
    const result = spawnSync(process.execPath, [join(root, 'bin', 'tokenuse.js'), '--help'], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /TokenUse binary not found/);
  });
});

test('bin wrapper forwards arguments to the installed binary', async () => {
  await withPackageFixture(async (root) => {
    const binaryDir = join(root, '.tokenuse', 'bin');
    const argsPath = join(root, 'args.txt');
    await mkdir(binaryDir, { recursive: true });
    await writeFile(
      join(binaryDir, 'tokenuse'),
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\n`,
      { mode: 0o755 },
    );
    await chmod(join(binaryDir, 'tokenuse'), 0o755);

    const result = spawnSync(process.execPath, [join(root, 'bin', 'tokenuse.js'), 'version', '--json'], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(argsPath, 'utf8'), 'version\n--json\n');
  });
});
