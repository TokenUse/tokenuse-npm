# AGENTS.md - src

## Folder Purpose

`src/` contains installer and helper logic for platform detection, checksum verification, and binary path resolution.

## Local Rules

- Keep download URLs and checksum parsing deterministic.
- Fail fast on unsupported platforms with clear messages.
- Preserve checksum verification unless explicitly bypassed by product decision.
