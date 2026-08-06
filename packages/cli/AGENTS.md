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
- Installer version is injected from `package.json` during build; do not hardcode release versions in installer logic.
- Preserve supported OS/CPU constraints in `package.json`.
