import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import assert from 'assert/strict';

const scriptPath = new URL('../src/uninstall.js', import.meta.url).pathname;

function runWithBinary(binaryPath) {
  return spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      TOKENUSE_NPM_BINARY_PATH: binaryPath
    },
    encoding: 'utf8'
  });
}

{
  const result = runWithBinary(join(tmpdir(), 'missing-tokenuse-binary'));
  assert.equal(result.status, 0, result.stderr);
}

{
  const tempDir = mkdtempSync(join(tmpdir(), 'tokenuse-old-binary-'));
  const binaryPath = join(tempDir, 'tokenuse');
  writeFileSync(binaryPath, '#!/bin/sh\necho "unknown command: uninstall" >&2\nexit 2\n');
  chmodSync(binaryPath, 0o755);

  const result = runWithBinary(binaryPath);
  assert.equal(result.status, 0, result.stderr);
}

{
  const tempDir = mkdtempSync(join(tmpdir(), 'tokenuse-uninstall-'));
  const argsPath = join(tempDir, 'args.txt');
  const binaryPath = join(tempDir, 'tokenuse');
  writeFileSync(binaryPath, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\n`);
  chmodSync(binaryPath, 0o755);

  const result = runWithBinary(binaryPath);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(argsPath, 'utf8'), 'uninstall\n--keep-data\n');
}

console.log('preuninstall hook tests passed');
