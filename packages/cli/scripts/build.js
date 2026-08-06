import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!pkg.version || typeof pkg.version !== 'string') {
  throw new Error('packages/cli/package.json must define a string version');
}

mkdirSync('dist', { recursive: true });

const common = {
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['tar'],
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version)
  },
  banner: {
    js: '#!/usr/bin/env node'
  }
};

await build({
  ...common,
  entryPoints: ['src/install.js'],
  outfile: 'dist/install.min.js'
});

await build({
  ...common,
  entryPoints: ['src/uninstall.js'],
  outfile: 'dist/uninstall.min.js'
});

console.log('Build complete: dist/install.min.js, dist/uninstall.min.js');
