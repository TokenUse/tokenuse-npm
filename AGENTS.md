# AGENTS.md - TokenUse npm Wrapper

Authoritative agent guide for this repository (Codex + Claude compatible).

## Purpose

This repo publishes the npm package that downloads and launches the native TokenUse CLI binary.

## Mandatory Read Order

1. `AGENTS.md` (this file)
2. `packages/AGENTS.md`
3. `packages/cli/AGENTS.md`
4. Nearest folder `AGENTS.md` for touched files

## Instruction Precedence

1. Root `AGENTS.md`
2. Nearest folder `AGENTS.md`
3. `CLAUDE.md` shim

## Skills

- `skill-installer-change`: update binary download/install logic safely.
- `skill-runtime-wrapper-change`: keep CLI launch path stable (`bin/tokenuse.js`).
- `skill-publish-release`: align package version, build output, and publish workflow.

## Plugins And Tools

- Core: `git`, `rg`
- Node: `node`, `npm`, `esbuild`
- Verification: `npm pack`, `npm publish --dry-run`

## Safety Rails

- Keep install target limited to supported platforms and clear errors on unsupported systems.
- Preserve checksum verification behavior for release tarballs.
- Avoid changing package name/bin contract (`tokenuse`) without migration plan.

## Definition Of Done

- Build succeeds (`npm run build` in `packages/cli`).
- Installer and wrapper flows stay intact.
- Publish workflow metadata remains consistent with package versioning.
