import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/install.js'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/install.min.js',
  external: ['tar'],
  banner: {
    js: '#!/usr/bin/env node'
  }
});

console.log('Build complete: dist/install.min.js');
