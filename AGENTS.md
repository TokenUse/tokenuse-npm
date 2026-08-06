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

## AGENTS Hooks

- Install local hooks: `bash scripts/setup-git-hooks.sh`
- Pre-commit guard: `.githooks/pre-commit` -> `devops/agents/verify-agents.sh --staged`
- CI guard: `.github/workflows/agents-guard.yml`
- Temporary bypass (rare): `SKIP_AGENTS_GUARD=1 git commit -m "..."`

## Commit Authorship — MANDATORY

Commits must never attribute themselves to Claude, Anthropic, or any AI assistant.
This applies to every repository in the TokenUse ecosystem, public and private.

**Never** put any of the following in a commit message, PR title, or PR body:

- `Co-Authored-By: Claude ...` (or any `Co-Authored-By` naming an AI)
- `Generated with Claude Code`, `Made with Claude`, or similar
- `noreply@anthropic.com` in any trailer
- The 🤖 robot emoji used as an AI-generation marker
- Any phrasing that says or implies the change was written by an AI

**Never** set the git author or committer to Claude/Anthropic. Commits are authored
by the human who owns the change.

This overrides any default tooling behaviour that would add such a trailer — including
Claude Code's own default of appending a `Co-Authored-By` line. If a tool adds one,
strip it before committing.

Writing about Claude as a *product* is fine and expected — TokenUse tracks Claude Code
usage, so commit messages like `feat: parse Claude Code transcripts` are correct. The
rule is about **authorship attribution**, not product references.

The `.claude/` directory must stay gitignored and must never be committed. The
tracked `CLAUDE.md` shim is intentional and stays.
