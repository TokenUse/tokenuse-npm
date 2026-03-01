# AGENTS.md - GitHub Workflows

## Folder Purpose

`.github/workflows/` contains npm publishing automation.

## What Lives Here

- `publish.yml`: publishes `packages/cli` to npm on tags or manual dispatch.

## Local Rules

- Keep Node version and registry settings explicit.
- Ensure version source logic matches tag/manual input paths.
- Do not add workflow steps that mutate unrelated repo state.
