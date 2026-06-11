import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

const common = {
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['tar'],
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
