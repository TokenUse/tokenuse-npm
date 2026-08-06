# AGENTS.md - test

## Folder Purpose

`test/` contains Node-based regression tests for the npm wrapper installer and uninstall lifecycle behavior.

## Local Rules

- Keep tests deterministic and isolated from the user's global npm or TokenUse install.
- Use temporary directories and local fixture servers for installer network tests.
- Preserve checksum-verification coverage when changing download behavior.
