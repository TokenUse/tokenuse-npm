# AGENTS.md - packages/cli

## Folder Purpose

`packages/cli` is the npm package (`tokenuse`) that installs platform binaries and exposes the `tokenuse` command.

## Key Paths

- `package.json`: package metadata, scripts, publish contract.
- `bin/tokenuse.js`: runtime executable wrapper.
- `src/install.js`: postinstall download/extract/checksum verification.
- `scripts/build.js`: bundles installer into `dist/install.min.js`.

## Local Rules

- Keep `postinstall` path and built file names stable.
- Update `VERSION` in installer logic when releasing new binaries.
- Preserve supported OS/CPU constraints in `package.json`.
