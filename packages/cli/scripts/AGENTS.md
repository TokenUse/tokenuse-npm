# AGENTS.md - scripts

## Folder Purpose

`scripts/` contains packaging/build scripts used before publish.

## Local Rules

- Keep build output deterministic (`dist/install.min.js`).
- Avoid bundling optional runtime dependencies unexpectedly.
- Verify script changes with a fresh local build.
