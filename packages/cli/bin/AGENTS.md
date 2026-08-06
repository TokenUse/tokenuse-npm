# AGENTS.md - bin

## Folder Purpose

`bin/` holds the executable entrypoint published by npm.

## Local Rules

- Keep startup logic minimal: resolve binary path and forward args.
- Ensure error messages are actionable for reinstall failures.
- Do not introduce install-time side effects here.
